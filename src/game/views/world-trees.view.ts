// One instanced draw per model variant. Rules own the placements and standing state.
// Shadows: a crown of 1,300 to 1,500 triangles in the shadow pass costs too much, so each tree is stood in for
// there by a box for its trunk and a few balls fitted to its leaves when the model loads. Both live on the layer
// only the sun's shadow camera sees, and cost two draw calls for every tree. The balls are cut by a noise
// texture, so light falls through the shadow of a crown in spots.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

/** The sun's shadow layer, as the sky and the props features have it. */
const SHADOW_LAYER = 30;
/** Balls that stand in for one crown. */
const BLOBS = 5;

/** Fits a box to a tree's trunk and BLOBS balls to its leaves, as matrices that stretch a unit box and a unit ball. */
function standIn(geometry: THREE.BufferGeometry): { trunk: THREE.Matrix4; blobs: THREE.Matrix4[] } {
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const leaves: number[] = [], bark: number[] = [];
  // The wind shader tells leaves from bark the same way: leaves sit on the right half of the texture.
  for (let i = 0; i < position.count; i++) (uv.getX(i) >= .49 ? leaves : bark).push(position.getX(i), position.getY(i), position.getZ(i));
  let bottom = Infinity;
  for (let i = 1; i < leaves.length; i += 3) bottom = Math.min(bottom, leaves[i]);
  // The trunk: as wide as the bark below the crown, from the ground into the crown.
  const radii: number[] = [];
  for (let i = 0; i < bark.length; i += 3) if (bark[i + 1] < bottom) radii.push(Math.hypot(bark[i], bark[i + 2]));
  radii.sort((a, b) => a - b);
  const width = Math.max(.12, 2 * (radii[Math.floor(radii.length / 2)] ?? .15));
  const trunk = new THREE.Matrix4().makeScale(width, bottom + .4, width).setPosition(0, (bottom + .4) / 2, 0);
  // The crown: k-means on the leaf corners, seeded with the corners farthest apart, so the fit is the same every load.
  const n = leaves.length / 3, centers: number[] = [leaves[0], leaves[1], leaves[2]];
  while (centers.length < BLOBS * 3) {
    let far = 0, best = -1;
    for (let i = 0; i < n; i++) {
      let near = Infinity;
      for (let c = 0; c < centers.length; c += 3) near = Math.min(near, (leaves[i * 3] - centers[c]) ** 2 + (leaves[i * 3 + 1] - centers[c + 1]) ** 2 + (leaves[i * 3 + 2] - centers[c + 2]) ** 2);
      if (near > best) { best = near; far = i; }
    }
    centers.push(leaves[far * 3], leaves[far * 3 + 1], leaves[far * 3 + 2]);
  }
  const owner = new Int32Array(n);
  for (let round = 0; round < 12; round++) {
    for (let i = 0; i < n; i++) {
      let near = Infinity;
      for (let c = 0; c < BLOBS; c++) {
        const d = (leaves[i * 3] - centers[c * 3]) ** 2 + (leaves[i * 3 + 1] - centers[c * 3 + 1]) ** 2 + (leaves[i * 3 + 2] - centers[c * 3 + 2]) ** 2;
        if (d < near) { near = d; owner[i] = c; }
      }
    }
    centers.fill(0);
    const counts = new Array(BLOBS).fill(0);
    for (let i = 0; i < n; i++) { const c = owner[i]; counts[c]++; for (let k = 0; k < 3; k++) centers[c * 3 + k] += leaves[i * 3 + k]; }
    for (let c = 0; c < BLOBS; c++) for (let k = 0; k < 3; k++) centers[c * 3 + k] /= Math.max(1, counts[c]);
  }
  // Leaf corners lie on the surface of each lump, where the spread along an axis is the radius over the root of 3.
  const blobs: THREE.Matrix4[] = [];
  for (let c = 0; c < BLOBS; c++) {
    const spread = [0, 0, 0];
    let count = 0;
    for (let i = 0; i < n; i++) if (owner[i] === c) { count++; for (let k = 0; k < 3; k++) spread[k] += (leaves[i * 3 + k] - centers[c * 3 + k]) ** 2; }
    if (count < 4) continue;
    const r = spread.map(v => Math.max(.25, Math.sqrt(v / count) * 1.6));
    blobs.push(new THREE.Matrix4().makeScale(r[0], r[1], r[2]).setPosition(centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]));
  }
  return { trunk, blobs };
}

