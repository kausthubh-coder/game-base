// The voiced lines of dialogue: the list tools/voice.ts writes (public/assets/voice/voice.json, which the asset
// manifest names as `voice.lines`) and the clips it lists. A conversation's clips are fetched when it starts,
// and each one is decoded by the sound engine the first time it is wanted. Nothing here calls ElevenLabs: the
// clips are files made ahead of time.
import type { AudioSystem } from '../../features/audio/index.ts';

/** One voiced line, as the list gives it. */
export interface VoiceClip {
  /** Relative to the assets folder. */
  file: string;
  seconds: number;
  /** For each character of the box's text, the millisecond of the clip it appears at. */
  reveal: number[];
}

interface VoiceList {
  version: 1;
  model: string;
  lines: Record<string, VoiceClip>;
  conversations: Record<string, string[]>;
}

/** What happened to one voiced line. The checks read these as `window.__voice.log`. */
export interface VoiceRecord {
  key: string;
  file: string;
  /**
   * `loading` until the clip can play, then `playing`, and `ended` or `stopped` (skipped). `late` and `failed`
   * typed the line at its speed instead: the clip took too long, or did not load or decode. `silent` means
   * the sound engine was not running, so the line was typed as before.
   */
  status: 'loading' | 'playing' | 'ended' | 'stopped' | 'late' | 'failed' | 'silent';
  /** The HTTP status of the clip's file. */
  http?: number;
  /** The length the engine decoded, in seconds. */
  decoded?: number;
  /** The length the list gives, in seconds. */
  seconds: number;
  /** When the last letter is due, in seconds into the clip. */
  lastLetter: number;
  /** Seconds into the clip when the box had typed the whole line by itself, without a skip. */
  typedAt?: number;
}

declare global {
  interface Window {
    /** The voiced lines so far, and how far into its clip the one speaking now is. For the checks. */
    __voice?: { log: VoiceRecord[]; elapsed(): number | null };
  }
}

export interface SpokenLines {
  /** True once the list is in. False when there is none: then nobody speaks, and every line blips. */
  readonly ready: Promise<boolean>;
  /** The clip for a line someone says, or null when it has none. */
  clip(npc: string, text: string): VoiceClip | null;
  /** Starts fetching every clip a conversation may play, and lets go of the last conversation's. */
  prepare(conversation: string): void;
  /** The clip decoded by the engine, or null when it did not load. `http` gets the file's status. */
  decoded(clip: VoiceClip, audio: AudioSystem, http?: (status: number) => void): Promise<AudioBuffer | null>;
}

export function createSpokenLines(baseUrl: string): SpokenLines {
  let list: VoiceList | null = null;
  /** The fetched bytes of the prepared conversation's clips, with the status of each file. */
  let bytes = new Map<string, Promise<{ status: number; data: ArrayBuffer | null }>>();
  let buffers = new Map<string, Promise<AudioBuffer | null>>();

  const ready = (async () => {
    try {
      const assets = await (await fetch(baseUrl + 'manifest.json')).json();
      const file = assets?.voice?.lines;
      if (typeof file !== 'string') return false;
      const res = await fetch(baseUrl + file);
      if (!res.ok) throw new Error(`${file}: the server answered ${res.status}`);
      list = (await res.json()) as VoiceList;
      return true;
    } catch (error) {
      // No voices is not a reason to stop the game: every line types and blips as before.
      console.warn('[game] the voiced lines did not load:', error);
      return false;
    }
  })();

  const fetchClip = (file: string) => {
    let pending = bytes.get(file);
    if (!pending) {
      pending = fetch(baseUrl + file).then(
        async (res) => ({ status: res.status, data: res.ok ? await res.arrayBuffer() : null }),
        () => ({ status: 0, data: null }),
      );
      bytes.set(file, pending);
    }
    return pending;
  };

  return {
    ready,

    clip(npc, text) {
      return list?.lines[`${npc}|${text}`] ?? null;
    },

    prepare(conversation) {
      const keys = list?.conversations[conversation] ?? [];
      const files = new Set(keys.map((key) => list!.lines[key]?.file).filter((f): f is string => !!f));
      // Only the clips of this conversation are kept, fetched or decoded.
      const keptBytes = new Map<string, Promise<{ status: number; data: ArrayBuffer | null }>>();
      const keptBuffers = new Map<string, Promise<AudioBuffer | null>>();
      for (const file of files) {
        const had = bytes.get(file);
        if (had) keptBytes.set(file, had);
        const decoded = buffers.get(file);
        if (decoded) keptBuffers.set(file, decoded);
      }
      bytes = keptBytes;
      buffers = keptBuffers;
      for (const file of files) void fetchClip(file);
    },

    decoded(clip, audio, http) {
      let pending = buffers.get(clip.file);
      if (!pending) {
        pending = fetchClip(clip.file).then(async ({ status, data }) => {
          http?.(status);
          if (!data) return null;
          try {
            // Decoding takes the bytes over, so it is given a copy and the bytes stay for another try.
            return await audio.decode(data.slice(0));
          } catch {
            return null;
          }
        });
        buffers.set(clip.file, pending);
      } else if (http) {
        void fetchClip(clip.file).then(({ status }) => http(status));
      }
      return pending;
    },
  };
}
