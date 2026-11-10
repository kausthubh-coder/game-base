// The mix: four buses (music, ambience, effects, voice), a hall for space, a small room for indoors, and a
// limiter on the way out. Dialogue ducks the music. Everything here lives as long as the engine does.
import type { BusId, Rig } from './rig.ts';

export type BusName = BusId | 'master';

/** A noise burst that dies away: the sound of a space. Later reflections are darker, as in a real room. */
function impulse(rig: Rig, seconds: number, decay: number, dark: number): AudioBuffer {
  const { ctx, rng } = rig;
  const length = Math.floor(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const delay = Math.floor(0.012 * ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = delay; i < length; i++) {
      const t = (i - delay) / ctx.sampleRate;
      const k = Math.min(0.97, dark + (t / seconds) * (0.97 - dark));
      low = low * k + (rng() * 2 - 1) * (1 - k);
      data[i] = low * Math.exp(-t / decay);
    }
  }
  return buffer;
}

/** Sets a parameter's target, but only when it moved. A parameter that is told the same thing 60 times a second fills up with events. */
export class Glide {
  private last = NaN;
  constructor(private readonly param: AudioParam) {}
  to(value: number, now: number, seconds: number): void {
    if (Math.abs(value - this.last) <= Math.abs(value) * 0.002 + 1e-5) return;
    this.last = value;
    this.param.setTargetAtTime(value, now, seconds);
  }
  /** Makes the last target the value right now. */
  settle(): void {
    if (!Number.isNaN(this.last)) this.param.value = this.last;
  }

  /** Jumps there now. For the first frame, before anything sounds. */
  set(value: number): void {
    this.last = value;
    this.param.value = value;
  }
}

export class Mixer {
  /** Where music layers send their dry sound, and what they send to the hall. */
  readonly music: GainNode;
  readonly musicWet: GainNode;
  readonly ambience: GainNode;
  readonly ambienceWet: GainNode;
  readonly effects: GainNode;
  readonly effectsWet: GainNode;
  readonly voice: GainNode;

  private readonly volumes: Record<BusName, number> = { master: 0.9, music: 0.8, ambience: 0.7, effects: 0.8, voice: 0.8 };
  private readonly nodes: AudioNode[] = [];
  private readonly g: Record<'master' | 'toneDry' | 'toneWet' | 'duck' | 'musicVol' | 'musicSend' | 'musicRoom' | 'ambTone' | 'ambVol' | 'ambSend' | 'fxVol' | 'fxSend' | 'fxRoom' | 'voiceVol' | 'voiceRoom', Glide>;
  private duckUntil = 0;
  private duck = 1;
  private indoors = 0;

