# UI replay coverage migration

Inventory made before editing `tools/play-ui.mjs`, at d5aa2252.
Fixtures supply state through the debug door. They do not prove earned rewards or completed story.

| Coverage retained | Current fixture and source |
|---|---|
| Title without save, frozen world, hidden HUD | Actual title, `views/ui-title.view.ts`, `uiview/book.ts` |
| Title art | Guild door image from `views/story-opening.view.ts`, `demos/opening/art/title.webp`; replaces manifest title image |
| Settings, graphics overrides, debug overlays and F3 | Same controls, `ui/menus.ui.ts` |
| New game, film Skip, HUD, clock, weather, minimap, tracker | Actual Grant day opening, ten steps in `content/quests.ts`, `content/opening.ts` |
| Hint lifecycle and overlap | Actual opening plus explicit hint event, `ui/overlay.ui.ts`, `views/ui-notices.view.ts` |
| Dialogue name, portrait, typing, voice, busy state | Hobb waking scene, `views/story-opening.view.ts` and current opening implementation and `content/dialogue.ts` scene 1; instrument before opening |
| Space, E, click reveal then advance, Enter end | Hobb's five-line wake conversation, `views/ui-talk.view.ts`; identity checked throughout |
| Old Tamsin reward | Wake scene now sets scene.1, no inventory reward. Axe/spade are Grant day completion effects in `content/quests.ts`; later fixtures assert supplied axe, never earned reward |
| Nearby talk prompt and E | Tamsin chapter-two walk-up in `content/dialogue.ts`, supplied blessing world |
| Choices and number leaves quick selection unchanged | Independent blessing fixture, `content/dialogue.ts` choice.pump; second choice sets choice.pump=crated |
| Gains/toasts, quick slots and count/icon labels | Explicit supplied item fixture via give, inventory events and HUD |
| Current quest progress | Supplied scene.16 followed by actual choice.pump input; visible pump instruction changes to the Custodian instruction and survives Continue. No pump completion flag is supplied |
| Numeric tracker | No production quest in `content/quests.ts` defines count. Numeric fixtures in `quests/quests.test.ts` are legacy synthetic content. Keep this gap visible; do not inject a fake quest or claim current numeric coverage |
| Drag, right/Shift split, merge, refused split, swap, quick row, Esc cancel | Supplied axe/log/plank inventory, real mouse inputs, same inventory assertions |
| Click move, keyboard move, detail/tooltip | Same supplied inventory and actual inputs |
| Bag, Almanac, quests, Make, placed workbench prompt | Independent blessing fixture with Almanac flag supplied by skipTo, `quests.ts`, `ui/index.ui.ts` |
| Map swaps, close, pause, Settings back | Same actual keys and clicks |
| WASD, soft walk, camera Q/R, quick digits, Tab/M, gather/use | Independent plot fixture, real keys and pointer; unchanged state checks |
| End card and Keep playing | Explicit act.ended presentation event, compare concrete stats, no act completion claim |
| Save, title Continue, restored bag and quest | Save fixture blessing, compare exact persisted inventory, crated pump decision and visible Custodian step after reload |
| Phone title, opening, HUD, hint/talk, bag, map | Fresh 390x844 profile with actual opening, then independent supplied fixture |
| World title drift and frozen simulation | Fresh title=world profile, actual Begin/Skip |

`tools/play-act1.mjs` remains enabled and outside this migration. It still assumes the removed story.
