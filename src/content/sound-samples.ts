// The recorded sounds the game ships, as the prompts that make them. `bun --env-file=.env.local tools/sound.ts`
// sends each prompt to ElevenLabs' sound effects model once, cuts and levels what comes back, and writes
// public/assets/sound/<id>.mp3 and the list in public/assets/sound/sound.json. Change a prompt and only that
// sound is made again. Everything else the game hears is still made in code by src/features/audio.
//
// Four kinds:
//   bed    a long loop that plays under everything. The engine reads it from random points and crossfades,
//          so it never repeats the same way. `seconds` is what is asked for.
//   steps  one take of many footfalls. The tool finds each hit and keeps them as slices of one file.
//   hits   the same for tool strikes and other short knocks.
//   shot   a whole one-shot.
// `takes` asks for several takes of a shot, steps or hits, and the engine never plays the same one twice in a row.
//   grain  a continuous rustle. The engine plays short random windows of it.
//
// `level` is the loudness the tool brings each file to, in LUFS (beds) or as the peak of the loudest
// slice in dBFS (steps, hits, shots). The mix in the engine sets the final balance.

export type SampleKind = 'bed' | 'steps' | 'hits' | 'shot' | 'grain';

export interface SampleSpec {
  id: string;
  kind: SampleKind;
  prompt: string;
  seconds: number;
  /** For `shot`: how many takes to ask for. */
  takes?: number;
  /** 0 to 1. Higher follows the prompt more closely and varies less. */
  influence?: number;
  stereo?: boolean;
  level: number;
  /** For `steps` and `hits`: the longest a slice may be, in seconds. */
  sliceMax?: number;
  /** Hz. Rumble under it is taken out. Each kind has a default in the tool. */
  highpass?: number;
}

/** What every foley prompt says, so takes are dry and close, with nothing under them. */
const DRY = 'close-up foley recording, dry, no music, no voices, no background noise';

