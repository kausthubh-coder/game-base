# Sound engine notes

Code makes the music and most sounds. There is no audio library, only the Web Audio API. Two kinds of audio file come in from outside, both made ahead of time with ElevenLabs:

- A voiced line (`public/assets/voice/`, made by `tools/voice.ts`): `speak(clip)` plays it on the voice bus, and while it plays the music drops to 0.55 and the ambience to 0.75, as for the typed blips.
- A recording (`public/assets/sound/`, made by `tools/sound.ts` from `src/content/sound-samples.ts`): a bed, a take of footsteps, tool strikes, a one-shot or a rustle. The game decodes each and hands it over with `addSample`. Until it arrives, the made sound plays in its place, so the engine sounds whole with no files at all.
The public surface is `index.ts`. The demo is `demos/audio`. The checks are `bun tools/audio-check.mjs`.

Nobody has listened to this yet. The checks measure loudness, gaps, tempo, voices and nodes. They cannot say
whether it sounds good. "What to tune first" below lists the parts most likely to need a person's ears.

## How to use it

```ts
const audio = createAudio(new AudioContext());   // after the first click
audio.start();
// every frame
audio.setState({ regions: { meadow: 0.7, desert: 0.3 }, town, indoors, danger, fight, boss, nearWater, trees });
audio.followAmbient(ambient);        // time of day, rain, wind, fog, wetness from src/engine/types.ts
audio.setListener(playerPosition, camera.yaw);   // panning turns with the picture
audio.addSample(id, buffer, info);   // each recording, once decoded (src/game/views/core-sound.view.ts does this)
audio.setBed('bed.town.murmur', 0.8, at);   // a recorded bed's level, a few times a second
audio.update(dt);
// when things happen
bus.on((event) => audio.onEvent(event));          // the base's GameEvent
audio.emit({ type: 'talk', voice, char: 'a' });   // the events the base does not have yet
```

`debug()` returns the conductor's state. `setVolume(bus, value)` takes `master`, `music`, `ambience`, `effects`
or `voice`. `soloLayer(layer)` plays one music layer alone, for tuning.

## How it is put together

| File | What it holds |
|---|---|
| `index.ts` | The public surface: `createAudio`, the state, the events, `debug` |
| `conductor.sim.ts` | The clock. 12 ticks a beat, 4 beats a bar. The tempo glides and the tick count never goes back. |
| `intensity.sim.ts` | One number for how much is going on, and the on and off thresholds of each layer |
| `blend.sim.ts` | Region weights to a gain per layer per palette, the notes two lands share, one tempo |
| `patterns.sim.ts` | Palette and bar number to notes. The same bar always gives the same notes. |
| `ambience.sim.ts` | Gusts, and how often birds, crickets and frogs call |
| `rig.ts` | Noise buffers, oscillator shapes, the 64-voice budget, the count of live nodes |
| `instruments.ts` | Four instrument recipes (pluck, bell, wind, pad) and sixteen drums |
| `music.ts` | Schedules each beat a quarter of a second ahead and moves the layer gains |
| `ambience.ts` | Wind, leaves, water, rain, one bed per land, and the creatures |
| `effects.ts` | Footsteps, blocks, hits, spells, interface, speech blips, the pet, machine ticks, and the recorded slices |
| `samples.ts` | The bank of recordings (shuffled slices, never the same twice in a row) and `BedLoop` |
| `mixer.ts` | Four buses, the music's hall, the four world spaces, the limiter |
| `render-offline.ts` | Runs the engine in an `OfflineAudioContext` for the checks |

The `.sim.ts` files hold no Web Audio and have tests beside them. The rest needs a browser, and
`tools/audio-check.mjs` covers it.

### The clock

`music.ts` schedules one beat at a time, as soon as the beat is less than 0.25 s away. On each beat it fixes
the region weights, the mood (fight, night, town, rain) and which layers are on, so changes land on a beat.
The leading land, the bar that closes a fight and the quest stinger wait for a bar line.
The tempo moves toward its target a little on every tick. A fight multiplies the tempo by 1.28. Night
multiplies it by 0.92, except in a fight.

### Music is data

A palette is one file in `src/content/palettes`: root, scale, chords, tempo, grid, and a patch and rhythm for
each layer. To add a land, add a file and list it in `index.ts` there. The shared instruments are in
`instruments.ts` in that folder. The world motif is in `motif.ts`: seven scale degrees, `0 2 4 3 2 1 0`.
Each palette plays it in its own scale.

