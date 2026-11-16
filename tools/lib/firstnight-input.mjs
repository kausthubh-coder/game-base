// Follow a moving camera with ordinary mouse input, and never hold on another block.
export async function holdFirstnightBlock(page, cell, record = () => {}, timeout = 5000) {
  let down = false;
  const until = Date.now() + timeout;
  try {
    while (Date.now() < until) {
      const sample = await page.evaluate(([x,y,z]) => {
        const view = window.__game.view, aim = view.aim;
        return { block: view.game.world.getBlock(x,y,z), aim: aim && [aim.x,aim.y,aim.z], at: view.project(x+.5,y+.99,z+.5) };
      }, cell);
      record({ type: 'held-block-observation', cell, ...sample });
      if (sample.block === 0) return;
      const exact = sample.aim?.length === 3 && sample.aim.every((value,index) => value === cell[index]);
      if (!exact && down) { await page.mouse.up(); down = false; }
      if (!sample.at) throw Error('block moved outside the view: ' + cell);
      if (exact && !down) { await page.mouse.down(); down = true; }
      await page.mouse.move(sample.at.x, sample.at.y);
      await page.waitForTimeout(50);
    }
    throw Error('timed out holding the requested block: ' + cell);
  } finally { await page.mouse.up(); }
}
