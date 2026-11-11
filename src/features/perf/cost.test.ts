import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { createCostMeter } from './cost.view.ts';

/**
 * A renderer as far as the meter can tell: counters, a list of programs, and the one method every draw goes
 * through. A draw costs one call and the triangles its geometry says. A material's first draw makes a program.
 */
function fakeRenderer() {
  const compiled = new Set<THREE.Material>();
  const info = { render: { calls: 0, triangles: 0 }, programs: [] as object[], reset() { this.render.calls = this.render.triangles = 0; } };
  const renderer = {
    info,
    renderBufferDirect(_camera: unknown, _scene: unknown, geometry: THREE.BufferGeometry, material: THREE.Material) {
      if (!compiled.has(material)) { compiled.add(material); info.programs.push({}); }
      info.render.calls++;
      info.render.triangles += geometry.userData.triangles as number;
    },
  };
  return renderer as unknown as THREE.WebGLRenderer & typeof renderer;
}

function thing(name: string, triangles: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.userData.triangles = triangles;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

function setUp() {
  const renderer = fakeRenderer(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const meter = createCostMeter(renderer, scene);
  /** Draws an object in the scene's pass, or in the shadow pass, which hands its draws no scene. */
  const draw = (object: THREE.Mesh, shadow = false): void => {
    // The renderer's types say a draw always has a scene and a group. The shadow pass hands it neither.
    (renderer.renderBufferDirect as (...args: unknown[]) => void)(camera, shadow ? null : scene, object.geometry, object.material, object, null);
  };
  /** The end of a frame, as the perf meter does it. */
  const endFrame = (): void => { meter.latch(); renderer.info.reset(); };
  return { renderer, scene, meter, draw, endFrame };
}

describe('cost by feature', () => {
  test('the rows add up to the renderer totals, with the shadow pass counted apart', () => {
    const { scene, meter, draw, endFrame } = setUp();
    meter.names({ grass: 'grass', 'painted-trees': 'trees', 'great-oak': 'trees' });
    const grass = thing('grass', 90000), trees = new THREE.Group(), oak = thing('great-oak', 4000), leaf = thing('', 700), beam = thing('waypoint', 12);
    trees.name = 'painted-trees';
    trees.add(leaf);
    scene.add(grass, trees, oak, beam);
    draw(leaf, true); draw(oak, true);
    draw(grass); draw(leaf); draw(oak); draw(beam);
    endFrame();
    const report = meter.read();
    expect(report.total).toEqual({ drawCalls: 6, triangles: 4700 + 90000 + 4700 + 12 });
    expect(report.sum).toEqual(report.total);
    expect(report.addsUp).toBe(true);
    expect(report.features).toEqual([
      { feature: 'grass', drawCalls: 1, triangles: 90000, shadowCalls: 0, shadowTriangles: 0 },
      { feature: 'trees', drawCalls: 4, triangles: 9400, shadowCalls: 2, shadowTriangles: 4700 },
      // A top-level object with no name in the table is listed by its own name, never lumped away.
      { feature: 'other: waypoint', drawCalls: 1, triangles: 12, shadowCalls: 0, shadowTriangles: 0 },
    ]);
  });

  test('each frame is counted from zero, whoever resets the renderer counters', () => {
    const { renderer, scene, meter, draw, endFrame } = setUp();
    const grass = thing('grass', 100);
    meter.tag(grass, 'grass');
    scene.add(grass);
    draw(grass); draw(grass);
    endFrame();
    expect(meter.read().total.drawCalls).toBe(2);
    // Something drew between two frames, a far tree photographed for instance, and the frame's owner reset the counters.
    draw(grass);
    renderer.info.reset();
    draw(grass);
    endFrame();
    expect(meter.read()).toMatchObject({ total: { drawCalls: 1, triangles: 100 }, sum: { drawCalls: 1, triangles: 100 }, addsUp: true });
    // A frame that draws nothing reads as nothing.
    endFrame();
    expect(meter.read()).toMatchObject({ total: { drawCalls: 0, triangles: 0 }, features: [], addsUp: true });
  });

  test('a draw outside the scene is the final picture, and an object that joins the scene later takes its feature', () => {
    const { scene, meter, draw, endFrame } = setUp();
    meter.names({ 'painted-trees': 'trees' });
    const pass = thing('', 1), tree = thing('painted-trees', 500);
    draw(pass); draw(tree);
    endFrame();
    expect(meter.read().features).toEqual([{ feature: 'final picture', drawCalls: 2, triangles: 501, shadowCalls: 0, shadowTriangles: 0 }]);
    scene.add(tree);
    draw(pass); draw(tree);
    endFrame();
    expect(meter.read().features.map((f) => [f.feature, f.triangles])).toEqual([['trees', 500], ['final picture', 1]]);
  });

  test('a program made in the middle of a draw is counted, with the feature that caused it', () => {
    const { scene, meter, draw } = setUp();
    meter.names({ grass: 'grass', town: 'town' });
    const grass = thing('grass', 10), town = thing('town', 10), lamp = thing('town', 10);
    scene.add(grass, town, lamp);
    draw(grass); draw(grass); draw(town);
    expect(meter.compiles()).toEqual({ programs: 2, inDraw: 2, latest: ['grass', 'town'] });
    // A warm-up draws in order to make programs: those are not stalls.
    meter.quietly(() => draw(lamp));
    expect(meter.compiles()).toEqual({ programs: 3, inDraw: 2, latest: ['grass', 'town'] });
  });

  test('dispose hands the renderer its own method back', () => {
    const renderer = fakeRenderer(), own = renderer.renderBufferDirect;
    const meter = createCostMeter(renderer, new THREE.Scene());
    expect(renderer.renderBufferDirect).not.toBe(own);
    meter.dispose();
    expect(renderer.renderBufferDirect).toBe(own);
  });
});
