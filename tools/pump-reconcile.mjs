// Strict, context-local conservation. Alternate imports never contribute to the main ledger.
export function reconcilePumpScope(scope, initial, readSave) {
  const must = (ok, why) => { if (!ok) throw Error(`transactions ${scope.label}: ${why}`); };
  const counts = (slots) => { const result = {}; for (const s of slots) if(s) result[s.id]=(result[s.id]??0)+s.count; return result; };
  const equal = (a,b) => [...new Set([...Object.keys(a),...Object.keys(b)])].every(k=>(a[k]??0)===(b[k]??0));
  const bag = counts(initial.game.systems.inventory.slots);
  const loose = initial.game.systems.machines.loose.map(([item,count,x,y,z])=>({item,count,x,y,z}));
  const near = (a,b) => a && b && ['x','y','z'].every(k=>Math.abs(a[k]-b[k])<0.00001);
  const sources = [];
  let lastFight = null;
  let petDue = initial.game.clock?.seconds + (initial.game.systems.pets?.pets.find(p=>p.bonded)?.find ?? 0);
  const checkpoints = new Map();
  for(const c of scope.checkpoints) { must(Number.isInteger(c.index)&&c.index>=0&&c.index<=scope.rows.length,'checkpoint index'); const list=checkpoints.get(c.index)??[];list.push(c);checkpoints.set(c.index,list); }
  function check(index) { for(const c of checkpoints.get(index)??[]) {
    const save=readSave(c.name); must(equal(bag, counts(save.game.systems.inventory.slots)),`unrecorded inventory change at ${c.name}`);
    // All loose stock must be explained by the import, observed production and collections.
    const total=(rows)=>{const r={};for(const g of rows)r[g.item]=(r[g.item]??0)+g.count;return r;};
    const actual=save.game.systems.machines.loose.map(([item,count,x,y,z])=>({item,count,x,y,z}));
    must(equal(total(loose),total(actual)),`loose conservation at ${c.name}`);
  } }
  check(0);
  for(let i=0;i<scope.rows.length;i++) {
    const r=scope.rows[i], d=r.data;
    if(r.name==='fight.ended'&&d.result==='won') lastFight=d.fight;
    if(r.name==='good.made') {
      must(Number.isInteger(d.count)&&d.count>0,'farm production count');
      const products={field:['wheat'],moss:['moss_fiber'],quill:['quill'],copper:['copper'],seed:['carrot_seeds','sunroot_seeds'],spring:['gear_spring'],pond:['frog_slick'],bee:['honey','wax'],dust:['glow_dust'],rope:['vine_rope'],plough:['old_brass']};
      must(products[d.farm]?.includes(d.item),'wrong farm product');
      const farm=initial.game.systems.farms.farms.find(f=>f.id===d.farm);
      must(farm?.mode==='give','production from preserved Give farm');
      const x=Math.floor(d.at.x)+0.5,z=Math.floor(d.at.z)+0.5;
      const observed=r.loose.find(g=>g.item===d.item&&g.x===x&&g.z===z&&Math.abs(g.y-d.at.y)<0.5);
      must(observed,'farm production stock observation');
      let g=loose.find(g=>g.item===d.item&&g.x===x&&g.z===z&&Math.abs(g.y-d.at.y)<0.5);
      if(!g) {g={item:d.item,count:0,x,y:d.at.y,z};loose.push(g);} g.count+=d.count;
      must(g.count===observed.count,'farm stock count');
    }
    if(r.name==='item.lost') throw Error('transactions: unexpected resource cost');
    if(r.name==='item.gained') {
      must(Number.isInteger(d.count)&&d.count>0,'gain count');
      let source;
      if(!d.at) {
        if(d.id==='old_brass'&&d.count===2&&lastFight===6) {source='fight.6';lastFight=null;}
        else if(d.id==='gear_spring'&&d.count===2&&lastFight===7) {source='fight.7';lastFight=null;}
        else if(d.id==='old_brass'&&d.count===2&&r.flags['fight.6.won']&&scope.label==='boundary'&&sources.filter(s=>s.source==='fight.6').length===1&&sources.every(s=>s.source!=='mill')) source='mill';
      } else {
        const stock=r.loose.find(g=>g.item===d.id&&near({x:g.x,y:g.y+0.3,z:g.z},d.at));
        if(stock) {
          const g=loose.find(g=>g.item===d.id&&near(g,stock));
          must(g&&g.count===stock.count&&g.count>=d.count,'pickup exceeds observed stock');
          must(Math.abs(stock.x-r.player.x)<1.1&&Math.abs(stock.z-r.player.z)<1.1&&Math.abs(stock.y-r.player.y)<1.6,'pickup position');
          g.count-=d.count; source='loose';
        } else {
          const next=scope.rows[i+1];
          if(d.id==='moss_fiber'&&d.count===1&&next?.name==='creature.gave'&&next.data.kind==='mossling'&&next.data.item===d.id&&near(next.data.at,d.at)&&r.creatures.some(c=>c.kind==='mossling'&&near(c.pos,d.at))) source='mossling';
          if(d.id==='wheat_seeds'&&d.count===1&&next?.name==='toast'&&next.data.text==='Your leaftail found a seed.'&&r.pets.some(p=>p.kind==='leaftail'&&p.bonded&&near(p.pos,d.at))) { must(!Number.isFinite(petDue)||r.clock?.seconds+0.1>=petDue,'pet find timer'); petDue=r.clock?.seconds+50; source='leaftail'; }
        }
      }
      must(source,`unattributed gain ${d.id} ${d.count}`);
      bag[d.id]=(bag[d.id]??0)+d.count;
      must(equal(bag,counts(r.slots)),'gain snapshot count');
      sources.push({index:i,item:d.id,count:d.count,source,at:d.at,clock:r.clock});
    }
    check(i+1);
  }
  return sources;
}
