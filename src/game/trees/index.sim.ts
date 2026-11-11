// Deterministic tree identities. Terrain owns root collision; the save owns which trees fell.
import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { treesInArea, type TreePlacement } from '../../features/world/terrain.sim.ts';
import type { RayHit } from '../../features/world/world.sim.ts';
import type { TreeBox } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
export interface ModelTree extends TreePlacement { standing: boolean; protected: boolean; box: TreeBox }
export interface TreesApi {
  all(): readonly ModelTree[];
  /** True when the tree that grew in this column was felled, however far off it is. */
  felled(x: number, z: number): boolean;
  at(x: number,y: number,z: number): ModelTree | null;
  fell(x: number,y: number,z: number): boolean;
  raycast(origin: Vec3, direction: Vec3, max: number, hit: RayHit): boolean;
}
const AXES = ['x','y','z'] as const;
export function install(kernel: Kernel): void {
  const { game } = kernel, { world } = game;
  const felled = new Set<string>();
  let list: ModelTree[] = [], cx = NaN, cz = NaN;
  const key = (x: number,z: number) => `${x},${z}`;
  function sync(): void {
    const x = Math.floor(game.player.pos.x / 16), z = Math.floor(game.player.pos.z / 16);
    if (x === cx && z === cz) return;
    cx=x; cz=z;
    const rocks=game.systems.region?.place('grant.rocks').at;
    list=treesInArea(world.seed,(x-4)*16,(z-4)*16,(x+5)*16,(z+5)*16).map(t => ({...t,standing:!felled.has(key(t.x,t.z)),protected:(rocks !== undefined && Math.hypot(t.x+.5-rocks.x,t.z+.5-rocks.z)<12) || (game.systems.region?.isProtected(t.x,t.y,t.z)??false),box:{x0:t.x+.5-2.2*t.size,y0:t.y,z0:t.z+.5-2.2*t.size,x1:t.x+.5+2.2*t.size,y1:t.y+6.6*t.size,z1:t.z+.5+2.2*t.size}}));
  }
  const api: TreesApi = {
    all() { sync(); return list; },
    felled: (x, z) => felled.has(key(x, z)),
    at(x,y,z) {
      sync();
      for (const t of list) if(t.standing && t.x===x && t.z===z && y>=t.y && y<t.box.y1) return t;
      for (const t of list) if(t.standing && x>=t.box.x0 && x<t.box.x1 && y>=t.y && y<t.box.y1 && z>=t.box.z0 && z<t.box.z1) return t;
      return null;
    },
    fell(x,y,z) {
      const t=api.at(x,y,z);
      if (!t || t.protected) return false;
      t.standing=false; felled.add(key(t.x,t.z));
      for (let dy=0;dy<2;dy++) if(world.getBlock(t.x,t.y+dy,t.z)===blockId('barrier')) world.setBlock(t.x,t.y+dy,t.z,0);
      const logs=Math.max(3,Math.round(4*t.size)), leaves=20;
      game.systems.inventory.add('oak_log',logs);
      game.systems.inventory.add('fiber',Math.max(1,Math.round(leaves/15)));
      const id=blockId(`${t.kind}_log`);
      game.events.emit('block.broken',{x:t.x,y:t.y,z:t.z,id,by:'player'});
      game.events.emit('tree.felled',{x:t.x,y:t.y,z:t.z,id,logs,leaves,box:t.box});
      return true;
    },
    raycast(o,d,max,hit) {
      sync(); let found=false;
      for(const t of list) {
        if(!t.standing) continue;
        const b=t.box;
        let near=0,far=max;
        for(const axis of AXES) {
          const lo=b[`${axis}0`], hi=b[`${axis}1`];
          if(Math.abs(d[axis])<1e-9) { if(o[axis]<lo || o[axis]>hi) far=-1; continue; }
          const a=(lo-o[axis])/d[axis], c=(hi-o[axis])/d[axis];
          near=Math.max(near,Math.min(a,c)); far=Math.min(far,Math.max(a,c));
        }
        if(near>far || far<0) continue;
        max=near; found=true;
        hit.x=t.x; hit.y=t.y; hit.z=t.z;
        hit.id=blockId('barrier'); hit.distance=near; hit.nx=0;hit.ny=1;hit.nz=0;
      }
      return found;
    }
  };
  kernel.add('trees',api,{step:sync,save:()=>({felled:[...felled]}),load(data){felled.clear();for(const k of (data as {felled?:string[]})?.felled??[]) felled.add(k);cx=NaN;sync();}});
}
