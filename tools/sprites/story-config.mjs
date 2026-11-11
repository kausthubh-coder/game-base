export const people=['tamsin','maren','odo','gus','mira','wren','juniper','brack'];
export const storySprites=Object.fromEntries([...people,'leaftail','lanternfly'].map(name=>[name,name==='lanternfly'?{size:96,anchor:[48,88],height:58,worldHeight:.85,cols:4,rows:1,animations:{flutter:{frames:4,fps:10,rows:{front:0}}}}:{size:name==='leaftail'?96:128,anchor:name==='leaftail'?[48,88]:[64,120],height:name==='leaftail'?68:110,worldHeight:name==='leaftail'?.85:2,idle:2,walk:4,cols:4,rows:6}]));
export const storyIcons=['plank','fiber','moss_tuft','bread','wheat_seeds','hoe','watering_can','shovel','hammer','workbench','bed','chest','lamp','treat','map','heart'];

storySprites['hero-swing']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:3,rows:3,animations:{tool:{frames:3,fps:9,rows:{front:0,back:1,side:2}}}};

// Append-only crowd sheets. Approved cast and original villagers remain frozen.
for (const name of ['pell','corin','hesper','dunn','isolde','nessa','roan','pip']) {
  storySprites['town-' + name] = {size:128,anchor:[64,120],height:name==='pip'?94:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6};
}

// BEGIN fight-lab hero and pets: append-only contract for lab/fight.
storySprites['hero-cut'] = {size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:3,animations:{cut:{frames:4,fps:10,rows:{front:0,back:1,side:2}}}};
// END fight-lab hero and pets.
