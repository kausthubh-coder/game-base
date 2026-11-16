// The full checker runs before each ledger mutation; no positional name filter.
import {spawnSync} from 'node:child_process';
const c=await Bun.file('assets-src/act1-icons/redraw/selected.json').json();
for(const [set,spec]of Object.entries(c))for(const name of spec.names){
 const ledger=await Bun.file('assets-src/art-ledger.json').json();
 if(!ledger.icons[set+'/'+name])continue;
 const r=spawnSync('bun',['tools/art/check.mjs','--settle','icon:'+set+'/'+name],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status??1);
}
