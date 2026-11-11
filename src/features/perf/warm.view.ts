// Shader warm-up. A material's shader program is compiled the first time something that wears it is drawn,
// and on a weak graphics chip that stalls the frame: a hitch at the first sight of the town, the first lamp at
// dusk, the first time build mode opens. Warm-up compiles them before they are seen.
//
// `start()` is for the time the start card is up. It compiles every material in the scene, shown or hidden,
// in view or not, with `renderer.compileAsync`, which lets the graphics driver work in the background while
// the page stays live. Then it draws one frame of the whole scene into a single pixel, with everything shown
// and nothing culled. That frame goes down the renderer's real path, so it makes whatever `compileAsync`
// cannot reach (the shadow pass has depth programs of its own) and sends every texture to the graphics chip.
// `finish()` asks for that frame at once, for a start that cannot wait: it blocks, but before the first
// picture of play and not in the middle of it.
//
// After that it watches for what arrives later: a chunk of land from the worker, a model that finished
// loading. A material it has not seen starts compiling in the background, and whatever wears it is held
// back, by its layers, until the program is ready. Then it is drawn alone into the one pixel, for its shadow
// program, and let go. It shows a frame or two late, with no stall.
//
// All of it runs at the start of the scene's own render (`scene.onBeforeRender`), before the renderer lists
// what to draw. There the renderer is already aimed where the scene is drawn, straight to the screen or off
// screen for a final pass, and a program depends on which. So the programs made are the ones a frame asks for.
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import type { CostMeter } from './cost.view.ts';

export interface WarmOptions {
  /** The cost meter, so the programs warm-up makes on purpose are not counted as stalls. */
  costs?: CostMeter;
  /** The longest a newly arrived thing is held back while its program compiles, in milliseconds. 1500 by default. */
  holdMost?: number;
}

export interface WarmStats {
  /** `cold` before the first warm-up, `warming` while the driver compiles in the background, `warm` after. */
  state: 'cold' | 'warming' | 'warm';
  /** Whole-scene warm-ups done: one at the start, and one more each time the picture moves on or off screen. */
  runs: number;
  /** Materials that arrived after the warm-up and were compiled in the background. */
  late: number;
  /** Things held back right now while their program compiles. */
  held: number;
}

export interface Warm {
  /** Compiles everything in the scene in the background, from the next frame on. Resolves when all of it is ready to draw. */
  start(): Promise<void>;
  /** Compiles what is not ready yet at the start of the next frame, before any of it is drawn. */
  finish(): void;
  readonly stats: Readonly<WarmStats>;
  dispose(): void;
}

type Drawable = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;
const drawable = (o: THREE.Object3D): o is Drawable =>
  (o as THREE.Mesh).isMesh === true || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true || (o as THREE.Sprite).isSprite === true;

