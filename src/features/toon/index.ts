// Characters as toon-shaded 3D models: a whole crowd of one body in three draw calls, posed on the GPU from baked
// clips, recoloured per character, lit in steps by the scene's sun and sky.
//
//   const kit = await loadToonKit(url);                         // a rig, its clips and bodies (see load.ts)
//   const cast = createToonCast(ctx);
//   cast.setSun(sky.sun);                                       // the rim takes the sun's colour
//   cast.addRig('people', { ...kit, walk: 'Walk', run: 'Run', gaits: ['Walk', 'Run'], feet: ['footl', 'footr'] });
//   cast.addBody('slim', { rig: 'people', geometry: piecesGeometry(kit.bodies.get('slim')!.pieces), parts: ['body'] });
//   const hero = cast.add('slim', { palette, parts: ['short-hair'], x, y, z });
//   hero.setFacing(Math.PI / 2);                                // 0 is north (-z), a quarter turn is east (+x), as for sprites
//   hero.play('walk');                                          // safe every frame; the walk turns into a run with speed
//   cast.update(dt, ctx);                                       // once a frame
export {
  SLOT, SLOTS, createToonCast,
  type Palette, type SlotName, type ToonAddOptions, type ToonBodySpec, type ToonCast, type ToonHandle, type ToonOptions, type ToonRigSpec, type ToonStats,
} from './toon.view.ts';
export { BAKE_RATE, bake, bakedTexture, strideOf, type BakeOptions, type Baked, type BakedClip } from './bake.ts';
export { loadToonKit, type ToonFileBody, type ToonKit } from './load.ts';
export { addGeometry, addLimb, addPiece, addShell, emptyPieces, lathe, partBox, piecesGeometry, place, slotIndex, type FromGeometry, type Pieces } from './shapes.ts';
export { ACCESSORIES, addAccessory, headBox, isAccessory, waistOf, type Accessory, type Fit } from './accessories.ts';
export { CREATURES, buildCreature, type Creature, type CreatureKit } from './creatures.ts';