export const SAMPLES: readonly SampleSpec[] = [
  // ---- beds: the town
  { id: 'bed.town.murmur', kind: 'bed', stereo: true, seconds: 24, level: -26, influence: 0.45,
    prompt: 'Soft distant murmur of a small friendly crowd in a cozy lakeside village square, many people chatting quietly far away, warm and wordless, no clear words, no music, calm afternoon' },
  { id: 'bed.town.square', kind: 'bed', stereo: true, seconds: 24, level: -28, influence: 0.45,
    prompt: 'Gentle everyday activity in a small cobblestone village market square heard from the middle: occasional footsteps on stone, a wooden crate set down, a wicker basket creaking, soft clink of pottery, relaxed and sparse, no voices, no music' },
  { id: 'bed.town.birds', kind: 'bed', stereo: true, seconds: 24, level: -29, influence: 0.4,
    prompt: 'Sparrows and small songbirds chirping on the rooftops of a quiet village on a sunny morning, light and sparse, no wind, no voices, no music' },
  { id: 'bed.town.water', kind: 'bed', stereo: true, seconds: 24, level: -28, influence: 0.45,
    prompt: 'Small gentle waves lapping against a stone quay on a calm lake, a moored wooden boat creaking softly, quiet and close, no wind, no voices, no music' },
  { id: 'bed.town.workshop', kind: 'bed', stereo: true, seconds: 24, level: -29, influence: 0.45,
    prompt: 'A carpenter at work in a small village workshop, heard from the lane outside: slow hand saw strokes, a few light mallet taps on wood, a plane shaving a board, unhurried, no voices, no music, no power tools' },
  { id: 'bed.town.night', kind: 'bed', stereo: true, seconds: 24, level: -29, influence: 0.4,
    prompt: 'Warm summer night in a sleeping village by a lake: crickets chirping steadily, a few frogs far off by the water, very calm, no wind, no voices, no music' },
  { id: 'bed.town.lantern', kind: 'bed', stereo: false, seconds: 16, level: -37, influence: 0.5,
    prompt: 'The faint warm hum and soft crackle of a small oil lantern flame burning close by at night, very quiet and steady, no wind, no music' },
  // ---- beds: the land around it
  { id: 'bed.meadow.day', kind: 'bed', stereo: true, seconds: 24, level: -29, influence: 0.4,
    prompt: 'Open green meadow on a calm sunny day: a soft breeze through long grass, songbirds singing far apart in the distance, faint insects, peaceful, no voices, no music' },
  { id: 'bed.forest.day', kind: 'bed', stereo: true, seconds: 24, level: -28, influence: 0.4,
    prompt: 'Inside a quiet broadleaf forest on a bright day: leaves rustling softly overhead in a light breeze, a woodpecker far off, small birds calling here and there, peaceful, no voices, no music' },
  { id: 'bed.meadow.night', kind: 'bed', stereo: true, seconds: 24, level: -30, influence: 0.4,
    prompt: 'A grassy meadow at night: crickets and katydids chirping in the long grass, a very light breeze, peaceful and warm, no voices, no music' },

  // ---- beds: the regions of Greenhollow. The engine plays them from random points, so a bed of 14 to 18
  // seconds does not loop the same way twice. Their run was held under 3,000 credits.
  { id: 'bed.oldforest.day', kind: 'bed', stereo: true, seconds: 18, level: -28, influence: 0.45,
    prompt: 'Deep inside an ancient old-growth forest of giant oaks on a still day: old trunks creaking slowly, a woodpecker tapping far off, a few birds calling with long pauses between, deep and hushed, no wind gusts, no voices, no music' },
  { id: 'bed.greyforest', kind: 'bed', stereo: true, seconds: 14, level: -33, influence: 0.5,
    prompt: 'The hushed air of a silent dead grey forest with no birds and no insects: a very faint soft dry hiss like fine ash drifting down, a low empty hush, utterly still and even, no ticking, no clicks, no wind gusts, no voices, no music' },
  { id: 'bed.marsh', kind: 'bed', stereo: true, seconds: 18, level: -28, influence: 0.45,
    prompt: 'A misty marsh at dusk: many small frogs croaking and chirping among the reeds, gentle water trickling between shallow pools, a soft plop now and then, reeds rustling softly, calm, no voices, no music' },
  { id: 'bed.caves', kind: 'bed', stereo: true, seconds: 14, level: -30, influence: 0.5,
    prompt: 'Inside a large cool rock cave: slow water drips falling into small pools and echoing off stone, a soft low hollow wind breathing from deeper in, spacious reverb, no voices, no music' },
  { id: 'bed.river', kind: 'bed', stereo: true, seconds: 16, level: -27, influence: 0.45,
    prompt: 'A wide gentle river flowing steadily past a grassy bank and an old wooden landing, water lapping at the posts, calm and continuous, no wind, no birds, no voices, no music' },
  { id: 'bed.saltgate', kind: 'bed', stereo: true, seconds: 16, level: -28, influence: 0.45,
    prompt: 'A small harbour on the sea on a breezy day: seagulls crying in the distance, rigging and ropes of moored sailing boats creaking and clinking, waves washing against the stone harbour wall, no voices, no music' },
  { id: 'bed.highroad.wind', kind: 'bed', stereo: true, seconds: 16, level: -30, influence: 0.45,
    prompt: 'Soft natural wind high up on an old stone bridge over a wide valley, a smooth airy breeze rising and falling gently, a faint whistle past the stone, calm, no harsh gusts, no birds, no voices, no music' },

  // ---- spot sounds, placed in the world by src/game/content/soundscape.ts
  { id: 'spot.creak', kind: 'shot', takes: 2, seconds: 3, level: -14,
    prompt: 'A single huge old oak tree trunk creaking slowly and deeply as it sways, one long wooden groan, in a quiet forest, no birds, no voices, no music' },
  { id: 'spot.crow', kind: 'shot', takes: 2, seconds: 3, level: -16,
    prompt: 'One crow cawing twice far away across an empty silent forest, distant and lonely, no other birds, no wind, no voices, no music' },
  { id: 'spot.market', kind: 'shot', takes: 2, seconds: 3, level: -16,
    prompt: 'A market seller in a medieval town calling out once to passers-by from a little way off, cheerful, the words indistinct, then a few coins clinking, no music' },
  { id: 'spot.bells', kind: 'shot', takes: 1, seconds: 4, level: -10,
    prompt: 'A single bronze chapel bell ringing three slow strokes from a small tower across a quiet town, warm, with a long ring after, outdoors, no voices, no music' },
  { id: 'spot.well', kind: 'shot', takes: 2, seconds: 4.5, level: -9,
    prompt: 'A wooden bucket on a creaking rope lowered into a stone village well, then a splash and water dripping, heard from a few meters away, no voices, no music' },
  { id: 'spot.dog', kind: 'shot', takes: 3, seconds: 2.5, level: -12,
    prompt: 'A friendly village dog barking twice at a distance, outdoors, no other sounds' },
  { id: 'spot.children', kind: 'shot', takes: 2, seconds: 4, level: -14,
    prompt: 'Children laughing and calling to each other while they play far away in a village, brief, distant and happy, no clear words, no music' },
  { id: 'spot.door', kind: 'shot', takes: 2, seconds: 2.5, level: -10,
    prompt: 'An old wooden cottage door opening with a latch click and closing gently, heard from the street outside, no voices, no music' },
  { id: 'spot.cart', kind: 'shot', takes: 2, seconds: 6, level: -12,
    prompt: 'A small wooden hand cart with iron rimmed wheels rolling slowly over cobblestones and passing by, no horse, no voices, no music' },
  { id: 'spot.stall', kind: 'shot', takes: 2, seconds: 2, level: -10,
    prompt: 'A market seller setting down a wooden crate of apples on a wooden stall table, then a few apples rolling, no voices, no music' },
  { id: 'spot.boat', kind: 'shot', takes: 2, seconds: 4, level: -12,
    prompt: 'A moored wooden rowing boat knocking gently against a wooden dock, with a rope creaking, on calm water, no voices, no music' },
  { id: 'spot.bird', kind: 'shot', takes: 3, seconds: 3, level: -12,
    prompt: 'A single songbird singing one short sweet melodic phrase in a tree nearby, outdoors, no other birds, no wind, no music' },

  // ---- footsteps, one take of walking on each material
  { id: 'step.grass', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.32,
    prompt: `Footsteps of one person walking at an even pace on short soft grass, each step clearly separate, ${DRY}` },
  { id: 'step.dirt', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.32,
    prompt: `Footsteps of one person walking at an even pace on soft dry earth, each step clearly separate, ${DRY}` },
  { id: 'step.path', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.32,
    prompt: `Footsteps of one person walking at an even pace on a packed dirt path with a little loose gravel, each step clearly separate, ${DRY}` },
  { id: 'step.cobble', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.3,
    prompt: `Footsteps of one person in soft leather boots walking at an even pace on old cobblestones outdoors, each step clearly separate, ${DRY}` },
  { id: 'step.stone', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.3,
    prompt: `Footsteps of one person in soft leather boots walking at an even pace on bare rough rock, each step clearly separate, ${DRY}` },
  { id: 'step.wood', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.32,
    prompt: `Footsteps of one person in soft leather boots walking at an even pace on the hollow wooden planks of a small bridge outdoors, each step clearly separate, ${DRY}` },
  { id: 'step.floor', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.32,
    prompt: `Footsteps of one person in soft leather boots walking at an even pace on old wooden floorboards inside a small cottage room, a slight creak, each step clearly separate, no music, no voices` },
  { id: 'step.sand', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.34,
    prompt: `Footsteps of one person walking at an even pace on damp sand at a lake shore, each step clearly separate, ${DRY}` },
  { id: 'step.water', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.45,
    prompt: `Footsteps of one person wading at an even pace through ankle deep shallow water, each splash clearly separate, ${DRY}` },
  { id: 'step.leaves', kind: 'steps', seconds: 6, level: -6, sliceMax: 0.34,
    prompt: `Footsteps of one person walking at an even pace on dry fallen leaves and small twigs on a forest floor, each step clearly separate, ${DRY}` },
  { id: 'move.cloth', kind: 'grain', seconds: 6, level: -16,
    prompt: `A person walking while their linen tunic and a small leather satchel rustle softly and a buckle jingles faintly, no footsteps, ${DRY}` },

  // ---- work and things in the hands
  { id: 'hit.chop', kind: 'hits', takes: 2, seconds: 6, level: -4, sliceMax: 0.6,
    prompt: `A woodcutter's axe chopping into a standing tree trunk, single solid chops with pauses between them, ${DRY}` },
  { id: 'hit.pick', kind: 'hits', takes: 2, seconds: 6, level: -5, sliceMax: 0.55,
    prompt: `An iron pickaxe striking hard rock, single hits with pauses between them, small stone chips falling, ${DRY}` },
  { id: 'hit.dig', kind: 'hits', takes: 2, seconds: 6, level: -6, sliceMax: 0.7,
    prompt: `A spade digging into soft garden soil: a crunchy scrape as the blade goes in, then the soil thrown down, five separate scoops with a pause between each, ${DRY}` },
  { id: 'hit.hoe', kind: 'hits', seconds: 5, level: -6, sliceMax: 0.5,
    prompt: `A garden hoe chopping into soft soil, single strokes with pauses between them, ${DRY}` },
  { id: 'hit.plank', kind: 'hits', seconds: 5, level: -5, sliceMax: 0.45,
    prompt: `A wooden plank being set down firmly on a wooden floor, single placements with pauses between them, ${DRY}` },
  { id: 'hit.stone', kind: 'hits', seconds: 5, level: -5, sliceMax: 0.45,
    prompt: `A heavy stone block being set down on stone, single placements with pauses between them, ${DRY}` },
  { id: 'shot.page', kind: 'shot', takes: 3, seconds: 1.2, level: -10,
    prompt: `A single page of an old paper book being turned over, a soft papery flip, ${DRY}` },
  { id: 'shot.pour', kind: 'shot', takes: 2, seconds: 2.5, level: -9,
    prompt: `A small metal watering can pouring water onto garden soil for two seconds, ${DRY}` },
  { id: 'shot.harvest', kind: 'shot', takes: 2, seconds: 1.5, level: -8,
    prompt: `Pulling a vegetable up out of the garden soil, leaves rustling and soil crumbling, ${DRY}` },
  { id: 'shot.bag', kind: 'shot', takes: 2, seconds: 1.2, level: -10,
    prompt: `Opening the flap of a small leather satchel with a soft buckle sound, ${DRY}` },
  { id: 'shot.treefall', kind: 'shot', takes: 1, seconds: 4, level: -5, highpass: 40,
    prompt: 'A small tree trunk cracking and creaking as it tips over, then falling and crashing onto soft grass with leaves rustling, outdoors, no voices, no music' },
];