The melody is planned eight bars at a time, as four cells of two bars: the motif, an answer, a variation and
a cadence. The phrase number alone picks the form, so two lands in a border band state the tune and rest at
the same moments.

### Layers

Seven layers belong to a palette: drone, harmony, melody, sparkle, bass, perc, and `full` (the town
arrangement). Three are laid over every land: `drums` (the fight kit), `tension` (danger) and `boss`.
Intensity is 0.50 on a calm day, 0.34 at night, 0.66 in a town and 0.95 in a fight. Each layer has an on and
an off threshold in `intensity.sim.ts`.

### Borders

`blend.sim.ts` gives each layer its own stretch of the band (`CROSSOVER`). Walking from A into B, B's drone
comes in from weight 0.10, its harmony from 0.28, the lead and the bass swap around 0.5, and its sparkle
arrives last, from 0.55. A palette below weight 0.8 plays only the notes its neighbor also has. The tempo is
a weighted blend of the two. All of it is a function of the weights, so walking back undoes it.
The weights move at most 0.6 a second. Walking and running stay under that, so the mix follows position. A
teleport is over it, so it takes under two seconds to morph.

### Voices and nodes

A voice is one note, one hit or one continuous bed. `rig.begin` asks for room before any node is made, and
returns null when the bus is full. That is how the limit of 64 holds: the engine never makes a sound that
would break it. The shares are music 30, ambience 18, effects 12 and voice 4. A recording is one buffer, a gain,
a filter and a pan, so the ambience and the effects have room for townsfolk's feet and the town's spot sounds. Less important sounds (sparkle,
the town arrangement, far birds) are refused a few voices before a bus is full.
`rig.sweep` disconnects a voice's nodes when it ends. The fixed graph is 167 nodes.

## The seven palettes

| Land | Key and scale | Tempo | Drone | Harmony | Lead, and at night | Percussion |
|---|---|---|---|---|---|---|
| meadow | D major pentatonic, with G# from the II chord | 84 | soft pad on D and A | harp in eighths | wooden flute, music box | hand drums |
| desert | E Phrygian dominant | 96 | low reed on E and B | lute in 3+3+2 | reed flute with turns, lute | frame drum: dum and tek |
| coast | A Dorian, triplet grid for the 6/8 sway | 72 | bowed pad that follows the chords | glass bells | a glass tone, glass bell | soft shaker and a low drum |
| rainvalley | A, five notes (A B D E G) over a drone | 100 | four drone strings, plucked in turn | hammered strings | a string that bends into its notes, flute | low drum that bends up, a tuned high drum. More drums in rain. |
| highlands | G major pentatonic, with ninths | 120 | light strings | short plucks | chimes, flute | shaker and a wood click |
| forge | B natural minor, chords with no third | 80 | low reed on B and F#, and a choir pad | strummed low strings | a horn, a reed | deep drum, anvil on two and four |
| center | D, one chord: D A E B | 60 | one pad that never moves | all six lands' instruments in turn | the six leads in turn, music box | none |
| town (Hollowmere) | G major pentatonic, chords I vi IV V I IV ii V | 92, swing 0.16 | soft pad that follows the chords | strummed lute | tin whistle and dulcimer trading every two bars, music box | hand drums, shaker, a wood click |

D, E, A and B are in every palette. Neighbors around the ring share at least four notes, and a test checks it.
The town and the meadow share D E F# A B, and their tempos (92 and 84) are close enough that the clock glides
from one to the other over the border band. The game sets `regions: { meadow, town }` from the town's zone, so
walking in through the gate is the same crossfade as any border.

## Recordings, space and placement

- **Steps.** `footstep` takes a `material` (grass, dirt, path, cobble, stone, wood, floor, sand, water, leaves)
  and a `gait`. Each material is one take of 8 to 17 footfalls, played shuffled, retuned by up to 0.9 of a
  semitone and releveled by about a decibel. Soft walk is half as loud, lower and duller; a run is louder and
  higher. Wet ground lays a little water over the step, `litter` lays dry leaves under trees, and `cloth` is the
  chance of a rustle of tunic and satchel. A landing is both feet and a soft thump. `quiet` and `muffle` are for
  other people's feet.
