export const sprites = {
 hero: {size:128,anchor:[64,120],height:110,worldHeight:2,idle:4,walk:6,tool:3,cols:6,rows:7},
 'villager-a': {size:128,anchor:[64,120],height:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6},
 'villager-b': {size:128,anchor:[64,120],height:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6},
 pet: {size:96,anchor:[48,88],height:68,worldHeight:0.85,idle:2,walk:4,cols:4,rows:6},
 critter: {size:96,anchor:[48,88],height:68,worldHeight:0.85,idle:2,walk:4,cols:4,rows:6},
};
export const tiles = ['grass_top','grass_top','grass_top','grass_side','dirt','dirt','dirt','tilled_soil','path','sand','sand','sand','clay','stone','stone','stone','mossy_stone','cobble','stone_brick','oak_log_side','oak_log_top','oak_plank','birch_log_side','pine_log_side','thatch','shingle','plaster','glass','oak_leaves','oak_leaves','oak_leaves','pine_needles'];
export const icons = ['wood','stone','seed','wheat','berry','fish','pickaxe','axe','sword','bow','staff','potion','coin','key','book','lantern'];
export function animations(s){return {idle:{frames:s.idle,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:s.walk,fps:10,rows:{front:3,back:4,side:5}},...s.tool?{tool:{frames:3,fps:8,rows:{front:6}}}:{}};}

export const extraTiles = ['tilled_top','path_top','path_side','birch_log_top','pine_log_top','lume_crystal','lamp_top','lamp_side'];
