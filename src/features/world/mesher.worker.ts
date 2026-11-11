// The worker that makes chunks and their meshes, so the page never stutters while the world loads.
// It holds no world of its own: every message carries what the job needs.
import { leaveOut, meshChunk, type ChunkMesh, type TileTable } from './mesh.sim.ts';
import { CHUNK, PAD } from './chunk.sim.ts';
import { groundHeight } from './terrain.sim.ts';
import { buildChunk } from './world.sim.ts';

export type WorkerRequest =
  | { type: 'tiles'; tiles: TileTable; leftOut: Uint8Array }
  | { type: 'make'; epoch: number; seed: number; cx: number; cz: number; edits: Int32Array | null }
  | { type: 'mesh'; epoch: number; seed: number; cx: number; cz: number; rev: number; blocks: Uint8Array; light: Uint8Array };

export type WorkerReply =
  | { type: 'made'; epoch: number; cx: number; cz: number; blocks: Uint8Array; light: Uint8Array; heights: Uint8Array }
  | { type: 'meshed'; epoch: number; cx: number; cz: number; rev: number; mesh: ChunkMesh; blocks: Uint8Array; light: Uint8Array };

const scope = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage(message: WorkerReply, transfer: Transferable[]): void };
let tiles: TileTable = new Uint8Array(0);
/** True when some blocks are land that another view draws. `ground` is the natural height of each padded column of the chunk in hand. */
let land = false;
const ground = new Uint8Array(PAD * PAD);

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'tiles') {
    tiles = m.tiles;
    leaveOut(m.leftOut);
    land = m.leftOut.length > 0;
  } else if (m.type === 'make') {
    const data = buildChunk(m.seed, m.cx, m.cz, m.edits);
    scope.postMessage({ type: 'made', epoch: m.epoch, cx: m.cx, cz: m.cz, ...data }, [data.blocks.buffer, data.light.buffer, data.heights.buffer]);
  } else {
    // With land left out, the mesher needs the height the ground had before anything was built on it.
    if (land) for (let px = 0; px < PAD; px++) for (let pz = 0; pz < PAD; pz++) ground[px * PAD + pz] = groundHeight(m.seed, m.cx * CHUNK + px - 1, m.cz * CHUNK + pz - 1);
    const mesh = meshChunk(m.blocks, m.light, tiles, land ? ground : undefined);
    // The padded copies go back with the answer so the page can reuse them.
    const transfer: Transferable[] = [m.blocks.buffer, m.light.buffer];
    for (const part of [mesh.solid, mesh.water]) {
      if (part) transfer.push(part.positions.buffer, part.info.buffer, part.light.buffer, part.indices.buffer);
    }
    scope.postMessage({ type: 'meshed', epoch: m.epoch, cx: m.cx, cz: m.cz, rev: m.rev, mesh, blocks: m.blocks, light: m.light }, transfer);
  }
};
