// Loads sprite and block art, and copies game actors to their pixel-art drawings.
import type { ViewContext } from '../../engine/system.ts';
import type { CameraMode } from '../../features/camera/index.ts';
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
export async function loadArt(onProgress?: (done: number) => void, stackedSprites = false): Promise<Art> {
  const baseUrl = new URL('assets/', document.baseURI).href;
  const spritePackUrl = stackedSprites ? new URL('experiments/sprite-stack/manifest.json', document.baseURI).href : undefined;
  const assets = await loadAssets({ baseUrl, spritePackUrl, onProgress: (p) => onProgress?.(p.loaded / p.total) });
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

// ---------------------------------------------------------------- actors to sprites

/** The calls the shell makes on a drawn actor, from a sprite handle. */
type ActorHandle = Pick<SpriteHandle, 'setPosition' | 'setFacing' | 'play' | 'setVisible' | 'remove'>;

interface Shown {
  handle: ActorHandle;
  /** The sprite sheet it was made for. */
  sprite: string;
  /** Where it is drawn. It glides after the actor, which moves 20 times a second. */
  x: number; y: number; z: number;
  lightY: number;
  seen: number;
}

export interface ActorSprites {
  /** Brings the drawing in line with the actors: adds, moves, turns, animates, hides and removes. Call it every frame. */
  sync(actors: ReadonlyMap<string, Actor>, dt: number, mode?: CameraMode): void;
  /** An actor's smoothed drawing position, including while hidden, or null before sync or after removal. */
  drawnAt(id: string): { x: number; y: number; z: number } | null;
  /** How far above the block it stands on an actor is drawn: the painted land's lift. Nothing by default. */
  setLift(lift: (x: number, y: number, z: number) => number): void;
  clear(): void;
}

/** Further than this in one frame is a teleport: the sprite jumps and does not glide. */
const SNAP = 3;
/** How fast a sprite catches up with its actor, per second. */
const GLIDE = 24;
/**
 * `sit`: no sheet has a sitting pose, so a sitting person is their standing frame set this far lower. The bench
 * and the table in front of them hide the legs; the camera sees the body from the hips up, at a sitter's height.
 */
const SIT_DROP = 0.35;

export function createActorSprites(sprites: Sprites): ActorSprites {
  const shown = new Map<string, Shown>();
  let pass = 0;
  let lift: (x: number, y: number, z: number) => number = () => 0;

  function clear(): void {
    for (const s of shown.values()) s.handle.remove();
    shown.clear();
  }

  return {
    setLift(next) { lift = next; },
    sync(actors, dt, mode = 'tilt') {
      pass++;
      const ease = 1 - Math.exp(-GLIDE * dt);
      for (const actor of actors.values()) {
        // Scenes and fights own actor visibility; the camera only hides the rendered player body.
        const visible = actor.visible && !(actor.id === 'player' && mode === 'first');
        let s = shown.get(actor.id);
        if (s && s.sprite !== actor.sprite) {
          s.handle.remove();
          s = undefined;
        }
        const p = actor.pos;
        // On painted land the drawn ground lies a little off the block an actor stands on. The player's own
        // position has that in it already.
        const sitting = actor.anim === 'sit';
        const py = (actor.id === 'player' ? p.y : p.y + lift(p.x, p.y, p.z)) - (sitting ? SIT_DROP : 0);
        const lightY = actor.lightY ?? p.y;
        const anim = sitting ? 'idle' : actor.anim;
        if (!s) {
          const options = { x: p.x, y: py, z: p.z, lightY, facing: actor.facing, animation: anim, visible };
          const handle = sprites.add(actor.sprite, options);
          s = { handle, sprite: actor.sprite, x: p.x, y: py, z: p.z, lightY, seen: pass };
          shown.set(actor.id, s);
        }
        s.seen = pass;
        // The player's actor is already smooth: the shell blends it between body steps.
        const far = Math.abs(p.x - s.x) + Math.abs(py - s.y) + Math.abs(p.z - s.z) > SNAP;
        const k = actor.id === 'player' || far ? 1 : ease;
        const dx = (p.x - s.x) * k, dy = (py - s.y) * k, dz = (p.z - s.z) * k;
        // A sprite that stands still is not written again, so a crowd at rest costs nothing.
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-4 || lightY !== s.lightY) {
          s.x += dx; s.y += dy; s.z += dz;
          s.lightY = lightY;
          s.handle.setPosition(s.x, s.y, s.z, lightY);
        }
        s.handle.setFacing(actor.facing);
        s.handle.play(anim);
        s.handle.setVisible(visible);
      }
      for (const [id, s] of shown) {
        if (s.seen === pass) continue;
        s.handle.remove();
        shown.delete(id);
      }
    },

    drawnAt: (id) => shown.get(id) ?? null,

    clear,
  };
}
