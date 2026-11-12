export const people=['tamsin','maren','odo','gus','mira','wren','juniper','brack'];
export const storySprites=Object.fromEntries([...people,'leaftail','lanternfly'].map(name=>[name,name==='lanternfly'?{size:96,anchor:[48,88],height:58,worldHeight:.85,cols:4,rows:1,animations:{flutter:{frames:4,fps:10,rows:{front:0}}}}:{size:name==='leaftail'?96:128,anchor:name==='leaftail'?[48,88]:[64,120],height:name==='leaftail'?68:110,worldHeight:name==='leaftail'?.85:2,idle:2,walk:4,cols:4,rows:6}]));
export const storyIcons=['plank','fiber','moss_tuft','bread','wheat_seeds','hoe','watering_can','shovel','hammer','workbench','bed','chest','lamp','treat','map','heart'];

storySprites['hero-swing']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:3,rows:3,animations:{tool:{frames:3,fps:9,rows:{front:0,back:1,side:2}}}};

storySprites.custodian={size:96,anchor:[48,88],height:68,worldHeight:0.8,cols:4,rows:7,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}},sleep:{frames:2,fps:2,rows:{front:6}}}};

storySprites['fox-blighted']={...storySprites.leaftail};

// Append-only crowd sheets. Approved cast and original villagers remain frozen.
for (const name of ['pell','corin','hesper','dunn','isolde','nessa','roan','pip']) {
  storySprites['town-' + name] = {size:128,anchor:[64,120],height:name==='pip'?94:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6};
}

storySprites['hero-camp']={size:128,anchor:[64,120],height:110,worldHeight:2,cols:4,rows:9,animations:{sit:{frames:2,fps:2,rows:{front:0,back:1,side:2}},look:{frames:2,fps:2,rows:{front:3,back:4,side:5}},rise:{frames:4,fps:5,rows:{front:6,back:7,side:8}}}};
storySprites['fox-blighted']={size:96,anchor:[48,88],height:68,worldHeight:.85,cols:4,rows:12,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}},stalk:{frames:4,fps:4,rows:{front:6,back:7,side:8}},shake:{frames:2,fps:12,rows:{front:9,back:10,side:11}}}};
