/** Wait for the lens to stop moving before using a projected world coordinate. Land loading alone does not settle it. */
export async function cameraStill(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    let previous, stable = 0;
    const timeout = setTimeout(() => reject(new Error('camera did not settle')), 30000);
    const sample = () => {
      const c = window.__game.view.ctx.camera;
      const next = [...c.matrixWorld.elements, ...c.projectionMatrix.elements];
      stable = previous && next.every((v, i) => Math.abs(v - previous[i]) < 0.000001) ? stable + 1 : 0;
      previous = next;
      if (stable >= 3) { clearTimeout(timeout); resolve(); }
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}
