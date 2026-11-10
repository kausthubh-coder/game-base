import {catalog} from './props.ts';
import {triangles} from './geometry.ts';
const rows=catalog.map(p=>{const g=p.build(),n=triangles(g);if(!g.getAttribute('color')||g.groups.length||!Array.from(g.getAttribute('position').array).every(Number.isFinite))throw Error(p.name+' invalid geometry');g.dispose();return {prop:p.name,triangles:n,budget:p.budget,pass:n<=p.budget};});
console.table(rows);if(rows.some(r=>!r.pass))process.exit(1);
console.log(`PASS: ${rows.length} merged, colored geometries within budget`);
await Bun.write(new URL('../../.artifacts/props-astra/triangles.json',import.meta.url),JSON.stringify(rows,null,2));
