// Maximum per-channel row/column mean deviation in a 4 by 4 repeat, RGB units 0..255.
// Repeating a tile four times has the same line means as one tile, computed explicitly here.
export const bandThreshold = 18;
export function banding(p) {
 const n= p.w*4, h=p.h*4, mean=[0,0,0], rows=Array.from({length:h},()=>[0,0,0]), cols=Array.from({length:n},()=>[0,0,0]);
 for(let y=0;y<h;y++)for(let x=0;x<n;x++)for(let c=0;c<3;c++){
  const v=p.data[((y%p.h)*p.w+x%p.w)*4+c]; mean[c]+=v/(n*h); rows[y][c]+=v/n; cols[x][c]+=v/h;
 }
 return Math.max(...[...rows,...cols].flatMap(line=>line.map((v,c)=>Math.abs(v-mean[c]))));
}
// Tiles whose rows or columns differ on purpose. A grass side is a green lip over dirt, tilled soil is
// furrows, bricks and shingles are laid in courses, and mossy stone has patches of moss. The banding
// rule is for natural, even surfaces.
export const bandExempt = new Set(['grass_side', 'tilled_top', 'tilled_soil', 'stone_brick', 'shingle', 'mossy_stone']);
