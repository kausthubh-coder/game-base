import { afterEach, expect, test } from 'bun:test';
import { createSound, DEFAULT_VOLUMES, type Sound } from './sound.ts';

// Run the real shell, engine and mixer against a recording Web Audio graph.
// Parameters settle immediately here: this checks routing, not browser fade timing.
class Param {
  value = 1;
  minValue = -24000;
  maxValue = 24000;
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
  setValueCurveAtTime(values: Float32Array) { this.value = values[values.length - 1]; }
  cancelScheduledValues() {}
}

class Node extends EventTarget {
  outputs: Node[] = [];
  gain = new Param(); frequency = new Param(); Q = new Param(); pan = new Param();
  playbackRate = new Param(); detune = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  constructor(readonly kind: string) { super(); }
  connect(node: Node | Param) { if (node instanceof Node) this.outputs.push(node); return node; }
  disconnect() { this.outputs = []; }
  start() {}
  stop() {}
  setPeriodicWave() {}
  /** Every route's settled gain to the speaker, including the wet routes. */
  output(destination: Node): number {
    if (this === destination) return 1;
    return (this.kind === 'gain' ? this.gain.value : 1) * this.outputs.reduce((sum, node) => sum + node.output(destination), 0);
  }
}

class Context {
  sampleRate = 8000;
  currentTime = 0;
  state = 'suspended';
  destination = new Node('destination');
  sources: Node[] = [];
  createGain() { return new Node('gain'); }
  createBiquadFilter() { return new Node('filter'); }
  createStereoPanner() { return new Node('panner'); }
  createDynamicsCompressor() { return new Node('compressor'); }
  createWaveShaper() { return new Node('shaper'); }
  createConvolver() { return new Node('convolver'); }
  createPeriodicWave() { return {}; }
  createBufferSource() { const node = new Node('source'); this.sources.push(node); return node; }
  createOscillator() { return this.createBufferSource(); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / sampleRate, getChannelData: (channel: number) => data[channel] };
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

const originals = new Map<string, PropertyDescriptor | undefined>();
let sound: Sound | undefined;
afterEach(() => {
  sound?.dispose();
  sound = undefined;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
});

function setup() {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false });
  for (const [key, value] of Object.entries({ window, document, AudioContext: Context, AudioBufferSourceNode: Node, PeriodicWave: class {} })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const volumes = { ...DEFAULT_VOLUMES, master: 0.6 };
  const engine = createSound(volumes);
  sound = engine;
  const mute = (reason: string, on: boolean) => engine.setMuted(reason, on);
  const advance = () => {
    const audio = engine.audio!;
    const ctx = audio.context as unknown as Context;
    ctx.currentTime += 0.1;
    audio.update();
    return ctx;
  };
  const output = (advanceClock = true) => {
    const ctx = advanceClock ? advance() : engine.audio!.context as unknown as Context;
    const effects = (engine.audio!.effectsInput as unknown as Node).output(ctx.destination);
    const beds = ctx.sources.reduce((sum, node) => sum + node.output(ctx.destination), 0);
    return { effects, beds };
  };
  return { engine, mute, volumes, window, document, output };
}

test('the opening silences existing output immediately, before another frame can start the master fade', () => {
  const { engine, mute, output } = setup();
  engine.start();
  expect(output().effects).toBeGreaterThan(0);
  expect(output(false).beds).toBeGreaterThan(0);
  mute('opening', true);
  // setVolume stores a target. Existing sounds must be silent even before update applies it.
  expect(engine.audio!.getVolume('master')).toBe(0);
  expect(output(false)).toEqual({ effects: 0, beds: 0 });
});

test('opening silences existing world beds and effects through gestures and tab return, then restores current preferences', () => {
  const { engine, mute, volumes, window, document, output } = setup();
  window.dispatchEvent(new Event('pointerdown'));
  expect(engine.audio).not.toBeNull();
  expect(output().beds).toBeGreaterThan(0);
  expect(output().effects).toBeGreaterThan(0);
  mute('opening', true);
  expect(output()).toEqual({ effects: 0, beds: 0 });
  engine.setVolume('master', 0.35);
  engine.setVolume('music', 0.25);
  window.dispatchEvent(new Event('keydown'));
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pointerdown'));
  expect(output()).toEqual({ effects: 0, beds: 0 });
  expect(volumes.master).toBe(0.35);
  expect(engine.volume('master')).toBe(0.35);
  mute('opening', false);
  expect(output().beds).toBeGreaterThan(0);
  expect(output().effects).toBeGreaterThan(0);
  expect(engine.audio!.getVolume('master')).toBe(0.35);
  expect(engine.audio!.getVolume('music')).toBe(0.25);
});

test('an opening acquired before preparation remains silent when the first gesture starts audio', () => {
  const { engine, mute, window, output } = setup();
  mute('opening', true);
  engine.prepare();
  window.dispatchEvent(new Event('pointerdown'));
  expect(output()).toEqual({ effects: 0, beds: 0 });
  mute('opening', false);
  expect(output().beds).toBeGreaterThan(0);
});

test('releasing one owner cannot release another, and a muted user preference remains muted after the opening', () => {
  const { engine, mute, output } = setup();
  engine.start();
  mute('opening', true);
  mute('other', true);
  mute('opening', false);
  mute('opening', false);
  expect(output()).toEqual({ effects: 0, beds: 0 });
  engine.setVolume('master', 0);
  mute('other', false);
  expect(output()).toEqual({ effects: 0, beds: 0 });
  engine.setVolume('master', 0.4);
  expect(output().effects).toBeGreaterThan(0);
});
