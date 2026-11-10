// The one file that touches the asset loader, the sprite feature and the toon feature. They are provisional
// copies, so when their API shifts, this is where it is mended: loading the manifest, the painted block atlas,
// making the sprite layer, building the 3D cast, and copying the game's actors to sprites or models.
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import { loadAssets, type Assets, type TileSheetAsset } from '../../features/assets/index.ts';
import { createSprites, type SpriteHandle, type Sprites } from '../../features/sprites/index.ts';
import {
  CREATURES, addAccessory, addLimb, buildCreature, createToonCast, emptyPieces, headBox, isAccessory, loadToonKit, piecesGeometry, slotIndex, waistOf,
  type Creature, type Fit, type Palette, type Pieces, type ToonCast, type ToonFileBody, type ToonHandle, type ToonKit,
} from '../../features/toon/index.ts';
import { loadBlockAtlas, type AtlasSource } from '../../features/world/index.ts';
import type { Actor } from '../api.sim.ts';
import { CAST, CAST_ALIAS, CAST_BY_ID, CAST_MODELS, type CastColours, type CastLook, type CastModel } from '../content/cast-models.ts';

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

/** The meshes of a look, as a list. */
const meshesOf = (look: CastLook): readonly string[] => (typeof look.mesh === 'string' ? [look.mesh] : look.mesh);
/** A body of the cast, by model and meshes: `kaykit/slim`. */
const bodyKey = (look: CastLook): string => `${look.model}/${meshesOf(look).join('+')}`;

/**
 * A person's shadow in a few hundred triangles: a ball for the head and capsules along the bones, which the sun's
 * shadow pass draws in place of the body's thousands.
 */
function personShadow(kit: ToonKit, bones: NonNullable<CastModel['bones']>, head: THREE.Box3, waist: number, slots: readonly string[]): Pieces {
  const shadow = emptyPieces(slots);
  const at = (name: string): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(kit.bind(boneOf(kit, name)));
  const limb = (from: string, to: string, radius: number): void => addLimb(shadow, at(from), at(to), radius, boneOf(kit, from));
  limb(bones.hips, bones.head, waist * 0.85);
  for (const [from, to, radius] of bones.limbs) limb(from, to, radius);
  const centre = head.getCenter(new THREE.Vector3()), size = head.getSize(new THREE.Vector3());
  addLimb(shadow, centre.clone().setY(centre.y - size.y * 0.15), centre.clone().setY(centre.y + size.y * 0.15), Math.min(size.x, size.z) * 0.45, boneOf(kit, bones.head));
  return shadow;
}

function boneOf(kit: ToonKit, name: string): number {
  const i = kit.bone(name);
  if (i < 0) throw new Error(`cast: the model has no bone "${name}"`);
  return i;
}

/** One colour per slot of the body: the file's, then the look's, then the actor's own. */
function paletteOf(slots: readonly string[], file: CastColours, look: CastColours | undefined, own: CastColours | undefined): Palette {
  return slots.map((name) => own?.[name] ?? look?.[name] ?? file[name] ?? 0xb0b0b0);
}

/** Every part anyone on this body wears. */
function wornOn(key: string): Set<string> {
  const parts = new Set<string>();
  for (const look of Object.values(CAST)) {
    if (bodyKey(look) !== key) continue;
    for (const part of look.parts ?? []) parts.add(part);
    for (const list of Object.values(look.partsWhile ?? {})) for (const part of list) parts.add(part);
  }
  return parts;
}

/** The file's bodies named, as one: their pieces one after another, their slots and parts joined by name. */
function mergeBodies(kit: ToonKit, meshes: readonly string[], file: string): ToonFileBody {
  const bodies = meshes.map((mesh) => {
    const body = kit.bodies.get(mesh);
    if (!body) throw new Error(`cast: ${file} has no mesh "${mesh}". It has: ${[...kit.bodies.keys()].join(', ')}`);
    return body;
  });
  if (bodies.length === 1) return bodies[0];
  const out = { ...bodies[0], pieces: emptyPieces(bodies[0].pieces.slots), parts: [...bodies[0].parts], colours: { ...bodies[0].colours } };
  for (const body of bodies) {
    const p = body.pieces, base = out.pieces.position.length / 3;
    const slot = p.slots.map((s) => slotIndex(out.pieces, s));
    const part = body.parts.map((s) => (out.parts.includes(s) ? out.parts.indexOf(s) : out.parts.push(s) - 1));
    out.pieces.position.push(...p.position);
    out.pieces.normal.push(...p.normal);
    out.pieces.skinIndex.push(...p.skinIndex);
    out.pieces.skinWeight.push(...p.skinWeight);
    out.pieces.uv.push(...p.uv);
    out.pieces.colour.push(...p.colour);
    for (let i = 0; i < p.tone.length; i += 4) out.pieces.tone.push(slot[p.tone[i]] ?? 0, p.tone[i + 1], part[p.tone[i + 2]] ?? 0, p.tone[i + 3]);
    for (const i of p.index) out.pieces.index.push(base + i);
    Object.assign(out.colours, body.colours);
    out.map ??= body.map;
    out.vertexColours ||= body.vertexColours;
  }
  return out;
}