export function createWarm(ctx: ViewContext, options: WarmOptions = {}): Warm {
  const { renderer, scene } = ctx;
  const holdMost = options.holdMost ?? 1500;
  /** Stands in for the off-screen picture: one pixel is enough to make every program. */
  const pixel = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const stats: WarmStats = { state: 'cold', runs: 0, late: 0, held: 0 };

  /** What was asked for and not done yet. */
  let wanted: 'nothing' | 'background' | 'now' = 'nothing';
  /** True once `compileAsync` says every program is ready. */
  let compiled = false;
  /** Whether the scene was off screen when it was last warmed. Its programs are no use the other way round. */
  let warmedOffScreen = false;
  let done: (() => void)[] = [];

  /** Materials seen so far. One not in here is new. */
  const seen = new WeakSet<THREE.Material>();
  /** Materials compiling in the background, and when each began. */
  const compiling = new Map<THREE.Material, number>();
  /** What is held back, and the layers each had. */
  const heldObjects: THREE.Object3D[] = [], heldLayers: number[] = [];

  const programOf = (material: THREE.Material): { isReady(): boolean } | undefined =>
    (renderer.properties.get(material) as { currentProgram?: { isReady(): boolean } }).currentProgram;

  /** An object's materials by index: most have one. Undefined past the last. This runs every frame, so nothing here allocates. */
  function materialAt(object: Drawable, index: number): THREE.Material | undefined {
    const material = object.material as THREE.Material | THREE.Material[] | undefined;
    return Array.isArray(material) ? material[index] : index === 0 ? material : undefined;
  }

  function seeAll(): void {
    scene.traverse((o) => {
      if (drawable(o)) for (let i = 0, material; (material = materialAt(o, i)); i++) seen.add(material);
    });
  }

  // ---------------------------------------------------------------- one frame of everything, into one pixel
  const shownAgain: THREE.Object3D[] = [], culledAgain: THREE.Object3D[] = [], litAgain: THREE.Object3D[] = [];
  const shadows: THREE.LightShadow[] = [];
  const lit = new Set<THREE.Object3D>();
  const viewport = new THREE.Vector4(), scissor = new THREE.Vector4();
  let drawing = false;
  /** True once the scene has been drawn: from then on the renderer knows its lights. */
  let lightsKnown = false;
  const NOTHING: readonly never[] = [];

  /** Draws the scene as it stands into one pixel of wherever the scene is really drawn. */
  function drawPixel(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void {
    drawing = true;
    try {
      if (target !== null) {
        renderer.setRenderTarget(pixel);
        renderer.render(scene, camera);
      } else {
        // Straight to the screen: the one pixel is the canvas's own corner, and the frame that follows draws over it.
        const test = renderer.getScissorTest();
        renderer.getViewport(viewport);
        renderer.getScissor(scissor);
        renderer.setViewport(0, 0, 1, 1);
        renderer.setScissor(0, 0, 1, 1);
        renderer.setScissorTest(true);
        try {
          renderer.render(scene, camera);
        } finally {
          renderer.setViewport(viewport);
          renderer.setScissor(scissor);
          renderer.setScissorTest(test);
        }
      }
    } finally {
      drawing = false;
      renderer.setRenderTarget(target);
      // The frame's own count of draw calls starts after this.
      renderer.info.reset();
    }
  }

  function drawEverything(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void {
    // The shadow pass comes before the renderer counts the frame's lights, so it uses the count of the frame
    // before. On the scene's very first draw that is none, and its depth programs would be made for a scene
    // with no light and never used again. A draw of the lights alone, with nothing to light, counts them first.
    if (!lightsKnown) drawAlone(NOTHING, NOTHING, camera, target);
    lightsKnown = true;
    // A light that is switched off, or sits in something hidden, stays out: the number of lights is part of every program.
    lit.clear();
    scene.traverseVisible((o) => { if ((o as THREE.Light).isLight) lit.add(o); });
    scene.traverse((o) => {
      const light = o as THREE.DirectionalLight;
      if (light.isLight) {
        if (o.visible && !lit.has(o)) { o.visible = false; litAgain.push(o); }
        if (light.shadow) shadows.push(light.shadow);
        return;
      }
      if (!o.visible) { o.visible = true; shownAgain.push(o); }
      if (o.frustumCulled && drawable(o)) { o.frustumCulled = false; culledAgain.push(o); }
    });
    // A shadow map that is drawn every other frame is drawn now.
    for (const shadow of shadows) shadow.needsUpdate = true;
    try {
      drawPixel(camera, target);
    } finally {
      for (const o of shownAgain) o.visible = false;
      for (const o of culledAgain) o.frustumCulled = true;
      for (const o of litAgain) o.visible = true;
      // The shadow map now holds things that are hidden. The frame that follows draws it again.
      for (const shadow of shadows) shadow.needsUpdate = true;
      shownAgain.length = culledAgain.length = litAgain.length = shadows.length = 0;
    }
  }

  // ---------------------------------------------------------------- a few things alone, into one pixel
  /** A layer nothing else is on. The camera looks at it alone while the late arrivals are drawn. */
  const ALONE = 31;
  const aloneLights: THREE.Object3D[] = [], aloneCulled: THREE.Object3D[] = [], shadowLayers: number[] = [];

  /**
   * Draws only these objects, with the scene's lights, into the one pixel. Each is given back the layers in
   * `layers`. That makes the programs of the shadow pass for them, which `compile` does not reach.
   */
  function drawAlone(objects: readonly THREE.Object3D[], layers: readonly number[], camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void {
    const cameraLayers = camera.layers.mask;
    scene.traverseVisible((o) => {
      const light = o as THREE.DirectionalLight;
      if (!light.isLight) return;
      // A light counts when the camera can see its layer. Its shadow is drawn again in the frame that follows.
      if (o.layers.test(camera.layers)) { o.layers.enable(ALONE); aloneLights.push(o); }
      if (!light.shadow) return;
      // The shadow pass looks through the shadow camera's layers when it has any of its own, as the sky's does.
      shadows.push(light.shadow);
      shadowLayers.push(light.shadow.camera.layers.mask);
      light.shadow.camera.layers.set(ALONE);
      light.shadow.needsUpdate = true;
    });
    for (const o of objects) {
      o.layers.set(ALONE);
      if (o.frustumCulled) { o.frustumCulled = false; aloneCulled.push(o); }
    }
    camera.layers.set(ALONE);
    try {
      drawPixel(camera, target);
    } finally {
      camera.layers.mask = cameraLayers;
      for (let i = 0; i < objects.length; i++) (objects[i] as THREE.Object3D).layers.mask = layers[i] as number;
      for (const o of aloneLights) o.layers.disable(ALONE);
      for (const o of aloneCulled) o.frustumCulled = true;
      for (let i = 0; i < shadows.length; i++) {
        const shadow = shadows[i] as THREE.LightShadow;
        shadow.camera.layers.mask = shadowLayers[i] as number;
        shadow.needsUpdate = true;
      }
      aloneLights.length = aloneCulled.length = shadows.length = shadowLayers.length = 0;
    }
  }

  function warmNow(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void {
    stats.state = 'warm';
    stats.runs++;
    wanted = 'nothing';
    warmedOffScreen = target !== null;
    seeAll();
    if (options.costs) options.costs.quietly(() => drawEverything(camera, target));
    else drawEverything(camera, target);
    for (const resolve of done) resolve();
    done = [];
  }

  // ---------------------------------------------------------------- what arrives later
  function hold(object: THREE.Object3D): void {
    if (object.layers.mask === 0) return;
    heldObjects.push(object);
    heldLayers.push(object.layers.mask);
    object.layers.mask = 0;
  }

  /** True while one of the object's materials is still compiling. */
  function waits(object: THREE.Object3D): boolean {
    if (drawable(object)) for (let i = 0, material; (material = materialAt(object, i)); i++) if (compiling.has(material)) return true;
    return false;
  }

  let watchCamera: THREE.Camera = ctx.camera;
  let watchTarget: THREE.WebGLRenderTarget | null = null;

  function visit(object: THREE.Object3D): void {
    if (!drawable(object)) return;
    let fresh = false;
    for (let i = 0, material; (material = materialAt(object, i)); i++) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (programOf(material) === undefined) fresh = true;
    }
    if (fresh) {
      // The driver starts on the programs now. Each frame asks whether they are ready, this one first.
      renderer.compile(object, watchCamera, scene);
      const now = performance.now();
      for (let i = 0, material; (material = materialAt(object, i)); i++) {
        if (programOf(material) && !compiling.has(material)) { compiling.set(material, now); stats.late++; }
      }
    }
    if (compiling.size > 0 && waits(object)) hold(object);
  }

  const readyObjects: THREE.Object3D[] = [], readyLayers: number[] = [];
  const drawReady = (): void => drawAlone(readyObjects, readyLayers, watchCamera, watchTarget);

  function release(): void {
    const now = performance.now();
    for (const [material, since] of compiling) {
      const program = programOf(material);
      if (!program || program.isReady() || now - since > holdMost) compiling.delete(material);
    }
    let kept = 0;
    for (let i = 0; i < heldObjects.length; i++) {
      const object = heldObjects[i] as THREE.Object3D;
      if (waits(object)) {
        heldObjects[kept] = object;
        heldLayers[kept++] = heldLayers[i] as number;
      } else {
        readyObjects.push(object);
        readyLayers.push(heldLayers[i] as number);
      }
    }
    heldObjects.length = heldLayers.length = kept;
    if (readyObjects.length === 0) return;
    // Their programs are ready. One draw of them alone makes their shadow programs, and gives them their layers back.
    if (options.costs) options.costs.quietly(drawReady);
    else drawReady();
    readyObjects.length = readyLayers.length = 0;
  }

  // ---------------------------------------------------------------- the start of every render of the scene
  // The renderer hands a scene's hook the render target, where an object's hook gets its geometry. The types know only the second.
  type SceneHook = (this: THREE.Scene, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) => void;
  const before = scene.onBeforeRender as unknown as SceneHook;
  const hook: SceneHook = function (r, s, camera, drawnTo) {
    before.call(this, r, s, camera, drawnTo);
    // The frame of everything is a render of this scene too.
    if (drawing) return;
    const offScreen = drawnTo !== null;
    if (stats.state === 'warm') {
      // The picture moved on or off screen, as it does between low and the levels above it: every program is made again.
      if (offScreen !== warmedOffScreen) warmNow(camera, drawnTo);
    } else if (wanted === 'now' || (stats.state === 'warming' && compiled)) {
      warmNow(camera, drawnTo);
    } else if (wanted === 'background' && stats.state === 'cold' && lightsKnown) {
      // Not on the scene's very first draw: until its lights and its shadow map exist, `compile` makes programs no frame will use.
      stats.state = 'warming';
      compiled = false;
      void renderer.compileAsync(scene, camera).then(() => { compiled = true; });
    }
    if (stats.state !== 'warm') { lightsKnown = true; return; }
    watchCamera = camera;
    watchTarget = drawnTo;
    scene.traverse(visit);
    if (heldObjects.length > 0 || compiling.size > 0) release();
    stats.held = heldObjects.length;
  };
  scene.onBeforeRender = hook as unknown as THREE.Scene['onBeforeRender'];

  return {
    stats,

    start() {
      if (stats.state === 'warm') return Promise.resolve();
      if (wanted === 'nothing') wanted = 'background';
      return new Promise((resolve) => { done.push(resolve); });
    },

    finish() {
      if (stats.state !== 'warm') wanted = 'now';
    },

    dispose() {
      if ((scene.onBeforeRender as unknown) === hook) scene.onBeforeRender = before as unknown as THREE.Scene['onBeforeRender'];
      for (let i = 0; i < heldObjects.length; i++) (heldObjects[i] as THREE.Object3D).layers.mask = heldLayers[i] as number;
      heldObjects.length = heldLayers.length = 0;
      compiling.clear();
      pixel.dispose();
    },
  };
}
