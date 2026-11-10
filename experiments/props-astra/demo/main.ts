import * as T from 'three';
import {catalog} from '../props.ts';
import {Parts,P,triangles} from '../geometry.ts';
import {instances,type Placement} from '../instances.ts';
const sheet=new URLSearchParams(location.search).has('sheet');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setClearColor(0x3c5537,1);renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;document.body.prepend(renderer.domElement);
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
const geometries=catalog.map(p=>p.build());
function sceneBase(size:number){const scene=new T.Scene();scene.background=new T.Color(0x65733d);scene.add(new T.HemisphereLight(0xfff0cf,0x516b3c,2));const sun=new T.DirectionalLight(0xffe1b3,3);sun.position.set(-8,15,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-size,right:size,top:size,bottom:-size,near:.1,far:70});sun.shadow.normalBias=.04;scene.add(sun);const floor=new T.Mesh(new T.PlaneGeometry(size*4,size*4),new T.MeshStandardMaterial({color:0x65733d,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);return scene;}
function camera(span:number,aspect:number,target:T.Vector3){const c=new T.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,150);const elevation=35*Math.PI/180;c.position.copy(target).add(new T.Vector3(20,Math.tan(elevation)*Math.sqrt(800),20));c.lookAt(target);return c;}
const labels=document.querySelector<HTMLDivElement>('#labels')!;
if(sheet){
 document.querySelector('#subtitle')!.textContent='49 CODE-BUILT PROPS  /  VERTEX COLORS  /  35° CAMERA  /  EACH CELL FIT TO OBJECT';
 const scene=sceneBase(8);const mesh=new T.Mesh(geometries[0],material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 catalog.forEach((p,i)=>{const label=document.createElement('div');label.className='cell';label.innerHTML=`<span class="name">${p.name}</span><span class="meta">${triangles(geometries[i])} triangles · ${p.budget} budget</span>`;labels.append(label);});
 function render(){renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);const w=(innerWidth-40)/7,h=(innerHeight-97)/7;catalog.forEach((p,i)=>{mesh.geometry=geometries[i];const bounds=geometries[i].boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const span=Math.max(size.y*.92+Math.max(size.x,size.z)*.65,Math.max(size.x,size.z)*1.35,1)*1.2;const x=20+(i%7)*w,y=innerHeight-85-(Math.floor(i/7)+1)*h+46;renderer.setViewport(x,y,w,h-46);renderer.setScissor(x,y,w,h-46);renderer.render(scene,camera(span,w/(h-46),center));});renderer.setScissorTest(false);document.body.dataset.ready='true';}
 render();window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);render();});
}else{
 labels.remove();document.querySelector('#subtitle')!.textContent='MEADOW MARKET  /  FOREST EDGE  /  ALL GEOMETRY MADE IN CODE';
 const scene=sceneBase(23), placements=new Map<string,Placement[]>();
 function place(name:string,x:number,z:number,rotation=0,scale=1,y=0){const p=placements.get(name)??[];p.push({x,z,rotation,scale,y});placements.set(name,p);}
 for(let i=0;i<14;i++){place(['Oak 1','Oak 2','Birch 1','Birch 2','Pine 1','Pine 2'][i%6],-9+(i%7)*2.7,-7-Math.floor(i/7)*2.6,i*.9,.85+(i%3)*.12);}
 for(let i=0;i<100;i++){const x=Math.sin(i*54.23)*11,z=Math.cos(i*18.13)*8;if(z> -4 && (x< -4||z>3||x>7))place(['Grass 1','Grass 2','Grass 3','Ivory flowers','Gold flowers','Coral flowers','Mauve flowers'][i%7],x,z,i,1);}
 place('Market stall',-1,0);place('Well',4,0);place('Cart',-3,2,.4);place('Barrel',.5,1.1);place('Crate',-2.4,-.3);place('Sign',-3.5,-.3);place('Bench',4.8,3.4,Math.PI);place('Lamp post',2,3);place('Workbench',-6,0);place('Forge',-6,-2);place('Chest',-7,1);place('Bed',-8,-1);
 for(let i=0;i<5;i++)place('Fence',-3+i*1.8,5.5);for(let i=0;i<7;i++){place('Bush '+(i%3+1),-8+i*2.6,-4);place('Rock '+(i%4+1),-9+i*3,7,0,.8);}
 place('Fallen log',-7,3,.5);place('Stump',-5,4);place('Berry bush',7,3);place('Reeds',8,-.5);place('Reeds',9,-1);place('Mushroom 1',-7,-4);place('Mushroom 2',-6.4,-4);
 // Context walls and roofs are demo-only, constructed with the same palette.
 const house=new Parts();house.box([0,1.4,0],[3.4,2.8,2.8],0xe6dcc5);for(const x of [-1.7,1.7])house.box([x,1.4,1.44],[.15,2.8,.16],P.dark);for(const x of [-1,1])house.box([x,3.1,0],[2.3,.18,3.5],P.red,[0,0,x>0?-.5:.5]);house.box([0,.15,0],[3.8,.3,3.2],P.stone);const hg=house.done();const hm=new T.Mesh(hg,material);hm.position.set(3,-.01,-4.8);hm.castShadow=true;hm.receiveShadow=true;scene.add(hm);place('Door',2.6,-3.3);place('Window',4.1,-3.28,0,.65,1);place('Chimney',4.1,-5,0,1,3.1);
 const path=new Parts();for(let i=0;i<14;i++)path.box([Math.sin(i*.6)*.35,0,-5+i*.85],[1.8,.035,.8],i%2?0xb3976c:0xab8f64);const pm=new T.Mesh(path.done(),material);pm.receiveShadow=true;scene.add(pm);
 placements.forEach((ps,name)=>{const i=catalog.findIndex(p=>p.name===name);if(i<0)throw Error(name);scene.add(instances(geometries[i],material,ps));});
 const cam=camera(24,innerWidth/innerHeight,new T.Vector3(0,0,-2));renderer.render(scene,cam);document.body.dataset.ready='true';window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);const next=camera(24,innerWidth/innerHeight,new T.Vector3(0,0,-2));renderer.render(scene,next);});
}
