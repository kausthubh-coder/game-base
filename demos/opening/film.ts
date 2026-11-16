// The opening film's cut, as data: what plays before the player can move. Eleven shots in two parts. Hobb, the
// cook who raised you, says every line. It is the cut Kausthubh approved up to the doorstep on 2026-11-11,
// from ~/dev/sandbox/game-look-test/playthrough/film.js (handbook chapter 29).
//
// `seconds` is the least a shot lasts. `beats` are moments the picture and the sound both hit, as a share of
// the shot from 0 to 1. makeFilm() stretches a shot to fit its spoken line and turns the beats into seconds.
import type { Film, Part, Shot, ShotId } from './types.ts';

interface ShotSpec {
  id: ShotId;
  part: Part;
  title: string;
  plate: string;
  seconds: number;
  say: string;
  see: string;
  beats: Record<string, number>;
}

/** Seconds into a shot before its line starts, and seconds of picture left after the line ends. */
const LEAD = 0.6;
const TAIL = 1.1;

const CUT: readonly ShotSpec[] = [
  {
    id: 'war', part: 0, title: 'The war', plate: 'm1-war', seconds: 5,
    say: 'A thousand years back, six peoples fought a war nobody could end.',
    see: 'A temple wall paints itself in. Six armies under six banners face each other across a spring of light.',
    // painted: the wall has finished painting itself in.
    beats: { painted: 0.55 },
  },
  {
    id: 'king', part: 0, title: 'The farm boy', plate: 'm2-king', seconds: 5,
    say: 'A farm boy ended it. So they made him king.',
    see: 'A boy with a hoe stands between the armies. Six hands hold a crown over his head.',
    // crown: the crown comes to rest over his head.
    beats: { crown: 0.6 },
  },
  {
    id: 'friends', part: 0, title: 'His friends', plate: 'm3-friends', seconds: 8,
    say: 'Six friends stood with him.',
    see: 'The camera walks along his friends, six of them in gold. It stops on one more place, scraped back to bare plaster. A painted fox still sits at its feet.',
    // scraped: the camera stops on the scraped place and holds there to the end of the shot. Nobody remarks on it.
    beats: { scraped: 0.68 },
  },
  {
    id: 'roads', part: 0, title: 'Roads of light', plate: 'm4-roads', seconds: 5.5,
    say: 'He joined every city with roads of light. Nobody went cold or hungry.',
    see: 'Roads of light join seven cities. Everyone in every doorway wears a small bright stone at the throat.',
    // lit: the last road reaches the last city.
    beats: { lit: 0.6 },
  },
  {
    id: 'sickness', part: 0, title: 'The sickness', plate: 'm5-sickness', seconds: 5,
    say: 'Then came a sickness no light could cure.',
    see: 'Rows of beds. The stones at their throats go dim. The king kneels by three small graves.',
    // dim: the stones have gone dim.
    beats: { dim: 0.5 },
  },
  {
    id: 'night', part: 0, title: 'The night', plate: 'm6-ascent', seconds: 7.5,
    say: 'So he took his people up to heaven. Every one of them, in a single night.',
    see: 'A light rises out of every house and streams to the king. A golden dome closes over the city. Every door is left open.',
    // rise: the first lights leave the houses. dome: the dome has closed.
    beats: { rise: 0.15, dome: 0.8 },
  },
  {
    id: 'gods', part: 0, title: 'The old gods', plate: 'm7-gods', seconds: 5.5,
    say: 'The old gods of the land lay down to sleep until he comes home.',
    see: 'Six great beasts lie in a ring round the dome. Golden bands are wound about each of them.',
    // bands: the gold bands catch the light. They are chains, and nobody says so.
    beats: { bands: 0.6 },
  },
  {
    id: 'mark', part: 0, title: 'The Mark', plate: 'm8-hand', seconds: 6,
    say: 'And one day a hand will bear the Mark, and wake them. So the priests say.',
    see: 'A raised hand. Points of gold light on it one after another. Six light. The seventh place stays dark.',
    // light1 to light6: each point of the Mark lights. The seventh never does.
    beats: { light1: 0.2, light2: 0.29, light3: 0.38, light4: 0.47, light5: 0.56, light6: 0.65 },
  },
  {
    id: 'wall', part: 1, title: 'The wall', plate: 'p1-wall', seconds: 6.5,
    say: 'That one? Damp got at it, I expect. Bed, Button.',
    see: 'The painting is a wall in a dark room. A small child holds a candle up to the scraped place. A cook waits in the doorway.',
    // room: we can tell the painting is a wall in a room. hobb: Hobb is in view, in the doorway.
    beats: { room: 0.3, hobb: 0.55 },
  },
  {
    id: 'doorstep', part: 1, title: 'The doorstep', plate: 'p2-doorstep', seconds: 6.5,
    say: 'You came to us in the rain, with a key round your neck.',
    see: 'Sixteen years ago. A basket on the guild\'s step, a brass key on the blanket. Someone in a grey coat walks away and does not look back.',
    // thunder: far thunder. key: the brass key catches the lamp.
    beats: { thunder: 0.1, key: 0.7 },
  },
  {
    id: 'morning', part: 1, title: 'Sixteen years on', plate: 'p9-doorstep-day', seconds: 7.5,
    say: 'That was sixteen years ago.',
    see: 'The same step, in morning sun. The rain is gone, the door stands open, and the street is hung with flags.',
    // title: the page sets "Act 1, The Mark" over the picture from here. Leave the upper left calm for it.
    beats: { title: 0.5 },
  },
];

/** The words the page sets over the last shot. */
export const TITLE = { eyebrow: 'Act 1', name: 'The Mark', shot: 'morning' as ShotId, beat: 'title' } as const;

/** The film, timed. `voiceSeconds` is how long each spoken line lasts; a shot grows to fit its line. */
export function makeFilm(voiceSeconds: Partial<Record<ShotId, number>> = {}): Film {
  let at = 0;
  const shots: Shot[] = CUT.map((spec, n) => {
    const len = Math.max(spec.seconds, LEAD + (voiceSeconds[spec.id] ?? 0) + TAIL);
    const beats = Object.fromEntries(Object.entries(spec.beats).map(([name, share]) => [name, share * len]));
    const shot: Shot = { id: spec.id, n, part: spec.part, title: spec.title, say: spec.say, see: spec.see, at, len, beats, plate: spec.plate };
    at += len;
    return shot;
  });
  const byId = new Map(shots.map((s) => [s.id, s]));
  return {
    shots,
    length: at,
    lead: LEAD,
    shot: (id) => byId.get(id) as Shot,
    at: (t) => shots.findLast((s) => t >= s.at) ?? shots[0],
  };
}
