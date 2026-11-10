// The one file that touches the asset loader, the sprite feature and the toon feature. They are provisional
// copies, so when their API shifts, this is where it is mended: loading the manifest, the painted block atlas,
// making the sprite layer, building the 3D cast, and copying the game's actors to sprites or models.
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import { loadAssets, type Assets, type TileSheetAsset } from '../../features/assets/index.ts';
import { createSprites, type SpriteHandle, type Sprites } from '../../features/sprites/index.ts';
import {
  SLOT, addAccessory, addLimb, buildCreature, createToonCast, emptyPieces, headBox, isAccessory, loadToonKit, piecesGeometry, waistOf,
  type Fit, type Palette, type Pieces, type ToonCast, type ToonHandle, type ToonKit,
} from '../../features/toon/index.ts';
import { loadBlockAtlas, type AtlasSource } from '../../features/world/index.ts';
import type { Actor } from '../api.sim.ts';
import { CAST, CAST_ALIAS, CAST_BY_ID, type CastBody, type CastColours, type CastLook } from '../content/cast.ts';

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

// ---------------------------------------------------------------- the 3D cast

/** The stand-in people: three bodies on one rig, from tools/models/cast/stand-ins.mjs. */
const KIT_URL = 'assets/stand-ins/kaykit/cast.glb';
const PERSON_BODIES: readonly CastBody[] = ['slim', 'dress', 'stout'];
/** Blocks a second above which a person runs. The hero walks at 4.4, or 2 with Shift; the townsfolk at 2.2. */
const RUN_FROM = 3.1;
/** A hat adds this much to the height a mark floats at. */
const HAT = 0.24;

/** The toon cast with the game's characters in it. */
export interface CastModels {
  readonly cast: ToonCast;
  /** Adds the model for a sprite name, or null when the cast has no look for it. */
  add(sprite: string, id: string, options: { x: number; y: number; z: number; facing: number; animation: string; visible: boolean }): ToonHandle | null;
  /** The height a mark floats at over this character, in blocks. */
  markHeight(sprite: string): number;
}

const SLOT_NAMES = Object.keys(SLOT) as (keyof typeof SLOT)[];

/**
 * A person's shadow in a few hundred triangles: a ball for the head and capsules along the bones, which the sun's
 * shadow pass draws in place of the body's four thousand.
 */
function personShadow(kit: ToonKit, head: THREE.Box3, waist: number): Pieces {
  const shadow = emptyPieces();
  const at = (name: string): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(kit.bind(kit.bone(name)));
  const limb = (from: string, to: string, radius: number): void => addLimb(shadow, at(from), at(to), radius, kit.bone(from));
  limb('hips', 'head', waist * 0.85);
  for (const side of ['l', 'r']) {
    limb(`upperleg${side}`, `lowerleg${side}`, 0.1);
    limb(`lowerleg${side}`, `foot${side}`, 0.09);
    limb(`foot${side}`, `toes${side}`, 0.08);
    limb(`upperarm${side}`, `lowerarm${side}`, 0.08);
    limb(`lowerarm${side}`, `hand${side}`, 0.08);
  }
  const centre = head.getCenter(new THREE.Vector3()), size = head.getSize(new THREE.Vector3());
  addLimb(shadow, centre.clone().setY(centre.y - size.y * 0.15), centre.clone().setY(centre.y + size.y * 0.15), Math.min(size.x, size.z) * 0.45, kit.bone('head'));
  return shadow;
}

function paletteOf(colours: CastColours, over?: Partial<CastColours>): Palette {
  const palette: number[] = [];
  for (const name of SLOT_NAMES) palette[SLOT[name]] = over?.[name] ?? colours[name];
  return palette;
}

/** Every part anyone on this body wears, accessories first built and added to it. */
function wornOn(body: CastBody): Set<string> {
  const parts = new Set<string>();
  for (const look of Object.values(CAST)) {
    if (look.body !== body) continue;
    for (const part of look.parts) parts.add(part);
    for (const list of Object.values(look.partsWhile ?? {})) for (const part of list) parts.add(part);
  }
  return parts;
}

/**
 * Loads the stand-in people and builds the creatures, then makes the cast. The rim of every model takes the sun's
 * colour. It rejects when the kit file cannot be loaded.
 */
