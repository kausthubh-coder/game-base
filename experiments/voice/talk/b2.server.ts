// Pipeline B2: a fast text model through Codex, then ElevenLabs speaking each sentence as soon as it is
// written. One `TextVoice` per browser tab. It owns a `codex app-server` and one thread with Tamsin's
// prompt as the base instructions (so none of Codex's coding prompt), and no tools. GPT-5.6-Luna at low
// effort on the Fast tier is the default: the quickest of the three measured (README), and it stays in character.
//
// A reply streams from the model token by token. Each finished sentence goes to ElevenLabs' streaming
// endpoint at once, as raw 24 kHz PCM, and the audio is passed on in sentence order. Every step is
// timed with the server's clock, so a turn reports where its time went.
import { AppServer } from '../lib/codex.ts';
import { speakStream } from '../../../tools/voice/eleven.ts';
import { CAST } from '../cast.ts';
import { prompt, type GameState } from './tamsin.ts';

export interface TextModel {
  model: string;
  effort: 'low' | 'medium';
  /** "priority" is Codex's Fast tier. */
  tier?: string;
}

export const TEXT_MODELS: Record<string, TextModel> = {
  'sol-fast': { model: 'gpt-6.1-sol', effort: 'low', tier: 'priority' },
  'terra-fast': { model: 'gpt-6.1-terra', effort: 'low', tier: 'priority' },
  'luna-fast': { model: 'gpt-5.6-luna', effort: 'low', tier: 'priority' },
  'luna6-fast': { model: 'gpt-6-luna', effort: 'low', tier: 'priority' },
};

export const TTS_MODELS = ['eleven_flash_v2_5', 'eleven_v4_turbo', 'eleven_turbo_v2_5'] as const;

/** Milliseconds from the start of the turn (the moment the server had the player's words). */
export interface TurnTimes {
  firstToken?: number;
  firstSentence?: number;
  firstAudioByte?: number;
  textDone?: number;
  audioDone?: number;
}

interface Sentence {
  chunks: Uint8Array[];
  done: boolean;
}

export type TurnEvent =
  | { type: 'text'; delta: string }
  | { type: 'sentence'; index: number; text: string }
  | { type: 'audio'; index: number; pcm: Uint8Array }
  | { type: 'done'; text: string; times: TurnTimes }
  | { type: 'error'; message: string };

