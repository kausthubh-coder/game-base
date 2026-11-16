export const people=['tamsin','maren','odo','gus','mira','wren','juniper','brack'];
export const storySprites=Object.fromEntries([...people,'leaftail','lanternfly'].map(name=>[name,name==='lanternfly'?{size:96,anchor:[48,88],height:58,worldHeight:.85,cols:4,rows:1,animations:{flutter:{frames:4,fps:10,rows:{front:0}}}}:{size:name==='leaftail'?96:128,anchor:name==='leaftail'?[48,88]:[64,120],height:name==='leaftail'?68:110,worldHeight:name==='leaftail'?.85:2,idle:2,walk:4,cols:4,rows:6}]));
export const storyIcons=['plank','fiber','moss_tuft','bread','wheat_seeds','hoe','watering_can','shovel','hammer','workbench','bed','chest','lamp','treat','map','heart'];

// Act 1 concept cast, rebuilt by people-world.mjs.
for(const name of ['elowen','calla','aldric','ren','ilara','auren','town-acolyte-a','town-acolyte-b']) {
 storySprites[name]={size:128,anchor:[64,120],height:110,worldHeight:({elowen:1.86,calla:2.33,aldric:1.8,ren:2.1,ilara:2.15,auren:2.39}[name]??2),idle:2,walk:4,cols:4,rows:6};
}

storySprites['hero-swing']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:3,rows:3,animations:{tool:{frames:3,fps:9,rows:{front:0,back:1,side:2}}}};

storySprites.custodian={size:96,anchor:[48,88],height:68,worldHeight:1.11,cols:4,rows:7,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}},sleep:{frames:2,fps:2,rows:{front:6}}}};


// Append-only crowd sheets. Approved cast and original villagers remain frozen.
for (const name of ['pell','corin','hesper','dunn','isolde','nessa','roan','pip']) {
  storySprites['town-' + name] = {size:128,anchor:[64,120],height:name==='pip'?94:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6};
}