export async function loadCastModels(ctx: ViewContext, sun: THREE.DirectionalLight | null): Promise<CastModels> {
  const cast = createToonCast(ctx);
  cast.setSun(sun);
  const kit = await loadToonKit(new URL(KIT_URL, document.baseURI).href);
  cast.addRig('people', {
    root: kit.root, bones: kit.bones, inverses: kit.inverses, clips: kit.clips,
    names: { idle: 'Idle', walk: 'Walk', run: 'Run', tool: 'Tool', talk: 'Talk' },
    walk: 'Walk', run: 'Run', runFrom: RUN_FROM, gaits: ['Walk', 'Run'], feet: ['footl', 'footr'],
  });
  /** The height of each body's head top, in its own units, to scale people to their height in blocks. */
  const tops = new Map<CastBody, number>();
  const bone = (name: string): number => {
    const i = kit.bone(name);
    if (i < 0) throw new Error(`cast: the kit has no bone ${name}`);
    return i;
  };
  for (const body of PERSON_BODIES) {
    const source = kit.bodies.get(body);
    if (!source) throw new Error(`cast: the kit has no body ${body}`);
    const pieces = source.pieces;
    const parts = [...source.parts];
    const head = bone('head');
    const box = headBox(pieces, head);
    const at = (name: string): number => new THREE.Vector3().setFromMatrixPosition(kit.bind(bone(name))).y;
    const fit: Fit = {
      head, hand: bone('handslotr'), headBox: box, handBind: kit.bind(bone('handslotr')),
      chestY: at('chest'), kneeY: at('lowerlegl'), waist: waistOf(pieces, at('hips'), at('chest')),
    };
    const shadow = personShadow(kit, box, fit.waist);
    for (const part of wornOn(body)) {
      if (parts.includes(part) || !isAccessory(part)) continue;
      parts.push(part);
      addAccessory(shadow, part, fit, parts.length - 1, pieces);
      addAccessory(pieces, part, fit, parts.length - 1);
    }
    tops.set(body, box.max.y);
    cast.addBody(body, { rig: 'people', geometry: piecesGeometry(pieces), parts, shadow: piecesGeometry(shadow) });
  }
  for (const creature of ['mossling', 'leaftail', 'lanternfly'] as const) {
    const made = buildCreature(creature);
    cast.addRig(creature, { root: made.root, bones: made.bones, inverses: made.inverses, clips: made.clips, names: made.names, walk: made.walk || undefined, gaits: made.walk ? [made.walk] : [], feet: made.feet });
    cast.addBody(creature, { rig: creature, geometry: piecesGeometry(made.pieces), parts: ['body'] });
    tops.set(creature, made.height);
  }

  const lookOf = (sprite: string): CastLook | undefined => CAST[CAST_ALIAS[sprite] ?? sprite];
  return {
    cast,
    add(sprite, id, o) {
      const look = lookOf(sprite);
      if (!look || !cast.hasBody(look.body)) return null;
      const people = PERSON_BODIES.includes(look.body);
      const handle = cast.add(look.body, {
        x: o.x, y: o.y, z: o.z, facing: o.facing, visible: o.visible, animation: o.animation,
        palette: paletteOf(look.colours, CAST_BY_ID[id]), parts: look.parts, partsWhile: look.partsWhile,
        scale: people ? look.height / (tops.get(look.body) ?? look.height) : 1,
      });
      return handle;
    },
    markHeight(sprite) {
      const look = lookOf(sprite);
      if (!look) return 2;
      return look.height + (look.parts.some((p) => p.endsWith('hat') || p === 'cap') ? HAT : 0);
    },
  };
}

// ---------------------------------------------------------------- actors to sprites or models

/** The calls the shell makes on a drawn actor, which a sprite handle and a toon handle both have. */
type ActorHandle = Pick<SpriteHandle, 'setPosition' | 'setFacing' | 'play' | 'setVisible' | 'remove'>;

interface Shown {
  handle: ActorHandle;
  /** The sprite it was made for, or for a model, the character it stands for. */
  sprite: string;
  model: boolean;
  /** Where it is drawn. It glides after the actor, which moves 20 times a second. */
  x: number; y: number; z: number;
  seen: number;
}

export interface ActorSprites {
  /** Brings the drawing in line with the actors: adds, moves, turns, animates, hides and removes. Call it every frame. */
  sync(actors: ReadonlyMap<string, Actor>, dt: number): void;
  /** Where an actor is drawn this frame, or null when it is not drawn. */
  drawnAt(id: string): { x: number; y: number; z: number } | null;
  /** The height a mark floats at over this actor, or null for a sprite's own height. */
  markHeight(id: string): number | null;
  /**
   * Draws everyone as 3D models from now on, or as sprites again with null. Every actor swaps on the next sync,
   * all at once.
   */
  setModels(models: CastModels | null): void;
  /** The id of the actor speaking in a conversation now. A model of them plays `talk` while it would stand idle. */
  setSpeaker(id: string | null): void;
  clear(): void;
}

/** Further than this in one frame is a teleport: the sprite jumps and does not glide. */
const SNAP = 3;
/** How fast a sprite catches up with its actor, per second. */
const GLIDE = 24;

export function createActorSprites(sprites: Sprites): ActorSprites {
  const shown = new Map<string, Shown>();
  let pass = 0;
  let models: CastModels | null = null;
  let speaker: string | null = null;
  const state = { swap: false };

  /** The character a sprite stands for, so the hero's swing sheet does not make a new model. */
  const character = (sprite: string): string => CAST_ALIAS[sprite] ?? sprite;

  function clear(): void {
    for (const s of shown.values()) s.handle.remove();
    shown.clear();
  }

  return {
    sync(actors, dt) {
      pass++;
      if (state.swap) {
        state.swap = false;
        clear();
      }
      const ease = 1 - Math.exp(-GLIDE * dt);
      for (const actor of actors.values()) {
        let s = shown.get(actor.id);
        if (s && s.sprite !== (s.model ? character(actor.sprite) : actor.sprite)) {
          s.handle.remove();
          s = undefined;
        }
        const p = actor.pos;
        const anim = models && actor.id === speaker && actor.anim === 'idle' ? 'talk' : actor.anim;
        if (!s) {
          const options = { x: p.x, y: p.y, z: p.z, facing: actor.facing, animation: anim, visible: actor.visible };
          // A character the cast has no look for stays a sprite among the models.
          const model = models?.add(actor.sprite, actor.id, options) ?? null;
          const handle = model ?? sprites.add(actor.sprite, options);
          s = { handle, sprite: model ? character(actor.sprite) : actor.sprite, model: model !== null, x: p.x, y: p.y, z: p.z, seen: pass };
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
        s.handle.play(anim);
        s.handle.setVisible(actor.visible);
      }
      for (const [id, s] of shown) {
        if (s.seen === pass) continue;
        s.handle.remove();
        shown.delete(id);
      }
    },

    drawnAt: (id) => shown.get(id) ?? null,

    markHeight(id) {
      const s = shown.get(id);
      return s?.model && models ? models.markHeight(s.sprite) : null;
    },

    setModels(next) {
      if (next === models) return;
      models = next;
      state.swap = true;
    },

    setSpeaker(id) {
      speaker = id;
    },

    clear,
  };
}