/** Where a piece of a reply can be spoken alone: the end of a sentence, a semicolon or colon, or a dash, then a space. */
const SENTENCE_END = /[.!?…;:]+["')\]]?\s+|\s[—–]\s/g;
/** The first piece is cut at a comma too, once it is this long, so her voice starts sooner. */
const FIRST_CUT = 40;

/** Strips anything a voice must not read: stage directions, asterisks, emoji. */
const speakable = (s: string) =>
  s
    .replace(/\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export class TextVoice {
  #codex = new AppServer(['-c', 'mcp_servers={}']);
  #threadId = '';
  #onDelta: ((d: string) => void) | null = null;
  #onDone: (() => void) | null = null;
  #onError: ((m: string) => void) | null = null;
  readonly textModel: TextModel;
  readonly ttsModel: string;

  constructor(textModel = 'luna-fast', ttsModel = 'eleven_flash_v2_5') {
    this.textModel = TEXT_MODELS[textModel] ?? TEXT_MODELS['luna-fast'];
    this.ttsModel = ttsModel;
    this.#codex.on('notification', (n) => {
      if (n.method === 'item/agentMessage/delta') this.#onDelta?.(n.params.delta);
      else if (n.method === 'turn/completed') this.#onDone?.();
      else if (n.method === 'error' && !n.params?.willRetry) this.#onError?.(n.params?.error?.message ?? 'codex error');
    });
    // No tools are offered, so any request from Codex is refused.
    this.#codex.on('serverRequest', (r) => this.#codex.respondError(r.id, 'not available here'));
  }

  async start(state: GameState): Promise<void> {
    await this.#codex.initialize();
    const m = this.textModel;
    const { thread } = await this.#codex.request('thread/start', {
      model: m.model,
      ...(m.tier && { serviceTier: m.tier }),
      ephemeral: true,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      cwd: '/tmp',
      environments: [],
      baseInstructions: prompt(state),
      config: { model_reasoning_effort: m.effort },
    });
    this.#threadId = thread.id;
  }

  /** Tells her what changed in the game, quietly, as part of the next turn. */
  #pendingNote = '';
  note(text: string): void {
    this.#pendingNote = text;
  }

  /**
   * One turn: the player's words in, her reply out as text and audio. `voice` false skips ElevenLabs.
   * Audio streams out in sentence order: sentence 0's chunks go out as they arrive, while later
   * sentences, already requested, collect theirs until their turn.
   */
  async turn(words: string, emit: (e: TurnEvent) => void, voice = true): Promise<void> {
    const t0 = performance.now();
    const at = () => Math.round(performance.now() - t0);
    const times: TurnTimes = {};
    let text = '', spoken = 0, previous = '', textOver = false, count = 0;
    const sentences: Sentence[] = [];
    let wakePump: (() => void) | null = null;
    const wake = () => (wakePump?.(), (wakePump = null));

    const speak = (sentence: string) => {
      const said = speakable(sentence);
      if (!said) return;
      const index = count++;
      emit({ type: 'sentence', index, text: said });
      times.firstSentence ??= at();
      if (!voice) return;
      const s: Sentence = { chunks: [], done: false };
      sentences.push(s);
      const prior = previous;
      previous += (previous ? ' ' : '') + said;
      this.#tts(said, prior, (pcm) => {
        times.firstAudioByte ??= at();
        s.chunks.push(pcm);
        wake();
      })
        .catch((e) => emit({ type: 'error', message: String(e.message ?? e) }))
        .finally(() => ((s.done = true), wake()));
    };

    // Sends audio in sentence order until the text is over and every sentence has been sent.
    const pump = (async () => {
      for (let i = 0; ; ) {
        const s = sentences[i];
        if (!s) {
          if (textOver) return;
        } else if (s.chunks.length) {
          emit({ type: 'audio', index: i, pcm: s.chunks.shift()! });
          continue;
        } else if (s.done) {
          i++;
          continue;
        }
        await new Promise<void>((r) => (wakePump = r));
      }
    })();

    const finished = new Promise<void>((resolve, reject) => {
      this.#onDone = resolve;
      this.#onError = (m) => reject(new Error(m));
    });
    this.#onDelta = (delta) => {
      times.firstToken ??= at();
      text += delta;
      emit({ type: 'text', delta });
      SENTENCE_END.lastIndex = spoken;
      let m: RegExpExecArray | null;
      while ((m = SENTENCE_END.exec(text))) {
        speak(text.slice(spoken, m.index + m[0].length));
        spoken = m.index + m[0].length;
      }
      if (count === 0 && text.length - spoken >= FIRST_CUT) {
        const comma = text.indexOf(', ', spoken + 20);
        if (comma > 0) {
          speak(text.slice(spoken, comma + 2));
          spoken = comma + 2;
        }
      }
    };
    const input = this.#pendingNote ? `${this.#pendingNote}\n\nThe player says: ${words}` : words;
    this.#pendingNote = '';
    try {
      await this.#codex.request('turn/start', { threadId: this.#threadId, input: [{ type: 'text', text: input, text_elements: [] }] });
      await finished;
      times.textDone = at();
      if (spoken < text.length) speak(text.slice(spoken));
    } catch (e) {
      emit({ type: 'error', message: String((e as Error).message ?? e) });
    } finally {
      this.#onDelta = this.#onDone = this.#onError = null;
      textOver = true;
      wake();
    }
    await pump;
    times.audioDone = at();
    emit({ type: 'done', text: text.trim(), times });
  }

  /** Streams one sentence's audio, handing on whole 16-bit samples as they arrive. */
  async #tts(text: string, previousText: string, chunk: (pcm: Uint8Array) => void): Promise<void> {
    const tamsin = CAST.tamsin;
    const res = await speakStream({
      voiceId: tamsin.voiceId,
      text,
      modelId: this.ttsModel,
      format: 'pcm_24000',
      settings: { stability: 0.5, similarity_boost: 0.8, speed: tamsin.settings.speed },
      ...(previousText && { previousText }),
    });
    let carry: Uint8Array | null = null;
    for await (const piece of res.body as unknown as AsyncIterable<Uint8Array>) {
      let data: Uint8Array = carry ? concat(carry, piece) : piece;
      carry = null;
      if (data.length % 2) (carry = data.slice(-1)), (data = data.slice(0, -1));
      if (data.length) chunk(data);
    }
  }

  close(): void {
    this.#codex.close();
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
