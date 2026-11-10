export interface RockModels {place(x:number,y:number,z:number,rotation:number,scale:number,variant:number):number;remove(id:number):void}
// One instanced draw per model variant. Rules own the placements and standing state.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

export async function install(view: GameView): Promise<void> {

  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const clock = { value: 0 };
  const group = new THREE.Group(); group.name = 'model trees and rocks';
  const manifest = await (await fetch('/assets/manifest.json')).json();
  // Load everything before changing the scene, so a failed request leaves no half-installed fixture.
  const loaded = await Promise.all(['tree-17','tree-41','tree-83','birch-17','birch-41','birch-83','pine-17','pine-41','pine-83','rock-11','rock-37'].map(async name => ({ name, gltf: await loader.loadAsync(`/assets/${manifest.models[name].file}`) })));
  const batches = new Map<string,THREE.InstancedMesh>();
  for (const { name, gltf } of loaded) {
    gltf.scene.updateMatrixWorld(true);
    let source: THREE.Mesh | undefined;
    gltf.scene.traverse(node => { if (node instanceof THREE.Mesh) source = node; });
    if (!source) throw new Error(`model ${name} has no mesh`);
    const mesh = source as THREE.Mesh;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
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
  }
  view.onFrame(dt=>{
    clock.value+=dt;
    const list=view.game.systems.trees.all();
    let count=0; for(const t of list) if(t.standing) count++;
    if(list===lastList&&count===lastCount&&falling.length===0) return;
    lastList=list;lastCount=count;
    for(const batch of batches.values()) if(!batch.name.startsWith('rock')) batch.count=0;
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
  });
  // Dressing hands rock placements to this shared two-variant batch.
  const rocks=new Map<number,{name:string;x:number;y:number;z:number;rotation:number;scale:number}>();
  let next=1;
  (view as GameView & {modelRocks: RockModels}).modelRocks={place(x,y,z,rotation,scale,variant){const id=next++;rocks.set(id,{name:variant%2?'rock-37':'rock-11',x,y,z,rotation,scale});refresh();return id;},remove(id){rocks.delete(id);refresh();}};
  function refresh():void {
    for(const name of ['rock-11','rock-37']) batches.get(name)!.count=0;
    for(const r of rocks.values()){
      const b=batches.get(r.name)!; if(b.count>=2048)continue;
      transform.position.set(r.x,r.y,r.z);transform.rotation.set(0,r.rotation,0);transform.scale.setScalar(r.scale);transform.updateMatrix();b.setMatrixAt(b.count++,transform.matrix);
    }
    for(const name of ['rock-11','rock-37']) batches.get(name)!.instanceMatrix.needsUpdate=true;
  }
}