  constructor(rig: Rig, destination: AudioNode) {
    const ctx = rig.ctx;
    const gain = (value: number): GainNode => {
      const node = rig.keep(ctx.createGain());
      node.gain.value = value;
      this.nodes.push(node);
      return node;
    };
    const lowpass = (freq: number): BiquadFilterNode => {
      const node = rig.keep(ctx.createBiquadFilter());
      node.type = 'lowpass';
      node.frequency.value = freq;
      node.Q.value = 0.5;
      this.nodes.push(node);
      return node;
    };
    const space = (buffer: AudioBuffer): ConvolverNode => {
      const node = rig.keep(ctx.createConvolver());
      node.buffer = buffer;
      this.nodes.push(node);
      return node;
    };

    // The way out: a limiter, then a soft ceiling that no sample can pass.
    const master = gain(this.volumes.master);
    const limiter = rig.keep(ctx.createDynamicsCompressor());
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    // The mix goes in at half level, so ordinary music sits under the threshold and only a pile-up is
    // limited. The trim after it brings the level back, less the make-up gain browsers add to this node.
    const pre = gain(0.5);
    const trim = gain(1.24);
    const ceiling = rig.keep(ctx.createWaveShaper());
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.27 * Math.tanh((a - 0.7) / 0.27));
    }
    ceiling.curve = curve;
    this.nodes.push(limiter, ceiling);
    master.connect(pre).connect(limiter).connect(trim).connect(ceiling).connect(destination);

    const hall = space(impulse(rig, 2.6, 0.36, 0.35));
    const hallReturn = gain(0.9);
    hall.connect(hallReturn).connect(master);
    const room = space(impulse(rig, 0.4, 0.07, 0.15));
    const roomReturn = gain(0.9);
    room.connect(roomReturn).connect(master);

    // Music: dry and wet both pass the tone filter, so going indoors muffles the echo too.
    this.music = gain(1);
    this.musicWet = gain(1);
    const toneDry = lowpass(18000);
    const toneWet = lowpass(18000);
    const duck = gain(1);
    const musicVol = gain(this.volumes.music);
    const musicSend = gain(this.volumes.music);
    const musicRoom = gain(0);
    this.music.connect(toneDry).connect(duck).connect(musicVol).connect(master);
    this.musicWet.connect(toneWet).connect(musicSend).connect(hall);
    duck.connect(musicRoom).connect(room);

    this.ambience = gain(1);
    this.ambienceWet = gain(1);
    const ambTone = lowpass(16000);
    const ambVol = gain(this.volumes.ambience);
    const ambSend = gain(this.volumes.ambience);
    this.ambience.connect(ambTone).connect(ambVol).connect(master);
    this.ambienceWet.connect(ambSend).connect(hall);

    this.effects = gain(1);
    this.effectsWet = gain(1);
    const fxVol = gain(this.volumes.effects);
    const fxSend = gain(this.volumes.effects);
    const fxRoom = gain(0);
    this.effects.connect(fxVol).connect(master);
    this.effectsWet.connect(fxSend).connect(hall);
    this.effects.connect(fxRoom).connect(room);

    this.voice = gain(1);
    const voiceVol = gain(this.volumes.voice);
    const voiceRoom = gain(0);
    this.voice.connect(voiceVol).connect(master);
    this.voice.connect(voiceRoom).connect(room);

    this.g = {
      master: new Glide(master.gain),
      toneDry: new Glide(toneDry.frequency),
      toneWet: new Glide(toneWet.frequency),
      duck: new Glide(duck.gain),
      musicVol: new Glide(musicVol.gain),
      musicSend: new Glide(musicSend.gain),
      musicRoom: new Glide(musicRoom.gain),
      ambTone: new Glide(ambTone.frequency),
      ambVol: new Glide(ambVol.gain),
      ambSend: new Glide(ambSend.gain),
      fxVol: new Glide(fxVol.gain),
      fxSend: new Glide(fxSend.gain),
      fxRoom: new Glide(fxRoom.gain),
      voiceVol: new Glide(voiceVol.gain),
      voiceRoom: new Glide(voiceRoom.gain),
    };
  }

  setVolume(bus: BusName, value: number): void {
    this.volumes[bus] = Math.max(0, Math.min(1.5, value));
  }

  volume(bus: BusName): number {
    return this.volumes[bus];
  }

  /** Someone is talking: the music steps back until half a second after the last word. */
  speak(until: number): void {
    if (until > this.duckUntil) this.duckUntil = until;
  }

  get ducking(): number {
    return this.duck;
  }

  /** Moves the mix toward what the world asks for. `fog` dulls the far ambience a little. */
  control(now: number, indoors: number, rain: number, fog: number, jump = false): void {
    const g = this.g;
    const v = this.volumes;
    this.indoors = indoors;
    this.duck = now < this.duckUntil ? 0.55 : 1;
    const tone = 18000 * 0.075 ** indoors * (1 - 0.5 * rain);
    g.master.to(v.master, now, 0.05);
    g.toneDry.to(tone, now, 0.25);
    g.toneWet.to(tone, now, 0.25);
    g.duck.to(this.duck, now, this.duck < 1 ? 0.07 : 0.3);
    g.musicVol.to(v.music, now, 0.05);
    g.musicSend.to(v.music * this.duck, now, 0.1);
    g.musicRoom.to(indoors * 0.5 * v.music, now, 0.25);
    g.ambTone.to(16000 * 0.05 ** indoors * (1 - 0.45 * fog), now, 0.25);
    g.ambVol.to(v.ambience * (1 - 0.45 * indoors), now, 0.2);
    g.ambSend.to(v.ambience * (1 - 0.6 * indoors), now, 0.2);
    g.fxVol.to(v.effects, now, 0.05);
    g.fxSend.to(v.effects * (1 - 0.7 * indoors), now, 0.2);
    g.fxRoom.to(indoors * 0.6 * v.effects, now, 0.2);
    g.voiceVol.to(v.voice, now, 0.05);
    g.voiceRoom.to(indoors * 0.5 * v.voice, now, 0.2);
    // On the first frame nothing has sounded yet, so go straight there.
    if (jump) for (const glide of Object.values(g)) glide.settle();
  }

  get room(): number {
    return this.indoors;
  }

  dispose(): void {
    for (const node of this.nodes) node.disconnect();
  }
}