- **Tools.** Breaking and placing play a recorded bite by surface (`BREAK` and `PLACE` in `index.ts`) and then the
  made crumble at a lower level, so each break still comes apart differently. `foley` covers the hoe, the
  watering can, harvest, planting, the bag and the Almanac's page.
- **Beds.** `BedLoop` plays 8 to 14 second stretches from random points of a bed's file, each crossfading into
  the next with equal power over 2.4 s, so a 22 second file never repeats in the same order. A bed at level 0
  stops reading. The recorded beds thin out the made birds (`cover` in `ambience.ts`).
- **Placement.** `locate` pans by how far a sound is to the right of the camera, fades it by distance, darkens it
  with distance (`tone`), and `muffle` (a wall between, from the game's ray through the blocks) takes off more
  top and some level.
- **Spaces.** Effects and placed ambience send to four convolution spaces: open (a faint short ring), forest (a
  dark diffuse tail), stone (quick bright echoes, 19 to 110 ms) and room. `trees`, `stone` and `indoors` in the
  state set the share of each. At `low` quality the forest and stone spaces fold into the open one.

## What to tune first

Listen in this order. Each line names where the number lives.

1. **The balance of the layers.** `MIX` in `music.ts` sets the level, hall send and pan of each layer.
   Each palette file has a `gain` per layer. `bun tools/audio-stems.mjs meadow` prints each layer's level.
   I set them so the lead is about 3 dB over the harmony and 5 dB over the drone, by RMS. RMS is a poor
   guide for plucks and drums against held notes, so expect to move these.
2. **The instruments.** The patches are in `src/content/palettes/instruments.ts`. `bright` and `decay` on a
   pluck, `index` on a bell, `breath` and `vibrato` on a wind patch change the most. The recipes are simple:
   one or two oscillators and a filter. They will sound like a synthesizer imitating a harp, not like a harp.
3. **The melody.** The cells are in `cellTones` in `patterns.sim.ts`. There are three answers, three
   variations and four cadences. Ten minutes in one land will repeat them.
4. **The ambience levels.** `control` in `ambience.ts`. With the wind at 0.5, the meadow's ambience measures
   about 19 dB under its music.
5. **Footsteps and effects.** `effects.ts`. Each surface is a few lines.
6. **The fight.** The kit is `FIGHT_KIT` in `patterns.sim.ts`. The tempo factor is `FIGHT_TEMPO` in
   `conductor.sim.ts`.

## Known weak spots

- Nobody has heard it. Everything under "What to tune first" is set by measurement and by reading spectrograms.
- In a border band two leads play at once for a short stretch (weights 0.42 to 0.58). They share a form and
  the shared notes, but they are still two tunes. If it sounds crowded, narrow `CROSSOVER.melody`.
- The coast is on a triplet grid and its neighbors are not. In the coast's bands you hear three against four.
- The boss motif uses a flat second. Over the major palettes that is a clash on purpose, and may be too much.
- A machine tick waits for the next half beat, so it can sound up to half a beat after the machine moves.
- Speech blips are pitched tones through a filter. They do not form vowels.
- `indoors` filters the music at 1350 Hz. The brief asks for a low-pass on the music, and it is a strong one.
- Short peaks in the desert, the rain valley and the highlands reach 0.83 to 0.87. The soft ceiling starts
  rounding at 0.7, so the loudest plucks are rounded a little. Lower `master` in `mixer.ts` if they crunch.
- The low end is the strongest part of every spectrogram. The desert and the forge hold a drone between 60
  and 125 Hz the whole time, which may boom on headphones. The drone levels are in each palette file.
- When a bus is full the engine refuses new sounds. It does not cut old ones short. In the stress scene the
  music bus refused about 27 notes a second, mostly harmony and sparkle.
- A hidden tab stops calling `update`. The demo suspends the context then, so the music pauses and resumes.
  The game will need to do the same, or call `update` from a timer.
- The limiter is a `DynamicsCompressorNode`. Browsers add make-up gain to it, and `mixer.ts` takes that back
  out with a fixed trim worked out from Chrome's formula. Only Chrome is checked.
- `setQuality('low')` only drops the sparkle and the town arrangement.

## Checks

`bun tools/audio-check.mjs` builds the demo, serves it on port 5312, renders each scene in headless Chrome with
an offline context and writes a WAV and a spectrogram for each to `.artifacts/audio`. `--only fight` runs one
scene. The scenes are in `demos/audio/lab.ts`.
