import { assertLightsShelter } from './lights-shelter.mjs';
import { aroundCampToHolt } from './lights-navigation.mjs';
import { daySecondAt, DAY_SECONDS } from '../../src/features/weather/clock.sim.ts';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lightsSession } from '../play-lights.mjs';
import { sha256 } from './lights-contract.mjs';
import { runtimeHashes, checkBudgets } from './gallery.mjs';
import { execFileSync } from 'node:child_process';
export function lightsInputs(dist) {
  const paths = [
    'tools/play-lights.mjs',
    'tools/play/wait.mjs',
    'tools/chapters/lights-layout.mjs',
    'tools/chapters/lights-shelter.mjs',
    'tools/chapters/lights-navigation.mjs',
    'tools/lights-observation.mjs',
    'tools/chapters/lights-preflight.mjs',
    'tools/workflow/replay.mjs',
    'tools/lib/chrome.mjs',
    'tools/lib/chrome-path.mjs',
    'tools/resource-status.mjs',
  ];
  return {
    src: execFileSync('git', ['rev-parse', 'HEAD:src'], { encoding: 'utf8' }).trim(),
    public: execFileSync('git', ['rev-parse', 'HEAD:public'], { encoding: 'utf8' }).trim(),
    source: Object.fromEntries(paths.map((p) => [p, sha256(readFileSync(p))])),
    runtime: runtimeHashes(dist),
  };
}
export function lightsFixture(raw) {
  const s = JSON.parse(raw),
    sys = s.game.systems;
  sys.inventory.slots = Array.from({ length: 36 }, () => null);
  for (const [i, id, count] of [
    [0, 'axe', 1],
    [1, 'plank', 30],
    [2, 'copper', 5],
    [3, 'lantern', 1],
    [4, 'moss_fiber', 10],
  ])
    sys.inventory.slots[i] = { id, count };
  s.game.clock.timeOfDay = 0.4;
  sys.time.daySecond = (daySecondAt(0.4) * 1200) / DAY_SECONDS;
  s.game.player = { ...s.game.player, x: -1.5, y: 22, z: -222.5 };
  const add = (kind, x, z, quarterTurns = 0) => {
    const id = kind + ':' + sys.placeables.next++;
    sys.placeables.placed.push({ id, kind, x, y: 22, z, quarterTurns });
    return id;
  };
  const bed = add('home_bed', -5, -236);
  const hatch = add('hatch', -4, -235),
    chest = add('collector_chest', -8, -235),
    sensor = add('sensor', -8, -234),
    lamp = add('switch_lamp', -9, -234);
  sys.machines.chests.push([chest, [['glow_dust', 3]]]);
  sys.machines.sensors.push([sensor, 'good']);
  sys.machines.hatches.push([hatch, false]);
  for (const [x, z] of [
    [-23, -242],
    [-26, -238],
    [-20, -236],
  ])
    add('lantern', x, z);
  return { raw: JSON.stringify(s), bed, hatch, chest, sensor, lamp };
}
export async function runLightsPresentation({ raw, out, dist }) {
  const views = [];
  for (const [device, width, height] of [
    ['desktop', 1366, 768],
    ['phone', 390, 844],
  ])
    for (const quality of ['high', 'low']) {
      const name = device + '-' + quality,
        dir = resolve(out, name),
        fixture = lightsFixture(raw);
      await lightsSession(
        { raw: fixture.raw, out: dir, dist, quality, width, height, diagnostic: true },
        async (p) => {
          // Diagnostic only: stage the canopy without claiming earned construction.
          await p.page.evaluate(() => {
            const g = window.__game.view.game,
              id = g.systems.items.get('plank').block;
            for (const x of [-5, -2])
              for (let y = 22; y < 25; y++) g.world.setBlock(x, y, -237, id);
            for (let x = -5; x <= -2; x++)
              for (let z = -237; z <= -233; z++) g.world.setBlock(x, 25, z, id);
          });
          await p.shot('home-first');
          await p.interaction('placeable:workbench:1', () =>
            p.page.locator('.gu-stage-make:not([hidden])').isVisible(),
          );
          await p.shot('make-first');
          await p.click('[data-key="make:hatch"]');
          await p.page.locator('.gu-recipe:has([data-key="make:hatch"])').scrollIntoViewIfNeeded();
          await p.shot('make-last');
          await p.press('Escape');
          await p.walk({ x: -3.5, y: 22, z: -235.7 });
          await p.interaction('placeable:' + fixture.hatch, async () =>
            p.page.evaluate(
              (id) => window.__game.view.game.systems.machines.hatchOpen(id),
              fixture.hatch,
            ),
          );
          await p.wait((s) => s.farms.find((f) => f.id === 'rope')?.rate > 0, 'daylight rope');
          await p.shot('rootsnare-open');
          const shelter = await p.page.evaluate((bedId) => {
            const g = window.__game.view.game,
              cells = [];
            for (let x = -5; x <= -2; x++)
              for (let z = -237; z <= -233; z++)
                cells.push({ x, y: 25, z, key: window.__game.block(x, 25, z).key });
            const bed = g.systems.placeables.all().find((q) => q.id === bedId);
            return {
              cells,
              bed,
              bedCover: bed
                ? [bed.z, bed.z + 1].map((z) => ({
                    x: bed.x,
                    y: 25,
                    z,
                    key: window.__game.block(bed.x, 25, z).key,
                  }))
                : [],
            };
          }, fixture.bed);
          p.write('shelter-geometry.json', shelter);
          assertLightsShelter(shelter, fixture.bed);
          await p.walk({ x: -8.5, y: 22, z: -237.5 }, 0.25);
          await p.shot('shelter-outside');

          await p.walk({ x: -3.5, y: 22, z: -233.5 });
          await p.interaction('farm:rope', () => p.page.locator('[data-panel="farm"]').isVisible());
          await p.shot('farm-first');
          await p.click('[data-key="why"]');
          await p.shot('farm-last');
          await p.press('Escape');
          await p.equip('plank');
          await p.press('KeyG');
          await p.shot('build-mode');
          await p.press('KeyG');

          await p.walk({ x: -7.5, y: 22, z: -232.5 });
          await p.wait(
            (s) => s.parts.find((q) => q.id === fixture.lamp)?.state === 'working',
            'connected lamp sees chest',
          );
          await p.shot('sensor-on');
          await p.walk({ x: -7.5, y: 22, z: -235.7 });
          await p.interaction('placeable:' + fixture.chest, () =>
            p.page.locator('[data-panel="collector"]').isVisible(),
          );
          await p.shot('collector-first');
          await p.click('[data-key="take-all"]');
          await p.shot('collector-last');
          await p.press('Escape');
          await p.wait(
            (s) => s.parts.find((q) => q.id === fixture.lamp)?.state !== 'working',
            'lamp responds to collection',
          );
          await p.shot('sensor-off');
          await p.build('lantern', -22, 22, -238);
          await p.wait((s) => s.residents.some((q) => q.who === 'holt'), 'Holt arrival');
          const events = await p.observations();
          if (
            !events.some((r) => r.name === 'settler.arrived' && r.data.who === 'holt') ||
            !events.some((r) => r.name === 'toast' && r.data.text.includes('Holt asks to stay'))
          )
            throw Error('actual Holt notification absent');
          await p.shot('holt-arrival');
          await aroundCampToHolt(p);
          await p.interaction('npc:holt', () =>
            p.page.locator('[data-key="home:card:holt"]').isVisible(),
          );
          await p.shot('holt-first');
          await p.shot('holt-last');
          await p.press('Escape');
          await p.wait(
            () => p.page.evaluate(() => document.querySelector('.hp-banner')?.hidden === true),
            'arrival cleanup',
          );
          await p.shot('hud-restored');
          const restored = await p.page.evaluate(() =>
            ['.ui-heart', '.gb-hud-quest'].map((selector) => {
              const el = document.querySelector(selector),
                s = getComputedStyle(el);
              return {
                selector,
                visible: !el.hidden && s.visibility !== 'hidden' && s.display !== 'none',
              };
            }),
          );
          if (restored.some((h) => !h.visible)) throw Error('arrival HUD did not restore');
          p.write('hud-restoration.json', restored);
          const hall = await p.page.evaluate(
            () => window.__game.view.game.systems.region.place('town.hall').at,
          );
          const ledgerRaw = JSON.parse(fixture.raw);
          ledgerRaw.game.player = { ...ledgerRaw.game.player, x: hall.x + 2, y: hall.y, z: hall.z };
          ledgerRaw.game.systems.inventory.slots[5] = { id: 'glow_dust', count: 20 };
          await p.load(JSON.stringify(ledgerRaw));
          await p.interaction('goods:ledger', () =>
            p.page.locator('.gd-ledger:not([hidden])').isVisible(),
          );
          await p.click('[data-key="section:lamphouse"]');
          await p.page.locator('.gd-page [data-key="deliver"]').scrollIntoViewIfNeeded();
          await p.shot('ledger-first');
          await p.click('[data-key="deliver"]');
          await p.page.locator('.gd-page [data-key="deliver"]').scrollIntoViewIfNeeded();
          await p.shot('ledger-last');
          await p.press('Escape');

          await p.save('diagnostic-final');
          await p.shot('cleanup');
          const s = await p.read();
          if (s.player.busy || s.talk || s.paused) throw Error('interaction cleanup');
          p.write('presentation.json', {
            pass: true,
            hatch: fixture.hatch,
            chest: fixture.chest,
            sensor: fixture.sensor,
            lamp: fixture.lamp,
            diagnostic: true,
          });
        },
      );
      views.push({ dir, quality });
    }
  return views;
}
export function validateLightsPresentation(out, dist) {
  const manifest = JSON.parse(readFileSync(resolve(out, 'binding.json'), 'utf8'));
  if (JSON.stringify(lightsInputs(dist)) !== JSON.stringify(manifest.inputs))
    throw Error('preflight inputs/runtime changed');
  for (const [p, sha] of Object.entries(manifest.files))
    if (sha256(readFileSync(p)) !== sha) throw Error('preflight raw/image changed ' + p);
  const review = JSON.parse(readFileSync(resolve(out, 'image-review.json'), 'utf8'));
  if (review.pass !== true || JSON.stringify(review.files) !== JSON.stringify(manifest.files))
    throw Error('image review unbound');
  checkBudgets(manifest.views);
  return manifest;
}
export function bindLightsPresentation(out, dist, views) {
  const files = {};
  for (const { dir } of views)
    for (const f of readdirSync(dir).sort())
      if (/\.(png|json)$/.test(f)) files[resolve(dir, f)] = sha256(readFileSync(resolve(dir, f)));
  const binding = { inputs: lightsInputs(dist), views, files };
  writeFileSync(resolve(out, 'binding.json'), JSON.stringify(binding, null, 2));
  return binding;
}
