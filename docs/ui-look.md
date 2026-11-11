# The interface look: Gilded Hearth

The menus, the HUD, the dialogue and the map share one look. It takes Genshin's interface language and makes it
warmer: cream parchment panels with navy ink, fine gold filigree, soft night glass over the world, and almost nothing
boxed over the scene while you walk. Kausthubh turned down two earlier looks: a clean modern one (system sans, teal,
flat cards), which "looked like website UI", and a parchment-and-brass book. Judge every change against this page,
and against his words: cozy, Genshin-like, not a web app and not Minecraft.

## The rules of the look

1. **Over the world, nothing is a box.** The clock, the day, the tracker and the dialogue are cream text with a dark
   shadow. Only the quick slots, the hint, the prompt and the toasts sit on night glass with a gold hairline,
   and those are pills or wells, never cards.
2. **Panels are paper in a gold frame.** Cream (`#ece5d8`) with a lighter top left, a gold hairline inside the edge,
   and the painted kit frame on top when it loads. One deep shadow. Titles are centred in the head over a gold rule.
3. **Gold means picked or next.** The held slot, the slot a stack lands in, the primary button, the tracked quest's
   diamond, the speaker's name. Navy (`#4a5366`) is every other button and the chosen option of a strip.
   Green (`#5e8a4a`) is only for done. Amber (`#c9802a`) is only for new.
4. **Diamonds, not dots.** A heading, a quest step, a new page, the tracker: each mark is a small rotated square.
5. **Two faces.** Fraunces for titles, names, headings and big numbers. Nunito for everything else, at 600 to 800
   weight. Both are variable fonts in `public/fonts` (OFL), about 100 KB together.
6. **Items sit in night wells.** A slot is a dark navy well with a gold rim, so pixel-art icons read on it; the count
   is a cream tag in the bottom right corner.
7. **Pills and circles.** Buttons, strips, tabs, the prompt and choices are fully rounded. Close and back are gold-rimmed
   circles. Panels and wells are 12 to 16 px corners.
8. **Motion is short and never fades text in.** A panel grows 3% and rises 6 px over 160 ms; a line of dialogue rises
   10 px. Everything stops under `prefers-reduced-motion`.

## Tokens

| Token | Value | Use |
|---|---|---|
| paper, paper-2, paper-3, paper-light | `#ece5d8` `#e4dbc9` `#d9cdb6` `#f6f1e7` | panels, strips' tracks, keycaps |
| ink, ink-2 | `#3b4255` `#6b6f7e` | text on paper |
| navy | `#4a5366` | buttons, chosen tab or option |
| night, night-2 | `#1f2433` `#2b3245` | wells, tooltips, the dialogue's shade |
| gold, gold-bright, bronze | `#d3bc8e` `#f0d48a` `#a6895a` | hairlines, picked, primary, names |
| glass | `rgb(22 26 38 / 0.62)` | hint, prompt, toasts |

They are written twice, on purpose: on `.gu-root` in `src/game/ui/styles.ui.ts` (as `--paper`, `--gold` …) and on
`.ui-book` in `src/game/uiview/theme.ts` (as `--ui-paper`, `--ui-gold` …), because `createGameUi` also runs on its own
in demos. Change a value in both.

## Where each piece is styled

| Piece | Stylesheet |
|---|---|
| Bag, Make, Almanac, quests, pause, Settings, title, end card, hints, prompt, toasts, tooltips | `src/game/ui/styles.ui.ts` |
| Tokens, fonts, the shared frame and glass classes, the painted kit layer (`KIT`) | `src/game/uiview/theme.ts` |
| Quick slots, clock, day, tracker, Almanac button, quick-slot tooltip | `STYLE` in `src/game/views/ui-hud.view.ts` |
| Dialogue and choices | `STYLE` in `src/game/views/ui-talk.view.ts` |
| Minimap ring, waypoint chip, full map | `STYLE` in `src/game/views/ui-map.view.ts` |
| Where the hint, prompt and toasts sit | `STYLE` in `src/game/views/ui-notices.view.ts` |
| The features' own defaults (overridden by the views) | `src/features/{hud,dialogue,map}/*.css` |

The view rules start with `.ui-book`, so they win over a feature's stylesheet whatever order the two load in.

## The painted kit

The painted pieces are PNGs in `public/assets/ui/kit/`, made with image generation and recorded in
`assets-src/ui-kit-prompts.json`, their sizes and nine-slice numbers in `assets-src/ui-kit-slices.json`. The manifest
lists them under `uikit`, which the asset loader parses but never fetches: the kit costs the first frame nothing, and
the browser loads each file the first time CSS draws it.

`src/game/uiview/art.ts` turns `uikit.images` into URLs, and `kitStyle()` in `theme.ts` names each one as
`--kit-<name>` on the views' root and adds the class `ui-kit`. Every rule that uses a kit image lives in `KIT` in
`theme.ts` and starts with `.ui-book.ui-kit`, so without the kit everything still draws in CSS alone. The `uikit.tabs`
sheet holds gold line icons; `art.tabElement(name)` draws one, and menus get them through the `ornament` option of
`createGameUi`.

Kit images are drawn at twice their CSS size. A nine-slice of slice 112 is drawn with `border-image: … 112 fill /
56px`. A piece's corners hold all its ornament, and its edges are plain, so they stretch.

## Seeing it

`bun tools/ui-shots.mjs .artifacts/ui/<name>` builds the game and shoots every state (title, HUD, a line, a choice,
bag mid-drag, Make, Almanac, quests, map, toast, pause, Settings, end card) at 1440 by 900 and 390 by 844, plus
`sheet-1440.png` and `sheet-390.png` with all of them on one page. `?show=<state>` opens one state in a running game
(`src/game/views/ui-show.view.ts`).
