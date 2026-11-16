// Verified with real keys from the preserved Holt diagnostic failure.
// The block nav grid's first cell can lie inside the rotated camp tent's clearance.
// These authored floor-height legs go around its west side and the watch post.
export async function aroundCampToHolt(p) {
  for (const at of [
    { x: -25.5, y: 22, z: -231.5 },
    { x: -25.5, y: 22, z: -222.5 },
    { x: -1.5, y: 22, z: -222.5 },
  ])
    await p.walk(at, 0.35, true);
  const at = await p.page.evaluate(() => window.__game.view.game.systems.people.get('holt').pos);
  await p.walk({ x: at.x, y: at.y, z: at.z }, 2);
}
