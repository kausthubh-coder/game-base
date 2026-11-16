// Plays the Build tab's three farms in the real game in Chrome and takes pictures of them: the gearling pit, the
// terrace and the bait field, built east of the mossy pond in the quest Water uphill, as the scenario
// src/game/scenarios/three-farms.sim.ts builds them. Every part goes down with the debug door's click, which is a
// player's right click with the held item, so it runs the same rules a person's click does.
//
//   PLAY_PORT=5676 bun tools/play.mjs start        builds and serves the game
//   PLAY_PORT=5676 bun tools/farms-play.mjs        plays and shoots into .artifacts/farms/
//
// It prints each farm's tag and line, and exits 1 when a tag says otherwise than the Build tab.
import { mkdirSync } from 'node:fs';
import { launchChrome, rendererOf } from './lib/chrome.mjs';

const port = process.env.PLAY_PORT || 5676;
const out = '.artifacts/farms';
mkdirSync(out, { recursive: true });
const browser = await launchChrome();
let failures = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?hold=1`);
  await page.waitForFunction(() => window.__game);
  console.log('renderer', await rendererOf(page));
  const g = (fn, arg) => page.evaluate(fn, arg);
  await g(() => { const d = window.__game; d.newGame(); });
  await page.waitForFunction(() => window.__game.state().started);
  await g(() => {
    const d = window.__game;
    d.skipTo('uphill');
    d.advance(1);
    for (const [item, n] of [['spade', 1], ['hoe', 1], ['waterwheel', 2], ['gear_shaft', 6], ['pusher', 1], ['sprinkler', 1], ['fence', 8], ['wheat_seeds', 12], ['carrot_seeds', 8], ['workbench', 1]]) d.give(item, n);
    d.setTime(0.4);
  });

  /** Puts an item in hand, as the number keys and a drag in the bag do. */
  const hold = (item) => g((id) => {
    const bag = window.__game.view.game.systems.inventory;
    let at = bag.slots.findIndex((s) => s?.id === id);
    if (at > 8) { bag.move(at, 8); at = 8; }
    bag.selected = at;
  }, item);
  const stand = (x, z) => g(([x, z]) => window.__game.teleport(x + 0.5, 22, z + 0.5), [x, z]);
  const click = async (x, z, y = 21) => {
    const r = await g(([x, y, z]) => window.__game.click('secondary', x, y, z, [0, 1, 0]), [x, y, z]);
    if (!r.used) { console.log(`  a click at ${x}, ${y}, ${z} did nothing`); failures++; }
  };
  const settle = async (seconds = 3) => { await g((s) => window.__game.advance(s), seconds); await g(() => window.__game.settle()); await g(() => window.__game.frames(6)); };
  const farm = (id) => g((id) => window.__game.view.game.systems.farms.get(id), id);
  const expect = async (id, tag, symptom) => {
    const f = await farm(id);
    const ok = f?.tag === tag && f?.symptom === symptom;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: ${f?.tag} | ${f?.symptom}`);
    if (!ok) failures++;
  };
  const shot = async (name) => { await g(() => window.__game.frames(4)); await page.screenshot({ path: `${out}/${name}.png` }); console.log(`  ${out}/${name}.png`); };

  // The stream: a ditch dug east from the pond.
  await hold('spade');
  await stand(8, -228);
  for (const x of [8, 9, 10, 11, 12]) await click(x, -230);
  await stand(14, -228);
  for (const x of [13, 14, 15, 16, 17]) await click(x, -230);
  await settle(1);

  // The gearling pit.
  await stand(11, -228);
  await hold('waterwheel'); await click(11, -230);
  await hold('gear_shaft'); await click(10, -230);
  await hold('fence');
  for (const [x, z] of [[9, -226], [10, -226], [12, -226], [13, -226], [14, -226]]) await click(x, z);
  await hold('spade'); await click(11, -227);
  await stand(9, -228);
  await hold('gear_shaft'); await click(10, -229); await click(10, -228);
  await hold('pusher'); await click(10, -227);
  await stand(11, -221);
  await settle(3);
  await expect('spring', '6 springs a day', 'Every gearling goes through the pit, and walks home.');
  await settle(14);
  await shot('1-pit-day');
  // Closer, from the free camera: the gearlings walking their rows, the one in the pit, the pusher beside it.
  await g(() => { const d = window.__game; d.setCamera('free'); d.teleport(15.5, 22, -224.5); });
  await settle(6);
  await g(() => window.__game.look(150, 32, 9));
  await shot('1b-pit-close');
  await g(() => window.__game.setCamera('tilt'));

  // The terrace.
  await stand(13, -233);
  await hold('waterwheel'); await click(16, -230);
  await hold('gear_shaft'); await click(16, -231); await click(16, -232);
  await hold('sprinkler'); await click(16, -233);
  const fields = [[9, -231], [10, -231], [14, -231], [15, -231], [17, -231], [15, -229], [15, -232], [17, -232], [15, -233], [17, -233], [15, -234], [16, -234]];
  await hold('hoe'); for (const [x, z] of fields) await click(x, z);
  await hold('wheat_seeds'); for (const [x, z] of fields) await click(x, z);
  await stand(12, -236);
  await settle(3);
  await expect('field', '24 wheat a day', 'Every field is wet and every sprinkler turns.');
  await shot('2-terrace');

  // The bait field, by day and at night.
  await stand(10, -233);
  const carrots = [[8, -236], [9, -236], [10, -236], [11, -236], [8, -235], [9, -235], [10, -235], [11, -235]];
  await hold('hoe'); for (const [x, z] of carrots) await click(x, z);
  await hold('carrot_seeds'); for (const [x, z] of carrots) await click(x, z);
  await stand(9, -240);
  await settle(3);
  await expect('copper', '4 copper a day', 'Every burrower comes up in your carrots.');
  await g(() => window.__game.setTime(0.82));
  await settle(14);
  await shot('3-bait-night');

  // The farm panel, with the fix one press away.
  await g(() => window.__game.setTime(0.45));
  await stand(11, -222);
  await settle(1);
  await g(() => window.__game.view.game.events.emit('ui.open', { panel: 'farm', detail: 'spring' }));
  await page.waitForSelector('[data-panel="farm"]');
  await page.click('[data-key="why"]');
  await shot('4-farm-panel');
  await page.keyboard.press('Escape');

  // The Workbench and the Road kit.
  await stand(12, -238);
  await hold('workbench'); await click(13, -238);
  await g(() => { const d = window.__game; for (const [i, n] of [['copper', 6], ['shed_pelt', 3], ['quill', 9], ['moss_fiber', 8], ['quill_strip', 3], ['lamp_post_kit', 2], ['salve', 1]]) d.give(i, n); d.view.game.flags.set('quest.copper.started', true); });
  // A workbench opens the Make panel, with the gold pill to the Workbench's gear above it.
  await g(() => window.__game.interact());
  await page.waitForSelector('[data-key="open-bench"]', { state: 'visible' });
  await shot('5a-make-pill');
  await page.click('[data-key="open-bench"]');
  await page.waitForSelector('[data-panel="bench"]');
  await shot('5-bench');
  await page.click('[data-key="make"]');
  await shot('6-bench-made');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyK');
  await page.waitForSelector('[data-panel="kit"]');
  await page.click('[data-key="quill_strip"]');
  await page.click('[data-key="equip"]');
  await shot('7-kit');
  await page.keyboard.press('Escape');

  const gear = await g(() => window.__game.view.game.systems.bench.gear());
  console.log('gear', JSON.stringify(gear));
  if (errors.length) { console.log('console errors:', errors.slice(0, 5)); failures++; }
} finally {
  await browser.close();
}
process.exit(failures ? 1 : 0);
