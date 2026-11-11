import fs from 'node:fs/promises';
const file='public/assets/manifest.json';
const m=JSON.parse(await fs.readFile(file));
const names=['panel','panel-dark','divider','button','button-light','button-gold','close','back','slot','slot-hover','slot-selected','card','card-rare','card-epic','minimap-ring','dial','name-plate','hint','stars','tooltip'];
const icons=['bag','make','almanac','quests','map','settings','account','resume','save-quit','sun','moon','diamond'];
m.uikit={lazy:true,images:Object.fromEntries(names.map(n=>[n,`ui/kit/${n}.png`])),tabs:{tile:96,sheet:'ui/kit/tabs.png',names:Object.fromEntries(icons.map((n,i)=>[n,[i%4,Math.floor(i/4)]]))}};
await fs.writeFile(file,JSON.stringify(m,null,2)+'\n');
