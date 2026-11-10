// The one file that touches the asset loader and the sprite feature. Both are provisional copies, so
// when their API shifts, this is where it is mended: loading the manifest, the painted block atlas,
// making the sprite layer, and copying the game's actors to sprite handles.
import type { ViewContext } from '../../engine/system.ts';
import { loadAssets, type Assets, type TileSheetAsset } from '../../features/assets/index.ts';
import { createSprites, type SpriteHandle, type Sprites } from '../../features/sprites/index.ts';
import { loadBlockAtlas, type AtlasSource } from '../../features/world/index.ts';
import type { Actor } from '../api.sim.ts';

export interface Art {
  assets: Assets;
  /** The painted block tiles for the world, or undefined when the manifest lists none. */
  blockAtlas: AtlasSource | undefined;
}

/**
 * Block tiles drawn over a frozen tile of the block atlas: the tile's name, and the tile in the manifest's
 * `materials` sheet that replaces it. The atlas file stays as it was approved.
 */
const MATERIALS: Readonly<Record<string, string>> = { oak_plank: 'oak_boards' };

/** Loads the manifest and every file it lists. `onProgress` gets 0 to 1. */
export async function loadArt(onProgress?: (done: number) => void): Promise<Art> {
  const baseUrl = new URL('assets/', document.baseURI).href;
  const assets = await loadAssets({ baseUrl, onProgress: (p) => onProgress?.(p.loaded / p.total) });
  const blocks = assets.manifest.blocks;
  const blockAtlas = blocks ? await loadBlockAtlas(blocks, baseUrl) : undefined;
  if (blockAtlas && assets.sheetNames().includes('materials')) await paintMaterials(blockAtlas, assets.sheet('materials'));
  return { assets, blockAtlas };
}

async function paintMaterials(atlas: AtlasSource, materials: TileSheetAsset): Promise<void> {
  const image = new Image();
  image.src = materials.url;
  await image.decode();
  const ctx = atlas.canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const [tile, material] of Object.entries(MATERIALS)) {
    if (!materials.names.includes(material)) continue;
    const from = materials.cells(material)[0];
    for (const [column, row] of atlas.cells.get(tile) ?? []) {
      ctx.clearRect(column * atlas.tile, row * atlas.tile, atlas.tile, atlas.tile);
      ctx.drawImage(image, from.x, from.y, materials.tile, materials.tile, column * atlas.tile, row * atlas.tile, atlas.tile, atlas.tile);
    }
  }
}

export function makeSprites(ctx: ViewContext, assets: Assets): Sprites {
  return createSprites(ctx, { assets, seed: 7 });
}

/** A sprite's height in blocks, for placing a mark over its head. 2 when the manifest does not know the sprite. */
export function spriteHeight(assets: Assets, sprite: string): number {
  return assets.hasSprite(sprite) ? assets.sprite(sprite).worldHeight : 2;
}

interface Shown {
  handle: SpriteHandle;
  sprite: string;
  /** Where it is drawn. It glides after the actor, which moves 20 times a second. */
  x: number; y: number; z: number;
  seen: number;
}

export interface ActorSprites {
  /** Brings the sprites in line with the actors: adds, moves, turns, animates, hides and removes. Call it every frame. */
  sync(actors: ReadonlyMap<string, Actor>, dt: number): void;
  /** Where an actor is drawn this frame, or null when it has no sprite. */
  drawnAt(id: string): { x: number; y: number; z: number } | null;
  clear(): void;
}

/** Further than this in one frame is a teleport: the sprite jumps and does not glide. */
const SNAP = 3;
/** How fast a sprite catches up with its actor, per second. */
const GLIDE = 24;

export function createActorSprites(sprites: Sprites): ActorSprites {
  const shown = new Map<string, Shown>();
  let pass = 0;

  return {
    sync(actors, dt) {
      pass++;
      const ease = 1 - Math.exp(-GLIDE * dt);
      for (const actor of actors.values()) {
        let s = shown.get(actor.id);
        if (s && s.sprite !== actor.sprite) {
          s.handle.remove();
          s = undefined;
        }
        const p = actor.pos;
        if (!s) {
          const handle = sprites.add(actor.sprite, { x: p.x, y: p.y, z: p.z, facing: actor.facing, animation: actor.anim, visible: actor.visible });
          s = { handle, sprite: actor.sprite, x: p.x, y: p.y, z: p.z, seen: pass };
          shown.set(actor.id, s);
        }
        s.seen = pass;
        // The player's actor is already smooth: the shell blends it between body steps.
        const far = Math.abs(p.x - s.x) + Math.abs(p.y - s.y) + Math.abs(p.z - s.z) > SNAP;
        const k = actor.id === 'player' || far ? 1 : ease;
        const dx = (p.x - s.x) * k, dy = (p.y - s.y) * k, dz = (p.z - s.z) * k;
        // A sprite that stands still is not written again, so a crowd at rest costs nothing.
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-4) {
          s.x += dx; s.y += dy; s.z += dz;
          s.handle.setPosition(s.x, s.y, s.z);
        }
        s.handle.setFacing(actor.facing);
        s.handle.play(actor.anim);
        s.handle.setVisible(actor.visible);
      }
      for (const [id, s] of shown) {
        if (s.seen === pass) continue;
        s.handle.remove();
        shown.delete(id);
      }
    },

    drawnAt: (id) => shown.get(id) ?? null,

    clear() {
      for (const s of shown.values()) s.handle.remove();
      shown.clear();
    },
  };
}
