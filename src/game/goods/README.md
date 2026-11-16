# goods

Where the farms' goods go, what coin buys, the queen's ledger and the Order's pump. It implements `GoodsApi` (the
"act 1: goods" section of `src/game/api.sim.ts`). The design is handbook chapter 30 ("Where the goods go") and
`playthrough/farms.js` (`market`, `buys`, `ledger`, `pump`, `take`).

## Files

| File | What |
|---|---|
| `index.sim.ts` | The system: the buyers, the ledger, the standing orders, the rush order, the shop, the pump. |
| `goods.test.ts` | Each rule through the real game, and a random run of deliveries, pump changes and saves. |
| `src/game/content/goods.ts` | The data: prices, buyers and caps, the four sections, the orders, the shop, the pump. |
| `src/game/views/ui-goods.view.ts` | Coin by the quick slots, the granary's and the green's panels, the full-screen ledger. |
| `src/game/views/world-goods.view.ts` | The pump in the field or its crate by the camp, and the grey ring round it. |
| `src/game/scenarios/goods-*.sim.ts` | The granary and the ledger, the pump, market day, the whole ledger and its orders. |

## The rules

| What | How |
|---|---|
| Selling | "E" at the granary's counter or the green's stalls (2.5 blocks east of `town.granary` / `granary` and `town.market` / `town.square`, so the queen keeps her own "E") opens the panel. The town trades once `quest.count` has started. Each sale adds to `coin` and sends `goods.sold` and `coin.changed`. |
| Caps | The granary takes 40 wheat a day and 20 more for every pump out of the town's fields (the fewer of `land.pumps`, which the world writes on its own step, and the ledger's own rule, so a pump is out the moment its section fills). The green takes 10 each of honey, moss fiber and quills, twice that on market day, every seventh day. A buyer's day starts fresh on `day.started`. |
| Pump wheat | Wheat that goes into the bag while the pump runs is counted. The granary takes it first; the ledger takes only the rest ("wheat from living fields only"). |
| The ledger | Opens with `scene.22`, from the granary's panel or on "E" 2.5 blocks east of the queen in `town.hall`, where the quest's ledger steps point. The player picks a section and delivers what the bag holds toward it. A full section sets `ledger.<section>.filled` and sends `ledger.filled`; the world pulls pumps (6, 5, 3, 2, 0) and turns off the gold road at four. |
| Standing orders | After the fourth section. Road lamps (5 glow dust, 20 coin; one more `road.lamps` that night) and the town's next wheel (springs, copper, old brass; 50 coin; the queen names a family) can be delivered again and again; `order.<id>` counts them. The Rootworks and the road west are what to pack: they read the bag and are never taken. |
| Rush order | At dawn on market day, the green asks for twice the best daily rate of a farm making a market good (at least 10), by dusk, for 40 coin and six sunroot seeds. |
| The shop | A ring of land (150 coin, twice; `land.rings`, and the region grows `grant()` by 8 blocks each way), the queen's seed (once the granary's section is filled), furniture (good 120, fine 300; `furniture.grade`), a bed at the inn from evening (10), the ferry between the quay and the landing (5), a guide to a marked vault's door (25). |
| The pump | `choice.pump` = `running` sets it in the wheat field (or the plot's middle before there is one); `crated` leaves it in a crate by the camp. While it runs `pump.running` is true (the settlement lowers the Heartstone a step) and the field gives three to one: two more wheat on the ground for each the field makes, and for each hand harvest on the grant. "E" at it pulls it out, or sets it running again. The grey round it fades over three days. |

It sets `step.count.sow` once the granary has bought wheat and a section is picked, and `step.pilgrimage.pack` once
the bag holds the road west's order, each only while that step is open.

## What others read

`coin`, `ledger.<section>.filled`, `pump.running` (quests, the world, the settlement); `land.rings` (the region);
`road.lamps`, `order.wheel` (the world, to draw them); `furniture.grade` and `GoodsApi.furniture().hearts` (the
settlement, for hearts per use); `ledger.mill.filled` (the kitchen: bread takes one wheat, not two).
