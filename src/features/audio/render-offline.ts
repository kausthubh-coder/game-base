// Runs the engine in an OfflineAudioContext, faster than real time. The checks use it to render a scene
// to a buffer and to read the conductor as it goes. It drives the engine exactly as a game would: a state
// every step, then `update`.
import { createAudio, type AudioDebug, type AudioSystem } from './index.ts';

export interface OfflineScene {
  seconds: number;
  sampleRate?: number;
  /** Seconds between updates. A game calls every frame. The default here is 50 ms, which is coarser and so harder. */
  step?: number;
  seed?: number;
  /** Called once before the music starts. Set volumes and the first state here. */
  setup?(audio: AudioSystem): void;
  /** Called every step with the time in seconds. Set the state and emit events here. */
  frame(time: number, audio: AudioSystem, index: number): void;
  /** Called every step after the update, with the engine's own debug object. Copy what you need from it. */
  sample?(debug: AudioDebug, time: number): void;
  /** Called at these times with the rendering paused, so the caller can look at the browser from outside. */
  marks?: number[];
  onMark?(time: number): Promise<void>;
}

export interface OfflineResult {
  buffer: AudioBuffer;
  /** Milliseconds each `update` call took. */
  updateMs: number[];
}

export async function renderOffline(scene: OfflineScene): Promise<OfflineResult> {
  const rate = scene.sampleRate ?? 44100;
  const step = scene.step ?? 0.05;
  const ctx = new OfflineAudioContext(2, Math.ceil(scene.seconds * rate), rate);
  const audio = createAudio(ctx, { seed: scene.seed ?? 1 });
  const updateMs: number[] = [];
  let index = 0;
  const marks = (scene.marks ?? []).slice().sort((a, b) => a - b);

  const tick = (time: number): void => {
    scene.frame(time, audio, index++);
    const before = performance.now();
    audio.update();
    updateMs.push(performance.now() - before);
    scene.sample?.(audio.debug(), time);
  };

  scene.setup?.(audio);
  scene.frame(0, audio, index);
  audio.start();
  tick(0);
  for (let i = 1; i * step < scene.seconds; i++) {
    const time = i * step;
    void ctx.suspend(time).then(async () => {
      tick(time);
      if (marks.length > 0 && time >= (marks[0] as number)) {
        marks.shift();
        await scene.onMark?.(time);
      }
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  audio.dispose();
  return { buffer, updateMs };
}
