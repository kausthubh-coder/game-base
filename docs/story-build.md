# Building the game from the story

Kausthubh picked the game's story on 2026-11-11 and said to build the game out from it. The story is the
handbook chapter `~/dev/sandbox/game-look-test/design/04d-new-story.md`. This page is the order it gets
built in, and what is done. Act 1 (Greenhollow) comes first and is version 1. One other realm comes next,
before the remaining four are detailed.

## What the story asks of act 1

By the end of act 1 the player has: opened the Shut Door and got the Mark, woken the Custodian, built a
homestead that grows into a hamlet, met the Order of the Dawn and been offered its machine, explored
Greenhollow's small ruins and three vaults, built the terrace that lets Hollowmere shut off its root pumps,
freed the Verdant Stag in the Rootworks, and been sent on the pilgrimage by the Green Mother.

## The slices

Each slice is playable when it lands, and `bun run check` plays it.

| # | Slice | What the player gets | Needs | State |
|---|---|---|---|---|
| 1 | The first night | A sixth quest between the roof and the leaftail. A Blighted fox, the Shut Door, Ilara's Hall, the Mark, the Custodian, the Heartstone's number, Tamsin and the town at the stone in the morning. | | Done: `src/game/hall`, played by `src/game/play` |
| 2 | The Hall's look | The Custodian's own sprite. The ruin's props: door, Heartstone, Gate, lamps that light, mural, pillars, plinth. A grey sheet for the Blighted fox. | 1 | In progress: two helpers, sprite and props |
| 3 | The Heartstone on screen | A gauge on the HUD. The Custodian comments when it rises. The first Gate, to Hollowmere, wakes at a level. | 1 | Not started |
| 4 | Your settlement | Camp, homestead, hamlet and freehold as steps, each needing homes, food and people plus one story event. Hobb and Dax arrive. Gus asks to stay. | 3 | Not started. Game design has the numbers. |
| 5 | The Order arrives | The Green Mother's blessing in hour two. Calla, the escort who seals ruins and takes Echo stones. The root pump: three times the yield, and it drains the Heartstone. Blessing stones on the town. | 3 | Not started |
| 6 | The Mark in a fight | Calm, open and call. A guard bar on Blighted beasts. A boar too strong to calm yet. The first weapon. | 1 | Not started. There is no fighting in the game today. |
| 7 | Greenhollow's ruins | Small ruins and shrines to find. Three vaults (Pump House, Seed Vault, Lamp Gallery), each with a keystone. Echo stones that play a memory. Place spirits only the player sees. | 6 | Not started |
| 8 | The build | Water uphill: wheel, shaft and sprinkler on a terrace that out-yields the town. Hollowmere shuts off its pumps, and the priests do not like it. | 4, 5 | Not started. Sprinklers exist. |
| 9 | The Rootworks and the Stag | The great ruin opens with three keystones. The Verdant Stag, chained and feral: the first boss. Its pact gives Bloom. Queen Maren grants the valley. | 6, 7, 8 | Not started |
| 10 | The world's two meters | The Dawn on the horizon and its six bands on the compass. The High Road on the map, with its lit sections. | | Not started |

## Carried over, to fix as slices land

- **Voice.** New and changed lines have no clip yet: Tamsin's line about the door, her morning scene, and one line each for Juniper and Gus. `tools/voice.ts` makes them, and it needs `ELEVENLABS_API_KEY` in `.env.local`, which this Mac's checkouts do not have. The Custodian has no voice picked.
- **The festival's last line.** Tamsin still says evening came early, which belonged to the old story. Slice 5 gives the festival its new wrong note.
- **The handbook.** Game design, the first playable, Version 1, Fights, Pets and Mechanics still describe the old story. They are rewritten as the slice that changes each one lands.
- **The browser play.** `tools/play-act1.mjs` plays five quests with the real keys. It gets the night when slice 2 is in.
