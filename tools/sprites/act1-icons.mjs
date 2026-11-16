// Cell order in the generated masters. Sources and prompts: assets-src/act1-icons/.
export const act1Icons = {
  'act1-farm': { cols: 5, rows: 3, names: ['wheat','carrot','sunroot','seeds','moss-fiber','quills','copper','gear-spring','frog-slick','honey','wax','glow-dust','vine-rope','tusk-tip','shed-pelt'] },
  'act1-kit': { cols: 3, rows: 2, names: ['quill-strip','lamp-post','slick-patch','clapper','pusher-plate','salve'] },
  'act1-story': { cols: 4, rows: 2, names: ['brass-key','pump-house-keystone','lamp-gallery-keystone','seed-vault-keystone','memory-stone','blessing-stone','queens-charter','road-writ'] },
  'act1-found': { cols: 4, rows: 2, names: ['old-brass','heartwood','plank','hobbs-meal','travel-meal','bread','coin'] },
  'act1-weapons': { cols: 4, rows: 3, names: ['sword','sword-copper','sword-brass','sword-tusk','bow','bow-copper','bow-spring','bow-tusk','staff','staff-copper','staff-brass','staff-rootwood'] },
  'act1-equipment': { cols: 5, rows: 3, names: ['canvas-jacket','padded-jacket','quill-coat','root-weave','quill-edge','padded-grip','spring-hilt','glow-cap','slick-sheath','honey-binding','axe','hoe','spade','watering-can','saw'] },
};
// Existing content names remain valid; plain ids above are the Act 1 contract.
export const act1Aliases = { fiber:'moss-fiber', wheat_seeds:'seeds', seed:'seeds', key:'brass-key', watering_can:'watering-can', shovel:'spade' };

// Redraw only the named cells. The archived pre-redraw atlas is the source of all
// other decoded pixels, so regenerating a master cannot change an unrelated icon.
export async function buildIconRedraw(set,palette) {
 const {readJSON,pixels,cell,clean,bounds,snap,fittedMode,png,root}=await import('./lib.mjs');
 const fs=await import('node:fs/promises');
 const sharp=(await import('sharp')).default;
 const folder='assets-src/act1-icons/redraw/';
 const config=await readJSON(folder+'selected.json');
 if(!config[set])return false;
 const spec=config[set], atlas=await pixels(folder+set+'-baseline.png');
 const source=await pixels(folder+spec.source);
 for(const [i,name]of spec.names.entries()) {
  const override=spec.overrides?.[name];
  const p=override
   ? await cell(await pixels(folder+override.source),override.index%override.cols,Math.floor(override.index/override.cols),override.cols,override.rows)
   : await cell(source,i%spec.cols,Math.floor(i/spec.cols),spec.cols,spec.rows);
  clean(p,0.03);snap(p,palette);
  // The legacy Act 1 sheet checker keeps four clear pixels on every side.
  const b=bounds(p),q=await fittedMode(p,b,24/Math.max(b.width,b.height));
  const data=await sharp(q.input).ensureAlpha().raw().toBuffer();
  const index=act1Icons[set].names.indexOf(name);
  if(index<0)throw Error('Unknown redraw icon '+name);
  const left=index%act1Icons[set].cols*32,top=Math.floor(index/act1Icons[set].cols)*32;
  for(let y=0;y<32;y++)atlas.data.fill(0,((top+y)*atlas.w+left)*4,((top+y)*atlas.w+left+32)*4);
  const dx=left+Math.floor((32-q.w)/2),dy=top+Math.floor((32-q.h)/2);
  for(let y=0;y<q.h;y++)data.copy(atlas.data,((dy+y)*atlas.w+dx)*4,y*q.w*4,(y+1)*q.w*4);
 }
 await fs.writeFile(root+'public/assets/icons/'+set+'.png',await png(atlas.data,atlas.w,atlas.h));
 return true;
}
