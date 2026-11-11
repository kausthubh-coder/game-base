// Browser inputs use the running online body. Never advance the local rules or teleport it.
export async function walkTo(page, goal, within = 1.5) {
  const end = Date.now() + 60000;
  let previous = null,
    stuck = 0;
  try {
    while (Date.now() < end) {
      const q = await page.evaluate(
        ({ goal, within }) => {
          const g = window.__game,
            p = g.view.game.player.pos;
          const distance = Math.hypot(goal.x - p.x, goal.z - p.z);
          if (distance < within) return { done: true };
          const route =
            g.view.game.systems.nav.toward(p, { ...goal, y: goal.y ?? p.y }, 4000) ?? [];
          const target = route.find((t) => Math.hypot(t.x - p.x, t.z - p.z) > 0.5) ?? goal;
          const dx = target.x - p.x,
            dz = target.z - p.z,
            len = Math.hypot(dx, dz) || 1,
            yaw = g.view.camera.yaw;
          return {
            x: p.x,
            z: p.z,
            f: (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / len,
            r: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len,
          };
        },
        { goal, within },
      );
      if (q.done) return;
      for (const [key, on] of [
        ['KeyW', q.f > 0.38],
        ['KeyS', q.f < -0.38],
        ['KeyD', q.r > 0.38],
        ['KeyA', q.r < -0.38],
      ])
        await page.keyboard[on ? 'down' : 'up'](key);
      stuck = previous && Math.hypot(previous.x - q.x, previous.z - q.z) < 0.05 ? stuck + 1 : 0;
      if (stuck === 10) await page.keyboard.press('Space');
      if (stuck > 40) throw Error('Walking is blocked before the target');
      previous = q;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error('Walking did not reach the target in a minute');
  } finally {
    for (const key of ['KeyW', 'KeyS', 'KeyD', 'KeyA']) await page.keyboard.up(key);
  }
}
export async function supply(page, item, count, server, worldId) {
  const inventory = () =>
    page.evaluate((id) => window.__game.view.game.systems.inventory.count(id), item);
  if ((await inventory()) >= count) return;
  if (server) {
    await server.dev(worldId, { do: 'give', item, count });
  } else if (item === 'plank') {
    // On deployed copies obtain the fixtures through the real rules, with no dev endpoint.
    for (let attempt = 0; attempt < 12 && (await inventory()) < count; attempt++) {
      const logs = await page.evaluate(() =>
        window.__game.view.game.systems.inventory.count('oak_log'),
      );
      if (logs) {
        await page.evaluate(() => window.__game.view.game.systems.crafting.make('plank'));
        await page.waitForFunction(
          (n) => window.__game.view.game.systems.inventory.count('oak_log') < n,
          logs,
        );
        continue;
      }
      const tree = await page.evaluate(() => {
        const g = window.__game,
          p = g.state().player;
        return g.view.game.systems.trees
          .all()
          .filter(
            (t) =>
              t.standing && !t.protected && !g.view.game.systems.region.isProtected(t.x, t.y, t.z),
          )
          .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      });
      if (!tree) throw Error('No unprotected tree available for live fixtures');
      await walkTo(page, { x: tree.x + 0.5, y: tree.y, z: tree.z + 0.5 }, 2.5);
      await page.evaluate((t) => {
        const g = window.__game,
          s = g.view.game.systems,
          hit = { x: t.x, y: t.y, z: t.z, nx: 1, ny: 0, nz: 0, id: 0, distance: 0 };
        window.__fixtureStop = g.view.onSimStep((dt) =>
          s.actions.hold({ hit, held: s.inventory.held(), button: 'primary' }, dt),
        );
      }, tree);
      try {
        await page.waitForFunction(
          () => window.__game.view.game.systems.inventory.count('oak_log') > 0,
          undefined,
          { timeout: 30000 },
        );
      } finally {
        await page.evaluate(() => {
          window.__fixtureStop?.();
          delete window.__fixtureStop;
        });
      }
    }
  } else if (['workbench', 'chest'].includes(item)) {
    await supply(page, 'plank', item === 'workbench' ? 4 : 8, server, worldId);
    await page.evaluate((id) => window.__game.view.game.systems.crafting.make(id), item);
  } else throw Error(`No gameplay fixture recipe for ${item}`);
  await page.waitForFunction(
    ({ item, count }) => window.__game.view.game.systems.inventory.count(item) >= count,
    { item, count },
    { timeout: 30000 },
  );
}
