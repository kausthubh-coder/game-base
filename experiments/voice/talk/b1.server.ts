// Pipeline B1: ChatGPT's realtime voice through `codex app-server`, the way ~/dev/live-tutor does it.
// The browser holds the WebRTC call (its mic and her voice go straight to OpenAI); this bridge starts
// the call with Tamsin's prompt and passes on the SDP and any typed words.
// The websocket transport (audio through app-server) would let the server time the call itself, but it
// answers "realtime conversation requires API key auth" on a ChatGPT login, so WebRTC it is.
import { AppServer } from '../lib/codex.ts';
import { DEFAULT_VOICE, REALTIME_VOICES } from './options.ts';
import { prompt, type GameState } from './tamsin.ts';


/** What the voice is told on top of who she is. The realtime voice ignores the `prompt` field, so it all goes in initialItems. */
const SPOKEN = `This is a live voice conversation. The player's words reach you as a speech transcript: if a word makes no sense, it may be misheard; ask about it in a few words. Speak slowly and low. Never talk over the player. If you hear nothing, wait.`;

export type BridgeOut = { type: 'ready' } | { type: 'answer'; sdp: string } | { type: 'status'; status: string; message?: string };

export class RealtimeBridge {
  #codex = new AppServer(['-c', 'mcp_servers={}']);
  #threadId = '';
  #send: (m: BridgeOut) => void;

  constructor(send: (m: BridgeOut) => void) {
    this.#send = send;
    this.#codex.on('notification', ({ method, params }) => {
      if (method === 'thread/realtime/sdp') send({ type: 'answer', sdp: params.sdp });
      else if (method === 'thread/realtime/started') send({ type: 'status', status: 'started' });
      else if (method === 'thread/realtime/closed') send({ type: 'status', status: 'closed', message: params.reason });
      else if (method === 'thread/realtime/error') send({ type: 'status', status: 'error', message: params.message });
    });
    this.#codex.on('serverRequest', (r) => this.#codex.respondError(r.id, 'not available here'));
    this.#codex.on('exit', (code) => send({ type: 'status', status: 'error', message: `codex app-server exited (${code})` }));
  }

  async start(): Promise<void> {
    await this.#codex.initialize();
    const { thread } = await this.#codex.request('thread/start', {
      ephemeral: true,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      cwd: '/tmp',
      environments: [],
      config: { model_reasoning_effort: 'low' },
    });
    this.#threadId = thread.id;
    this.#send({ type: 'ready' });
  }

  /** Starts the call from the page's SDP offer. The answer comes back as a `thread/realtime/sdp` notification. */
  offer(sdp: string, state: GameState, voice = DEFAULT_VOICE): Promise<unknown> {
    return this.#codex.request('thread/realtime/start', {
      threadId: this.#threadId,
      version: 'v3',
      outputModality: 'audio',
      voice: REALTIME_VOICES.includes(voice) ? voice : DEFAULT_VOICE,
      includeStartupContext: false,
      initialItems: [
        { role: 'developer', text: prompt(state) },
        { role: 'developer', text: SPOKEN },
      ],
      codexResponseHandoffMode: 'commentary',
      transport: { type: 'webrtc', sdp },
    });
  }

  /** Words typed by the player, as if said. */
  say(text: string): Promise<unknown> {
    return this.#codex.request('thread/realtime/appendText', { threadId: this.#threadId, role: 'user', text });
  }

  stop(): void {
    this.#codex.request('thread/realtime/stop', { threadId: this.#threadId }).catch(() => {});
    setTimeout(() => this.#codex.close(), 500);
  }
}
