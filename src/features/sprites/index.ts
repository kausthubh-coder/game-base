// 2D characters in the 3D world: one quad per character, all drawn from one atlas in two draw calls
// (the characters, and their shadows).
//
//   const assets = await loadAssets();                              // src/features/assets
//   const grey = assets.variant('pet', { '#d67c59': '#918996' });   // color variants first: each one repacks the atlas
//   const sprites = createSprites(ctx, { assets });
//   sprites.setSky(sky.look);                                       // optional: the sky feature's light instead of the built-in daylight
//   const fox = sprites.add(grey.name, { x: 4, y: 0, z: -2 });
//   fox.setFacing(Math.PI / 2);                                     // 0 is north (-z), a quarter turn is east (+x), like the hero's body
//   fox.play('walk');                                               // safe to call every frame
//   fox.setPosition(x, y, z);                                       // the feet
//   sprites.update(dt, ctx);                                        // once a frame, after the camera has moved
export {
  createSprites,
  type AddOptions, type PlayOptions, type SpriteHandle, type SpriteStats, type Sprites, type SpritesOptions, type SpritesSky,
} from './sprites.view.ts';
export { VIEW_BACK, VIEW_FRONT, VIEW_SIDE_LEFT, VIEW_SIDE_RIGHT, cameraYawOf, pickView, type SpriteView } from './facing.ts';
export { frameAt, seededRandom } from './animation.ts';
export { dayLight, lightCurve } from './light.ts';
