// Read-only observations; no method replacement or simulation advancement.
export function observeGalleryTransactions() {
  const g=window.__game.view.game,copy=v=>JSON.parse(JSON.stringify(v));
  const snapshot=()=>({slots:copy(g.systems.inventory.slots),loose:copy(g.systems.machines.loose()),player:copy(g.player.pos),clock:copy(g.clock),farms:copy(g.systems.farms.all()),goods:copy(g.systems.goods.ledger()),pets:copy(g.systems.pets.all()),creatures:copy(g.systems.creatures.all())});
  const rows=[];window.__pumpTransactions={rows,snapshot};
  g.events.onAny((name,data)=>{if(['item.gained','item.lost','item.crafted','creature.gave','good.made','toast','farm.mode','farm.built','crop.harvested','crop.planted','placeable.placed','block.placed','ledger.filled','coin.changed','fight.ended','fight.event','flag.changed'].includes(name))rows.push({name,data:copy(data),...snapshot()});});
}
