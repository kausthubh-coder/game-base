// Starts the sound engine on the first click or key, since a browser will not let a page make sound
// before that, and keeps the volumes from before it started. What each game event sounds like is in
// src/game/views/core-sound.view.ts.
import { createAudio, type AudioSystem, type BusName } from '../../features/audio/index.ts';

export const BUSES: readonly BusName[] = ['master', 'music', 'ambience', 'effects', 'voice'];
export const DEFAULT_VOLUMES: Readonly<Record<BusName, number>> = { master: 0.9, music: 0.8, ambience: 0.7, effects: 0.8, voice: 0.8 };

export interface Sound {
  /** Null until the first click or key. */
  readonly audio: AudioSystem | null;
  /** Runs `fn` when the engine starts, or at once when it already has. */
  onStart(fn: (audio: AudioSystem) => void): void;
  volume(bus: BusName): number;
  setVolume(bus: BusName, value: number): void;
  /** Starts the engine now. The first click or key does this by itself. */
  start(): AudioSystem | null;
  /**
   * Makes the engine now and keeps it silent until the first click or key. Making it takes a fifth of a second
   * on a fast laptop (the context, a long bed of noise, the rooms' echoes), so the shell does it while the title
   * waits, and that click only switches the sound on.
   */
  prepare(): void;
  dispose(): void;
}

export function createSound(volumes: Record<BusName, number>): Sound {
  const stop = new AbortController();
  const waiting: ((audio: AudioSystem) => void)[] = [];
  let context: AudioContext | null = null;
  let audio: AudioSystem | null = null;
  /** True once a click, a key or the game asked for sound. Until then a prepared engine stays suspended. */
  let wanted = false;

  function start(): AudioSystem | null {
    wanted = true;
    if (audio) return audio;
    return make();
  }

  function make(): AudioSystem | null {
    try {
      context = new AudioContext();
      audio = createAudio(context);
      for (const bus of BUSES) audio.setVolume(bus, volumes[bus]);
      audio.start();
      // A page the browser lets play sound at once would start it here: a prepared engine waits for the click.
      void (wanted ? context.resume() : context.suspend()).catch(() => undefined);
    } catch (error) {
      // No sound is not a reason to stop the game.
      console.warn('[game] the sound engine did not start:', error);
      audio = null;
      return null;
    }
    for (const fn of waiting.splice(0)) fn(audio);
    return audio;
  }

  const first = (): void => {
    start();
    // A context made before the gesture counted stays suspended until it is resumed in one.
    if (context && context.state === 'suspended') void context.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', first, { capture: true, signal: stop.signal });
  window.addEventListener('keydown', first, { capture: true, signal: stop.signal });
  // A hidden tab draws no frames, so nothing would schedule the music: pause it and pick it up again.
  document.addEventListener('visibilitychange', () => {
    if (!context || !wanted) return;
    if (document.hidden) void context.suspend().catch(() => undefined);
    else void context.resume().catch(() => undefined);
  }, { signal: stop.signal });

  return {
    get audio() { return audio; },

    onStart(fn) {
      if (audio) fn(audio);
      else waiting.push(fn);
    },

    volume: (bus) => volumes[bus],

    setVolume(bus, value) {
      volumes[bus] = Math.min(1, Math.max(0, value));
      audio?.setVolume(bus, volumes[bus]);
    },

    start,

    prepare() {
      if (!audio && !stop.signal.aborted) make();
    },

    dispose() {
      stop.abort();
      audio?.dispose();
      void context?.close().catch(() => undefined);
      audio = null;
      context = null;
    },
  };
}