interface Built {
  /** The file's own colours, by slot name. */
  colours: CastColours;
  slots: readonly string[];
  /** The top of the head in the body's units. */
  top: number;
}

/**
 * Loads every model file the cast names, builds the creatures, adds each character's accessories to its body,
 * and makes the cast. The rim of every model takes the sun's colour. It rejects when a file cannot be loaded.
 */
export async function loadCastModels(ctx: ViewContext, sun: THREE.DirectionalLight | null): Promise<CastModels> {
  const cast = createToonCast(ctx);
  cast.setSun(sun);
  const built = new Map<string, Built>();
  const used = new Set(Object.values(CAST).map((look) => look.model));

  for (const name of used) {
    const model = CAST_MODELS[name];
    if (!model) throw new Error(`cast: no model "${name}" in CAST_MODELS`);
    const looks = new Map(Object.values(CAST).filter((look) => look.model === name).map((look) => [bodyKey(look), meshesOf(look)]));
    const gait = { walk: model.clips.walk, run: model.clips.run !== model.clips.walk ? model.clips.run : undefined };

    if (model.file.startsWith('code:')) {
      const creature = model.file.slice(5);
      if (!(CREATURES as readonly string[]).includes(creature)) throw new Error(`cast: no creature "${creature}" is built by code`);
      const made = buildCreature(creature as Creature);
      const walk = gait.walk && gait.walk !== model.clips.idle ? gait.walk : undefined;
      cast.addRig(name, { root: made.root, bones: made.bones, inverses: made.inverses, clips: made.clips, names: model.clips, walk, gaits: walk ? [walk] : [], feet: made.feet });
      const key = `${name}/body`;
      cast.addBody(key, { rig: name, geometry: piecesGeometry(made.pieces), parts: ['body'] });
      built.set(key, { colours: {}, slots: made.pieces.slots, top: made.height });
      continue;
    }

    const kit = await loadToonKit(new URL(model.file, document.baseURI).href);
    const gaits = [gait.walk, gait.run].filter((c): c is string => c !== undefined);
    cast.addRig(name, {
      root: kit.root, bones: kit.bones, inverses: kit.inverses, clips: kit.clips, names: model.clips,
      walk: gait.walk, run: gait.run, runFrom: model.runFrom ?? RUN_FROM, gaits, feet: (model.bones?.feet ?? []).map((f) => kit.bones[kit.bone(f)]?.name ?? f),
    });
    for (const [key, meshes] of looks) {
      const source = mergeBodies(kit, meshes, model.file);
      const pieces = source.pieces;
      const parts = [...source.parts];
      const extras = [...wornOn(key)].filter((part) => !parts.includes(part));
      let shadow: Pieces | null = null;
      let top = new THREE.Box3().setFromArray(pieces.position).max.y;
      if (model.bones) {
        const bones = model.bones;
        const head = boneOf(kit, bones.head);
        const box = headBox(pieces, head);
        top = box.max.y;
        const at = (bone: string): number => new THREE.Vector3().setFromMatrixPosition(kit.bind(boneOf(kit, bone))).y;
        const fit: Fit = {
          head, hand: boneOf(kit, bones.hand), headBox: box, handBind: kit.bind(boneOf(kit, bones.hand)),
          chestY: at(bones.chest), kneeY: at(bones.knee), waist: waistOf(pieces, at(bones.hips), at(bones.chest)),
        };
        shadow = personShadow(kit, bones, box, fit.waist, pieces.slots);
        for (const part of extras) {
          if (!isAccessory(part)) throw new Error(`cast: "${part}" is neither a part of ${key} nor an accessory`);
          parts.push(part);
          addAccessory(shadow, part, fit, parts.length - 1, pieces);
          addAccessory(pieces, part, fit, parts.length - 1);
        }
        // The shadow names the same slots, so an accessory's slot number is the same in both.
        shadow.slots = pieces.slots;
      } else if (extras.length) {
        throw new Error(`cast: ${key} wears ${extras.join(', ')}, but CAST_MODELS.${name} names no bones to hang them on`);
      }
      cast.addBody(key, {
        rig: name, geometry: piecesGeometry(pieces), parts, shadow: shadow ? piecesGeometry(shadow) : undefined,
        map: source.map, vertexColours: source.vertexColours,
      });
      built.set(key, { colours: source.colours, slots: pieces.slots, top });
    }
  }

  const lookOf = (sprite: string): CastLook | undefined => CAST[CAST_ALIAS[sprite] ?? sprite];
  return {
    cast,
    add(sprite, id, o) {
      const look = lookOf(sprite);
      const body = look && built.get(bodyKey(look));
      if (!look || !body) return null;
      return cast.add(bodyKey(look), {
        x: o.x, y: o.y, z: o.z, facing: o.facing, visible: o.visible, animation: o.animation,
        palette: paletteOf(body.slots, body.colours, look.colours, CAST_BY_ID[id]), parts: look.parts, partsWhile: look.partsWhile,
        scale: look.scale ?? look.height / body.top,
      });
    },
    markHeight(sprite) {
      const look = lookOf(sprite);
      if (!look) return 2;
      return look.height + ((look.parts ?? []).some((p) => p.endsWith('hat') || p === 'cap') ? HAT : 0);
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