// Fight lab beasts. Separate pose sheets use the same frame and anchor contract.
storySprites.thistlehog={size:96,anchor:[48,88],height:68,worldHeight:1.0,cols:4,rows:6,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}}};
storySprites.gearling={size:96,anchor:[48,88],height:68,worldHeight:1.3,cols:4,rows:6,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}}};
storySprites['thistlehog-fight']={size:96,anchor:[48,88],height:74,worldHeight:1.0,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites.boar={size:192,anchor:[96,176],height:150,worldHeight:3.45,cols:4,rows:6,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}}};
storySprites['gearling-fight']={size:96,anchor:[48,88],height:68,worldHeight:1.3,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['boar-fight']={size:192,anchor:[96,176],height:150,worldHeight:3.45,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};

// BEGIN fight-lab hero and pets: append-only contract for lab/fight.
storySprites['hero-cut'] = {size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:3,animations:{cut:{frames:4,fps:10,rows:{front:0,back:1,side:2}}}};
storySprites['hero-moves'] = {size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['hero-call'] = {size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['leaftail-fight'] = {size:96,anchor:[48,88],height:68,worldHeight:.85,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['pebblepup'] = {size:96,anchor:[48,88],height:68,worldHeight:.9,idle:2,walk:4,cols:4,rows:6};
storySprites['pebblepup-fight'] = {size:96,anchor:[48,88],height:68,worldHeight:.9,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
// END fight-lab hero and pets.
storySprites['hero-bow'] = {size:128,anchor:[64,120],height:108,worldHeight:2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['hero-staff'] = {size:128,anchor:[64,120],height:108,worldHeight:2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['hero-cut-back'] = {size:128,anchor:[64,120],height:108,worldHeight:2,cols:4,rows:3,animations:{cut:{frames:4,fps:10,rows:{front:0,back:1,side:2}}}};
// Verdant Stag: front, back, right profile. Boss sheets use 384-square cells.
storySprites['stag'] = {size:384,anchor:[192,364],height:320,worldHeight:13.2,cols:4,rows:3,animations:{idle:{frames:4,fps:3,rows:{front:0,back:1,side:2}}}};
storySprites['stag-fight'] = {size:384,anchor:[192,364],height:320,worldHeight:13.2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};
storySprites['stag-free'] = {size:384,anchor:[192,364],height:320,worldHeight:13.2,cols:4,rows:3,animations:{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}};

// Farm creatures. Insects are exaggerated for readability; lanternfly's legacy entry stays 4x1.
const farmMotion={idle:{frames:4,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:8,rows:{front:3,back:4,side:5}}};
for(const [name,worldHeight,height] of [['mossling',.64,68],['burrower',.79,68],['frog',.59,58],['bee',.55,58],['lanternfly-world',.85,58]]){
 storySprites[name]={size:96,anchor:[48,88],height,worldHeight,cols:4,rows:name==='burrower'?12:name==='mossling'||name==='frog'?9:6,animations:{...farmMotion}};
}
storySprites.mossling.animations.settle={frames:4,fps:3,rows:{front:6,back:7,side:8}};
storySprites.burrower.animations.surface={frames:4,fps:6,rows:{front:6,back:7,side:8}};
storySprites.burrower.animations.dive={frames:4,fps:6,rows:{front:9,back:10,side:11}};
storySprites.frog.animations.catch={frames:4,fps:8,rows:{front:6,back:7,side:8}};
// Act-1 creature forms. Replacements are rebuilt by beasts-act1.mjs.
for(const [name,worldHeight]of [['fox',.85],['fox-blighted-fight',.85],['thistlehog-blighted',.92],['thistlehog-calmed',1.0],['boar-blighted',3.74],['boar-calmed',3.45],['lynx',1.65],['lynx-fight',1.65],['rootsnare',1.6],['rootsnare-fight',1.6],['rootsnare-calmed',1.6]]){
 const size=name.startsWith('boar')?192:96,isFight=name.endsWith('-fight');
 storySprites[name]={size,anchor:size===192?[96,176]:[48,88],height:size===192?150:68,worldHeight,cols:4,rows:isFight?3:6,animations:isFight?{poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}}:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}}};
}

// Home cast redraws. Lineup proportions live in worldHeight; shared cells keep the existing anchors.
export const homeCast=['hobb','dax','mina','gus','wren','tansy','holt'];
// The portrait sheet: three original rows, the home cast's rows (home.mjs), then the world cast's (people-world.mjs).
export const portraitRows={home:3,world:3+homeCast.length,hero:20};
for(const [name,metres] of [['hobb',1.48],['dax',1.8],['mina',1.5],['gus',1.7],['wren',1.75],['tansy',1.52],['holt',1.72]]) {
 storySprites[name]={size:128,anchor:[64,120],height:110,worldHeight:2*metres/1.54,idle:2,walk:4,cols:4,rows:6};
}
storySprites['hero-camp']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:9,animations:{sit:{frames:2,fps:2,rows:{front:0,back:1,side:2}},look:{frames:2,fps:2,rows:{front:3,back:4,side:5}},rise:{frames:4,fps:5,rows:{front:6,back:7,side:8}}}};
storySprites['fox-blighted']={size:96,anchor:[48,88],height:68,worldHeight:.85,cols:4,rows:12,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}},stalk:{frames:4,fps:4,rows:{front:6,back:7,side:8}},shake:{frames:2,fps:12,rows:{front:9,back:10,side:11}}}};

storySprites["custodian-wake"]={size:96,anchor:[48,88],height:68,worldHeight:1.11,cols:4,rows:4,animations:Object.fromEntries(["sleep","eye","waking","idle"].map((name,row)=>[name,{frames:1,fps:1,rows:{front:row}}]))};

// Published core Braid sheets remain inactive until the full action family exists.
const braidContact=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../assets-src/hero-braid/ground-contact.json',import.meta.url),'utf8'));
storySprites['hero-braid']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:6,rows:6,groundContact:braidContact['hero-braid'],animations:{idle:{frames:4,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:6,fps:10,rows:{front:3,back:4,side:5}}}};
storySprites['hero-braid-swing']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:3,rows:3,groundContact:braidContact['hero-braid-swing'],animations:{tool:{frames:3,fps:9,rows:{front:0,back:1,side:2}}}};