/** A tiling noise for the holes in a crown's shadow. Values below the middle are holes, about a third of it. */
function dappleTexture(): THREE.DataTexture {
  const size = 32, cell = 4, grid = size / cell, out = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number): number => {
    let h = Math.imul(((x % grid) + grid) % grid, 374761393) + Math.imul(((y % grid) + grid) % grid, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = (gx - ix) ** 2 * (3 - 2 * (gx - ix)), fy = (gy - iy) ** 2 * (3 - 2 * (gy - iy));
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    const v = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    out.fill(Math.round(Math.min(1, Math.max(0, (v - .3) / .4 * .5 + .5 - .12)) * 255), (y * size + x) * 4, (y * size + x) * 4 + 4);
  }
  const texture = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.repeat.set(3, 2);
  texture.needsUpdate = true;
  return texture;
}

export async function install(view: GameView): Promise<void> {
  // The painted world draws its own trees and boulders.
  if (view.painted) return;

  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const clock = { value: 0 };
  const group = new THREE.Group(); group.name = 'model trees and rocks';
  const manifest = await (await fetch(`${import.meta.env.BASE_URL}assets/manifest.json`)).json();
  // Load everything before changing the scene, so a failed request leaves no half-installed fixture.
  const loaded = await Promise.all(['tree-17','tree-41','tree-83','birch-17','birch-41','birch-83','pine-17','pine-41','pine-83','rock-11','rock-37'].map(async name => ({ name, gltf: await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${manifest.models[name].file}`) })));
  const batches = new Map<string,THREE.InstancedMesh>();
  const shapes = new Map<string,{ trunk: THREE.Matrix4; blobs: THREE.Matrix4[] }>();
  // The stand-ins for every tree: one box per trunk and BLOBS balls per crown.
  const trunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 2048);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ alphaMap: dappleTexture(), alphaTest: .5 }), 2048 * BLOBS);
  for (const [mesh, name] of [[trunks, 'tree-shadow-trunks'], [crowns, 'tree-shadow-crowns']] as const) {
    mesh.name = name; mesh.count = 0; mesh.castShadow = true; mesh.frustumCulled = false; mesh.layers.set(SHADOW_LAYER); group.add(mesh);
  }
  for (const { name, gltf } of loaded) {
    gltf.scene.updateMatrixWorld(true);
    let source: THREE.Mesh | undefined;
    gltf.scene.traverse(node => { if (node instanceof THREE.Mesh) source = node; });
    if (!source) throw new Error(`model ${name} has no mesh`);
    const mesh = source as THREE.Mesh;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (!name.startsWith('rock')) shapes.set(name, standIn(geometry));
    geometry.setAttribute('treeFade',new THREE.InstancedBufferAttribute(new Float32Array(2048).fill(1),1));
    const original = mesh.material as THREE.MeshStandardMaterial;
    const material = new THREE.MeshToonMaterial({ map: original.map, vertexColors: true, alphaTest: .5, side: THREE.DoubleSide });
    // A small stepped ramp keeps broad crown normals softly lit. Bark and foliage share one primitive.
    const ramp = new THREE.DataTexture(new Uint8Array([110,110,110,255,168,168,168,255,218,218,218,255,255,255,255,255]),4,1,THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; material.gradientMap = ramp;
    material.onBeforeCompile = shader => {
      shader.uniforms.modelTime = clock;
      shader.vertexShader = 'attribute float treeFade; varying float fade; uniform float modelTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        fade = treeFade;
        float leaf = step(0.49, uv.x);
        float weight = leaf * smoothstep(0.0, 4.0, position.y);
        transformed.x += sin(modelTime * 1.15 + position.y * 1.2 + position.z) * 0.055 * weight;
        transformed.z += cos(modelTime * 0.85 + position.x) * 0.035 * weight;`);
      shader.fragmentShader='varying float fade;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>fade) discard;');
    };
    const instances = new THREE.InstancedMesh(geometry, material, 2048);
    instances.name = name; instances.count=0; instances.frustumCulled=false;
    batches.set(name,instances); group.add(instances);
    mesh.geometry.dispose(); original.dispose();
  }
  view.scene.add(group);
  const transform = new THREE.Object3D();
  const axis = new THREE.Vector3();
  const part = new THREE.Matrix4();
  const falling: {tree: import('../trees/index.sim.ts').ModelTree; time:number; angle:number}[]=[];
  view.game.events.on('tree.felled',e=>{
    const tree=view.game.systems.trees.all().find(t=>t.x===e.x&&t.z===e.z);
    if(tree) falling.push({tree,time:0,angle:Math.atan2(tree.x-view.playerPosition.x,tree.z-view.playerPosition.z)});
  });
  let lastList: unknown, lastCount=-1;
  function write(t: import('../trees/index.sim.ts').ModelTree, angle=0, fall=0): void {
    const name=`${t.kind==='oak'?'tree':t.kind}-${[17,41,83][t.variant]}`;
    const batch=batches.get(name)!;
    if(batch.count>=2048) return;
    transform.position.set(t.x+.5,t.y,t.z+.5); transform.scale.setScalar(t.size);
    axis.set(Math.cos(angle),0,-Math.sin(angle));
    transform.quaternion.setFromAxisAngle(axis,fall);
    transform.updateMatrix(); batch.setMatrixAt(batch.count,transform.matrix);
    (batch.geometry.getAttribute('treeFade') as THREE.InstancedBufferAttribute).setX(batch.count++,1);
    const shape=shapes.get(name)!;
    if(trunks.count>=2048) return;
    trunks.setMatrixAt(trunks.count++,part.multiplyMatrices(transform.matrix,shape.trunk));
    for(const blob of shape.blobs) crowns.setMatrixAt(crowns.count++,part.multiplyMatrices(transform.matrix,blob));
  }
  view.onFrame(dt=>{
    clock.value+=dt;
    const list=view.game.systems.trees.all();
    let count=0; for(const t of list) if(t.standing) count++;
    if(list===lastList&&count===lastCount&&falling.length===0) return;
    lastList=list;lastCount=count;
    for(const batch of batches.values()) if(!batch.name.startsWith('rock')) batch.count=0;
    trunks.count=crowns.count=0;
    const p=view.playerPosition;
    for(const t of list) if(t.standing && Math.hypot(t.x-p.x,t.z-p.z)<48) write(t);
    for(let i=falling.length-1;i>=0;i--){
      const f=falling[i]; f.time+=dt;
      if(f.time>1.1){falling.splice(i,1);lastCount=-1;continue;}
      write(f.tree,f.angle,Math.min(1,f.time)*1.5);
      const batch=batches.get(`${f.tree.kind==='oak'?'tree':f.tree.kind}-${[17,41,83][f.tree.variant]}`)!;
      (batch.geometry.getAttribute('treeFade') as THREE.InstancedBufferAttribute).setX(batch.count-1,Math.min(1,(1.1-f.time)/.4));
    }
    for(const batch of batches.values()){batch.instanceMatrix.needsUpdate=true;batch.geometry.getAttribute('treeFade').needsUpdate=true;}
    trunks.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=true;
  });
  // Dressing hands rock placements to this shared two-variant batch.
  const rocks=new Map<number,{name:string;x:number;y:number;z:number;rotation:number;scale:number}>();
  let next=1;
  view.standIns.set('rock',{place(x,y,z,rotation,scale,variant){const id=next++;rocks.set(id,{name:variant%2?'rock-37':'rock-11',x,y,z,rotation,scale});refresh();return id;},remove(id){rocks.delete(id);refresh();}});
  function refresh():void {
    for(const name of ['rock-11','rock-37']) batches.get(name)!.count=0;
    for(const r of rocks.values()){
      const b=batches.get(r.name)!; if(b.count>=2048)continue;
      transform.position.set(r.x,r.y,r.z);transform.rotation.set(0,r.rotation,0);transform.scale.setScalar(r.scale);transform.updateMatrix();b.setMatrixAt(b.count++,transform.matrix);
    }
    for(const name of ['rock-11','rock-37']) batches.get(name)!.instanceMatrix.needsUpdate=true;
  }
}
