// The film's recorded sounds, as the prompts that make them, in the pattern of src/content/sound-samples.ts.
// make.ts sends each prompt to ElevenLabs' sound effects model once, cuts and levels what comes back and writes
// fx/<id>.mp3 and the list fx/fx.json. Change a prompt and only that sound is made again. The music and every
// sound that works better made (the glass notes, the lights rising, the bells) are code, in score.ts.
//
//   bed   a loop that plays under a stretch of the film, joined part-way when the film is seeked.
//   shot  a one-shot. Its `hit`, the moment it is loudest, is what lands on a beat.

export type RecordedKind = 'bed' | 'shot';

export interface RecordedSpec {
  id: string;
  kind: RecordedKind;
  prompt: string;
  /** Seconds asked for. */
  seconds: number;
  /** A bed's loudness in LUFS, or a shot's peak in dBFS. The mix in cues.ts sets the final balance. */
  level: number;
  /** 0 to 1. Higher follows the prompt more closely. */
  influence?: number;
  /** Hz. Rumble under it is taken out. */
  highpass?: number;
}

const NONE = 'no voices, no music';

export const RECORDED: readonly RecordedSpec[] = [
  // The doorstep, sixteen years ago.
  { id: 'rain', kind: 'bed', seconds: 22, level: -24, influence: 0.5,
    prompt: `Steady night rain falling on an old cobbled stone street and slate roofs, water running in a gutter and dripping from the eaves, close and even, no thunder, no wind, ${NONE}` },
  { id: 'thunder', kind: 'shot', seconds: 7, level: -6, influence: 0.45, highpass: 30,
    prompt: `One long soft roll of distant thunder far away over a town at night, deep and low, rumbling away slowly, no rain, ${NONE}` },
  { id: 'steps-away', kind: 'shot', seconds: 7, level: -9, influence: 0.5,
    prompt: `Footsteps of one person in leather boots walking away on wet cobblestones in the rain, starting close and fading into the distance, unhurried, never stopping, ${NONE}` },
  // The dark room, under the legend and in the wall shot.
  { id: 'candle-room', kind: 'bed', seconds: 16, level: -34, influence: 0.5,
    prompt: `The quiet of a small candle-lit room in an old stone house at night: a candle flame fluttering softly, old wooden boards settling with a faint creak now and then, very still and close, no wind, ${NONE}` },
  { id: 'creak', kind: 'shot', seconds: 2.5, level: -12, influence: 0.55,
    prompt: `A single old wooden floorboard creaking softly under a careful foot in a quiet room, ${NONE}` },
  // The morning, sixteen years on.
  { id: 'morning', kind: 'bed', seconds: 22, level: -27, influence: 0.45,
    prompt: `Early morning in a small old town street after rain: songbirds singing on the rooftops, cloth flags and bunting flapping gently in a light breeze, peaceful and bright, no traffic, no bells, ${NONE}` },
  // The legend: the wall painting itself in, and the six gods asleep in their gold bands.
  { id: 'paint', kind: 'shot', seconds: 4, level: -14, influence: 0.5,
    prompt: `A wide soft brush sweeping paint across a dry plaster wall in long slow strokes, close and quiet, ${NONE}` },
  { id: 'breath', kind: 'bed', seconds: 10, level: -32, influence: 0.5,
    prompt: `A huge sleeping beast breathing slowly and deeply far away in a vast stone hall, long low breaths in and out, calm, with reverb, no growls, ${NONE}` },
  { id: 'chain', kind: 'shot', seconds: 3, level: -14, influence: 0.5,
    prompt: `A heavy iron chain shifting slightly and settling with one soft low clink, far off in a big stone hall with reverb, ${NONE}` },
];
