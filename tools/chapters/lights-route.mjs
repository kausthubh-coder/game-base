import { lightsResume } from './lights-resume.mjs';
import { sha256, LIGHTS_START_SHA } from './lights-contract.mjs';
import { aroundCampToHolt } from './lights-navigation.mjs';
import { lightsSession } from '../play-lights.mjs';
import { auditLightsConservation } from '../audit-lights.mjs';
import { assertLightsBoundary } from './lights-contract.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export async function earnLights(run, { raw, out, dist, resume }) {
  const initial = JSON.parse(raw);
  const recovery = resume ? lightsResume(resume, raw) : null;
  return lightsSession({ raw: recovery?.raw ?? raw, out, dist }, async (p) => {
    p.write('replay-source.json', {
      root: LIGHTS_START_SHA,
      input: sha256(recovery?.raw ?? raw),
      report: run.path,
      previous: recovery?.dir ?? null,
    });
    const flag = (s, id) => s.flags[id] === true;
    const part = (kind) =>
      p.page.evaluate(
        (kind) => window.__game.view.game.systems.placeables.all().find((q) => q.kind === kind),
        kind,
      );
    const build = async (id, x, y, z) => {
      const exists = await p.page.evaluate(
        ({ id, x, y, z }) =>
          window.__game.view.game.systems.placeables.at(x, y, z)?.kind === id ||
          (id === 'plank' && window.__game.block(x, y, z).key === 'oak_plank') ||
          (id === 'lamp' && window.__game.block(x, y, z).key === 'lamp'),
        { id, x, y, z },
      );
      if (!exists) await p.build(id, x, y, z);
    };
    const ensure = async (id, n = 1) => {
      if (['hatch', 'home_bed', 'sensor', 'switch_lamp'].includes(id) && (await part(id))) return;
      const have = await p.count(id);
      if (have < n) await p.make(id, n - have);
    };
    const step = async (name, action, verify) => {
      const carried = recovery?.completed.get(name);
      if (carried)
        return run.step(
          'preserved-' + name,
          async () => carried,
          (entry) => sha256(readFileSync(resolve(entry.dir, name + '.save.json'))) === entry.sha256,
        );
      return run.step(
        name,
        async () => {
          console.log('Light milestone starts: ' + name);
          await action();
          await p.save(name);
          await p.shot(name);
          return p.read();
        },
        verify,
      );
    };
    await step(
      'rootsnare-shelter',
      async () => {
        const have = await p.count('plank');
        if (have < 54) await p.make('plank', Math.ceil((54 - have) / 4), true);
        await ensure('hatch');
        // Two posts and a small canopy beside the sunny sleeping patch.
        for (const [x, z] of [
          [-5, -237],
          [-2, -237],
        ])
          for (let y = 22; y < 25; y++) await build('plank', x, y, z);
        for (let x = -5; x <= -2; x++)
          for (let z = -237; z <= -235; z++) await build('plank', x, 25, z);
        await ensure('home_bed');
        await build('home_bed', -4, 22, -236);
        await build('hatch', -4, 22, -235);
        await p.walk({ x: -8.5, y: 22, z: -237.5 }, 0.25);
        await p.shot('earned-shelter-outside');
        const hatch = await part('hatch');
        await p.walk({ x: -3.5, y: 22, z: -235.7 });
        await p.interaction('placeable:' + hatch.id, () =>
          p.page.evaluate((id) => window.__game.view.game.systems.machines.hatchOpen(id), hatch.id),
        );
      },
      (s) => flag(s, 'farm.rope.built'),
    );
    await step(
      'dry-lamp-trap',
      async () => {
        await p.make('chest');
        await p.make('collector_chest');
        await build('collector_chest', -8, 22, -235);
        await build('lamp', -8, 23, -235);
        await p.wait((s) => s.farms.find((f) => f.id === 'dust')?.built, 'dry trap');
      },
      (s) => s.farms.find((f) => f.id === 'dust')?.built === true,
    );
    await step(
      'natural-rope-and-wax',
      async () => {
        await p.walk({ x: -3.5, y: 22, z: -233.5 });
        await p.wait(
          async () => (await p.count('vine_rope')) > 2,
          'actual rope pickup',
          25 * 60 * 1000,
        );
        await p.walk({ x: 16.5, y: 22, z: -230.5 });
        await p.wait(
          async () => (await p.count('wax')) > 0,
          'natural bee wax pickup',
          25 * 60 * 1000,
        );
      },
      async () => (await p.count('wax')) > 0 && (await p.count('vine_rope')) > 2,
    );
    await p.continueAt('middle-farm');
    await step(
      'natural-glow-dust',
      async () => {
        await p.walk({ x: -7.5, y: 22, z: -237.5 });
        let checkpoint = Date.now();
        await p.wait(
          async () => {
            const n = await p.page.evaluate(() => {
              const g = window.__game.view.game;
              return (
                g.systems.inventory.count('glow_dust') +
                g.systems.machines
                  .parts()
                  .filter((q) => q.kind === 'collector_chest')
                  .reduce(
                    (n, q) =>
                      n +
                      (g.systems.machines.chest(q.id) ?? [])
                        .filter((s) => s.id === 'glow_dust')
                        .reduce((m, s) => m + s.count, 0),
                    0,
                  )
              );
            });
            if (Date.now() - checkpoint > 30000) {
              checkpoint = Date.now();
              await p.save('near-dust-' + Date.now());
              console.log('Earned natural glow dust observed: ' + n);
            }
            return n >= 22;
          },
          '22 actual night dust',
          80 * 60 * 1000,
        );
        const chest = await part('collector_chest');
        await p.walk({ x: chest.x + 0.5, y: chest.y, z: chest.z - 0.7 });
        await p.interaction('placeable:' + chest.id, () =>
          p.page.locator('[data-panel="collector"]').isVisible(),
        );
        await p.shot('earned-collector-first');
        await p.click('[data-key="take-all"]');
        await p.shot('earned-collector-last');
        await p.press('Escape');
      },
      async () => (await p.count('glow_dust')) >= 22,
    );
    await step(
      'sensor-responds-to-collector',
      async () => {
        await ensure('sensor');
        await ensure('switch_lamp');
        await p.make('chest');
        await p.make('collector_chest');
        await build('collector_chest', -7, 22, -219);
        await build('sensor', -7, 22, -218);
        await build('switch_lamp', -8, 22, -218);
        const sensor = await part('sensor'),
          lamp = await part('switch_lamp');
        await p.walk({ x: -6.5, y: 22, z: -216.7 });
        await p.interaction('placeable:' + sensor.id, () =>
          p.page.evaluate(
            (id) => window.__game.view.game.systems.machines.sensor(id) === 'good',
            sensor.id,
          ),
        );
        await p.wait(
          (s) => s.parts.find((q) => q.id === lamp.id)?.state === 'working',
          'goods turn lamp on',
        );
        await p.shot('earned-sensor-on');
        await p.walk({ x: -6.5, y: 22, z: -219.7 });
        const chest = await p.page.evaluate(() =>
          window.__game.view.game.systems.placeables
            .all()
            .find((q) => q.kind === 'collector_chest' && q.x === -7),
        );
        await p.interaction('placeable:' + chest.id, () =>
          p.page.locator('[data-panel="collector"]').isVisible(),
        );
        await p.click('[data-key="take-all"]');
        await p.press('Escape');
        await p.wait(
          (s) => s.parts.find((q) => q.id === lamp.id)?.state !== 'working',
          'collection turns connected lamp off',
        );
        await p.shot('earned-sensor-off');
      },
      (s) => flag(s, 'step.lights.sensors'),
    );
    await step(
      'lit-ring-dark-bait-and-holt',
      async () => {
        await p.make('lamp', 5);
        await p.make('lantern', 5);
        for (const [x, z] of [
          [-25, -246],
          [-22, -246],
          [-19, -246],
          [-16, -246],
          [-13, -246],
        ])
          await build('lamp', x, 22, z);
        for (const [x, z] of [
          [-23, -242],
          [-26, -238],
          [-20, -236],
          [-23, -232],
          [-4, -239],
        ])
          await build('lantern', x, 22, z);
        await p.wait(
          (s) => s.residents.some((q) => q.who === 'holt' && q.job === 'lamps' && q.glad),
          'Holt lamps job',
        );
        await aroundCampToHolt(p);
        await p.interaction('npc:holt', () =>
          p.page.locator('[data-key="home:card:holt"]').isVisible(),
        );
        await p.shot('earned-holt-first');
        await p.shot('earned-holt-last');
        await p.press('Escape');
      },
      (s) => flag(s, 'settler.holt') && s.farms.find((f) => f.id === 'copper')?.living === true,
    );
    await step(
      'second-ledger',
      async () => {
        const hall = await p.page.evaluate(
          () => window.__game.view.game.systems.region.place('town.hall').at,
        );
        await p.walk({ x: hall.x + 2.5, y: hall.y, z: hall.z });
        await p.interaction('goods:ledger', () =>
          p.page.locator('.gd-ledger:not([hidden])').isVisible(),
        );
        await p.click('[data-key="section:lamphouse"]');
        await p.page.locator('.gd-page [data-key="deliver"]').scrollIntoViewIfNeeded();
        await p.shot('earned-ledger-first');
        await p.click('[data-key="deliver"]');
        await p.page.locator('.gd-page [data-key="deliver"]').scrollIntoViewIfNeeded();
        await p.shot('earned-ledger-last');
        await p.press('Escape');
        await p.wait((s) => flag(s, 'quest.lights.done'), 'Light done');
      },
      (s) => flag(s, 'quest.lights.done'),
    );
    await step(
      'home',
      async () => {
        const at = await p.page.evaluate(
          () => window.__game.view.game.systems.region.place('grant.center').at,
        );
        await p.walk(at, 1);
      },
      (s) => flag(s, 'quest.lights.done'),
    );
    await p.continueAt('final-home');
    const final = JSON.parse(await p.save('earned-lights'));
    assertLightsBoundary(initial, final, true);
    const scopes = JSON.parse(readFileSync(resolve(out, 'transactions.json'), 'utf8'));
    const audit = scopes.map((s) =>
      auditLightsConservation(JSON.parse(s.input), JSON.parse(s.final), s.rows),
    );
    p.write('independent-audit.json', {
      pass: true,
      scopes: audit,
      previous: recovery?.dir ?? null,
      input: sha256(recovery?.raw ?? raw),
    });
  });
}
