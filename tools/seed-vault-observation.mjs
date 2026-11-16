// Install once per page load. Read-only snapshots, no method replacement or clock writes.
export function observeSeedVault() {
  if(window.__seedVaultObservation) throw Error('Seed observer already installed');
  const g=window.__game.view.game, copy=v=>JSON.parse(JSON.stringify(v));
  const snapshot=()=>({clock:copy(g.clock),player:copy(g.player.pos),slots:copy(g.systems.inventory.slots),loose:copy(g.systems.machines.loose()),chests:g.systems.machines.parts().filter(p=>p.kind==='collector_chest').map(p=>[p.id,copy(g.systems.machines.chest(p.id))]),farms:copy(g.systems.farms.all()),pets:copy(g.systems.pets.all()),gear:copy(g.systems.bench.gear()),residents:copy(g.systems.settlement.settlers().map(who=>g.systems.settlement.settler(who)))});
  const rows=[];
  window.__seedVaultObservation={rows,snapshot};
  g.events.onAny((name,data)=>{if(!name.startsWith('ui.') && name!=='frame')rows.push({name,data:copy(data),...snapshot()});});
}
