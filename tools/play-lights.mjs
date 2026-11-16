import { readLightsLayout, lightsLayoutIssues } from './chapters/lights-layout.mjs';
import { cameraStill } from './play/wait.mjs';
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { installReplayDriver } from './workflow/replay.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { observeLights } from './lights-observation.mjs';
import { sha256 } from './chapters/lights-contract.mjs';
const must = (v, m) => {
  if (!v) throw Error(m);
};
export async function lightsSession(
  {
    raw,
    out,
    dist = 'dist-gallery-resume-hud',
    quality = 'high',
    width = 1366,
    height = 768,
    diagnostic = false,
  },
  action,
) {
  out = resolve(out);
  if (existsSync(out) && readdirSync(out).length)
    throw Error('preserve old output; select an empty directory');
  mkdirSync(out, { recursive: true });
  const samples = [],
    errors = [],
    inputs = [],
    scopes = [];
  let server, browser, page, timer, callbacks;
  const port = 5795;
  const write = (name, data) =>
    writeFileSync(
      resolve(out, name),
      typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    );
  const record = (data) => {
    inputs.push({ at: Date.now(), ...data });
    appendFileSync(resolve(out, 'inputs.ndjson'), JSON.stringify(inputs.at(-1)) + '\n');
  };
  async function probe(admit = false) {
    const s = await sample();
    samples.push(s);
    write('resources.json', samples);
    if (admit) must(canStartHeavy(s, 0), 'resource admission held: ' + JSON.stringify(s));
  }
  const read = () =>
    page.evaluate(() => {
      const g = window.__game,
        sys = g.view.game.systems;
      return {
        ...g.state(),
        farms: sys.farms.all(),
        parts: sys.machines.parts(),
        homes: sys.settlement.homes(),
        residents: sys.settlement.settlers().map((who) => sys.settlement.settler(who)),
      };
    });
  const wait = async (test, label, timeout = 20000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const s = await read();
      must(!s.viewErrors.length && !Object.keys(s.failed).length, 'runtime errors');
      if (await test(s)) return s;
      await page.waitForTimeout(120);
    }
    throw Error('Timed out: ' + label);
  };
  const press = async (key) => {
    record({ type: 'press', key });
    await page.keyboard.press(key);
  };
  const click = async (selector) => {
    record({ type: 'click', selector });
    await page.locator(selector).click();
  };
  async function driver() {
    if (!(await page.evaluate(() => typeof window.__replayInput === 'function'))) {
      const held = new Set();
      await page.exposeFunction('__replayInput', async (key, down) => {
        const code = {
          w: 'KeyW',
          a: 'KeyA',
          s: 'KeyS',
          d: 'KeyD',
          shift: 'ShiftLeft',
          space: 'Space',
        }[key];
        must(code, 'known input');
        if (held.has(code) === down) return;
        record({ type: down ? 'down' : 'up', key: code });
        await page.keyboard[down ? 'down' : 'up'](code);
        down ? held.add(code) : held.delete(code);
      });
      await page.exposeFunction('__lightsAction', async (kind, target) => callbacks[kind](target));
    }
    await page.evaluate(installReplayDriver, { mode: 'realtime' });
  }
  async function target(at, reach, actions) {
    callbacks = actions;
    try {
      await page.evaluate(
        async ({ at, reach }) =>
          window.__replay.act(at, {
            reach,
            aim: (t) => window.__lightsAction('aim', t),
            press: () => window.__lightsAction('press'),
            done: () => window.__lightsAction('done'),
          }),
        { at, reach },
      );
    } finally {
      callbacks = null;
    }
  }
  async function walk(at, within = 0.25, authored = false) {
    must([at.x, at.y, at.z].every(Number.isFinite), 'authored height required');
    record({ type: 'walk', at, within, authored });
    const result = await page.evaluate(
      async ({ at, within, authored }) =>
        window.__replay.walk(at, { within, seconds: 90, authored }),
      { at, within, authored },
    );
    must(result.ok, 'walking failed ' + JSON.stringify({ at, result }));
  }
  async function interaction(id, done) {
    await wait(
      async () =>
        page.evaluate((id) => window.__game.view.game.systems.interact.nearest()?.id === id, id),
      'nearest ' + id,
      3000,
    );
    const t = await page.evaluate((id) => {
      const t = window.__game.view.game.systems.interact.nearest();
      return t ? { id: t.id, at: t.pos(), reach: t.radius, prompt: t.prompt() } : null;
    }, id);
    must(t?.id === id, 'exact interact target ' + id + ', observed ' + JSON.stringify(t));
    await target(t.at, t.reach, {
      aim: async (at) => {
        const p = await page.evaluate((at) => window.__game.view.project(at.x, at.y, at.z), at);
        if (p) await page.mouse.move(p.x, p.y);
      },
      press: () => press('KeyE'),
      done: async () => {
        await wait(done, id);
        return true;
      },
    });
  }
  async function equip(id) {
    let i = await page.evaluate(
      (id) => window.__game.view.game.systems.inventory.slots.findIndex((s) => s?.id === id),
      id,
    );
    must(i >= 0, 'missing earned ' + id);
    if (i >= 9) {
      await press('KeyI');
      await click(`[data-key="slot:${i}"]`);
      await click('[data-key="slot:8"]');
      await press('Escape');
      i = 8;
    }
    await press('Digit' + (i + 1));
    await wait((s) => s.held === id, 'equip ' + id);
  }
  async function make(id, n = 1, hand = false) {
    const before = await count(id);
    if (hand) {
      await press('KeyI');
      await click('[data-key="tab:hand"]');
      await click(`[data-key="recipe:${id}"]`);
    } else {
      await walk({ x: -1.5, y: 22, z: -222.5 });
      await interaction('placeable:workbench:1', async () =>
        page.locator('.gu-stage-make:not([hidden])').isVisible(),
      );
    }
    for (let i = 0; i < n; i++) await click(`[data-key="make:${id}"]`);
    await press('Escape');
    must((await count(id)) > before, 'craft observed ' + id);
  }
  const count = (id) =>
    page.evaluate((id) => window.__game.view.game.systems.inventory.count(id), id);
  // Right-button placement uses the current pointer. The targeted action verifies the resulting occupied cell.
  async function build(id, x, y, z) {
    await equip(id);
    await walk({ x: x + 0.5, y: 22, z: z + 2.5 });
    await target({ x: x + 0.5, y: y - 0.05, z: z + 0.5 }, 5, {
      aim: async () => {
        for (let turn = 0; turn < 8; turn++) {
          await cameraStill(page);
          for (const [dx, dy, dz] of [
            [0, -1, 0],
            [-1, 0, 0],
            [1, 0, 0],
            [0, 0, -1],
            [0, 0, 1],
          ])
            for (const offset of [0.49, 0.3, 0.45]) {
              const support = { x: x + dx, y: y + dy, z: z + dz };
              const p = await page.evaluate(
                ({ support, dx, dy, dz, offset }) =>
                  window.__game.view.project(
                    support.x + 0.5 - dx * offset,
                    support.y + 0.5 - dy * offset,
                    support.z + 0.5 - dz * offset,
                  ),
                { support, dx, dy, dz, offset },
              );
              if (p) await page.mouse.move(p.x, p.y);
              await page.waitForTimeout(100);
              const a = (await read()).aim;
              if (a?.x === support.x && a.y === support.y && a.z === support.z) {
                const normal = await page.evaluate(() =>
                  window.__game.view.aim
                    ? {
                        x: window.__game.view.aim.nx,
                        y: window.__game.view.aim.ny,
                        z: window.__game.view.aim.nz,
                      }
                    : null,
                );
                if (normal?.x === -dx && normal.y === -dy && normal.z === -dz) return;
              }
            }
          await press('KeyQ');
        }
        throw Error('cannot aim support ' + JSON.stringify({ x, y, z, aim: (await read()).aim }));
      },
      press: async () => {
        record({ type: 'right-button', id, x, y, z });
        await page.mouse.down({ button: 'right' });
        await page.mouse.up({ button: 'right' });
      },
      done: async () => {
        await wait(
          async () =>
            page.evaluate(
              ({ id, x, y, z }) =>
                window.__game.view.game.systems.placeables.at(x, y, z)?.kind === id ||
                (id === 'plank' && window.__game.block(x, y, z).key === 'oak_plank') ||
                (id === 'lamp' && window.__game.block(x, y, z).key === 'lamp'),
              { id, x, y, z },
            ),
          'placed ' + id,
        );
        return true;
      },
    });
  }
  async function shot(name) {
    write(name + '.json', await read());
    write(name + '.costs.json', [{ costs: await page.evaluate(() => window.__game.costs()) }]);
    const frame = await page.evaluate(readLightsLayout, {
      hatch: name === 'make-last',
      deliver: name.includes('ledger-'),
    });
    write(name + '.layout.json', frame);
    await page.screenshot({ path: resolve(out, name + '.png') });
    must(
      lightsLayoutIssues(frame).length === 0,
      'layout ' + name + ': ' + lightsLayoutIssues(frame).join('; '),
    );
  }
  async function observations() {
    const data = await page.evaluate(() => window.__lightsObservation.rows);
    scopes.at(-1).rows = data;
    write('transactions.json', scopes);
    return data;
  }
  async function save(name) {
    record({ type: 'public-save', method: '__game.save' });
    const capture = await page.evaluate(async () => {
      if (!(await window.__game.save())) throw Error('public save failed');
      return {
        raw: localStorage.getItem('greenhollow.save'),
        rows: window.__lightsObservation.rows,
      };
    });
    const bytes = capture.raw;
    write(name + '.save.json', bytes);
    scopes.at(-1).final = bytes;
    scopes.at(-1).rows = capture.rows;
    write('transactions.json', scopes);
    return bytes;
  }
  async function load(bytes) {
    record({ type: 'raw-local-import', diagnostic, sha256: sha256(bytes) });
    await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
    await page.evaluate((bytes) => localStorage.setItem('greenhollow.save', bytes), bytes);
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await page.evaluate(observeLights);
    scopes.push({ input: bytes, rows: [] });
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await wait((s) => s.started && !s.player.busy, 'Continue');
    await driver();
  }
  async function continueAt(name) {
    await press('Escape');
    await wait((s) => s.paused, 'pause');
    const before = await save(name);
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await page.evaluate(observeLights);
    scopes.push({ input: before, rows: [] });
    await page.evaluate(() =>
      document.addEventListener(
        'click',
        () =>
          queueMicrotask(async () => {
            await window.__game.save();
            window.__lightsContinued = localStorage.getItem('greenhollow.save');
          }),
        { once: true },
      ),
    );
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await page.waitForFunction(() => !!window.__lightsContinued);
    const after = await page.evaluate(() => window.__lightsContinued);
    write(name + '-continued.save.json', after);
    const a = JSON.parse(before),
      b = JSON.parse(after);
    for (const k of [
      'inventory',
      'bench',
      'placeables',
      'settlement',
      'quests',
      'goods',
      'crops',
      'ruins',
    ])
      must(
        JSON.stringify(a.game.systems[k]) === JSON.stringify(b.game.systems[k]),
        'Continue changed ' + k,
      );
    must(JSON.stringify(a.world) === JSON.stringify(b.world), 'Continue world changed');
    await driver();
    await shot(name + '-continued');
  }
  try {
    await probe(true);
    timer = setInterval(() => probe().catch(() => {}), 30000);
    server = spawn('bun', ['tools/serve.mjs', dist, String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((ok, fail) => {
      server.stdout.once('data', ok);
      server.once('error', fail);
      server.once('exit', (c) => fail(Error('server exited ' + c)));
    });
    write('owned-pids.json', { server: server.pid });
    await probe(true);
    browser = await launchChrome();
    write('renderer.json', { renderer: browser.gameRenderer, dist, diagnostic });
    page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await load(raw);
    await action({
      page,
      read,
      wait,
      press,
      click,
      walk,
      interaction,
      equip,
      make,
      build,
      count,
      shot,
      save,
      load,
      continueAt,
      observations,
      write,
    });
    must(!errors.length, errors.join('\n'));
    write('result.json', { pass: true, diagnostic, errors });
    return out;
  } catch (error) {
    write('result.json', { pass: false, diagnostic, error: String(error.stack ?? error), errors });
    if (page) {
      await save(diagnostic ? 'last-diagnostic' : 'last-earned-checkpoint').catch(() => {});
      await shot('failed').catch(() => {});
    }
    throw error;
  } finally {
    clearInterval(timer);
    await browser?.close();
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise((r) => server.once('exit', r));
    }
  }
}
