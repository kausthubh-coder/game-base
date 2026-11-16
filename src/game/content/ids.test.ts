// The id lists of act 1 against the content that uses them, so a list and its content never drift apart.
import { expect, test } from 'bun:test';
import { FLAG, FLAGS } from './flags.ts';
import { FIGHTS, PLACES } from './greenhollow.ts';
import { FARM_IDS, MAP_PLACE_IDS, PERSON_IDS, QUEST_IDS } from './ids.ts';
import { LEDGER } from './goods.ts';
import { GEAR_STEPS, KIT, STARTING_GEAR } from './gear.ts';
import { ITEMS } from './items.ts';

test('the map\'s places are MAP_PLACE_IDS, once each, in the same order', () => {
  expect(PLACES.map((place) => place.id)).toEqual([...MAP_PLACE_IDS]);
  // Every fight named by a place stands at one of them.
  for (const fight of FIGHTS) if (typeof fight.at === 'string') expect(MAP_PLACE_IDS as readonly string[]).toContain(fight.at);
});

test('each list has no id twice', () => {
  for (const list of [QUEST_IDS, PERSON_IDS, MAP_PLACE_IDS, FARM_IDS]) expect(new Set(list).size).toBe(list.length);
});

test('every flag builder has a row in the table of flags', () => {
  const names = FLAGS.map((row) => row.name).join(' ');
  for (const [key, build] of Object.entries(FLAG)) {
    const sample = typeof build === 'string' ? build : (build as (id: never) => string)('<id>' as never);
    // `quest.<id>.started` is in the table as written; a builder's name has its id where the table has `<id>` or `<n>`.
    const pattern = sample.replace(/<id>/g, '<');
    const head = pattern.split('<')[0];
    expect(names.includes(head), `${key}: ${sample}`).toBe(true);
  }
});

test('the gear record, the kit and the ledger name only items that exist', () => {
  const items = new Set(ITEMS.map((item) => item.id));
  for (const step of GEAR_STEPS) for (const id of [...step.takes, ...step.found]) expect(items.has(id), id).toBe(true);
  for (const [id, def] of Object.entries(KIT)) {
    expect(items.has(id as never), id).toBe(true);
    for (const need of def.needs) expect(items.has(need), need).toBe(true);
  }
  for (const section of LEDGER) for (const need of section.needs) expect(items.has(need.item), need.item).toBe(true);
  expect(STARTING_GEAR).toEqual({ weapon: 'sword', tier: 1, fitting: null, armor: 1, kit: [null, null, null] });
});
