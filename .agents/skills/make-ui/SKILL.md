---
name: make-ui
description: Create or change the game's interface (a menu, panel, HUD piece, dialogue, map, button, painted kit art) in the one Gilded Hearth look. Use for any change to how the interface looks or a new screen or widget.
---

# Make UI

The interface has one look, Gilded Hearth. Read `docs/ui-look.md` first: its eight rules, the tokens and the table
of which stylesheet holds which piece. A new screen reuses what is there: `gu-btn`, `gu-primary`, `gu-slot`,
`gu-strip`, `gu-label`, `ui-frame`, `ui-glass`, the tokens. A new colour, font, radius or shadow needs a reason that
fits the rules, and goes into both token blocks.

## Steps

1. **Before shots.** Run `bun tools/ui-shots.mjs .artifacts/ui/before` (add `--only <states>` for a few). Open
   `sheet-1440.png`. Done when you have looked at every state your change touches.
2. **A restyle shows two first screens.** When the change alters the look of the whole interface (not one widget
   within it), make two directions of one or two screens behind a URL flag (`?ui=`), shoot both, and show Kausthubh
   before building either out. A widget inside the current look skips this step.
3. **Build in the right file.** Panels in `src/game/ui/*.ui.ts` and `styles.ui.ts`; the HUD, dialogue and map in the
   `STYLE` of their `src/game/views/ui-*.view.ts`, with selectors that start `.ui-book`; kit-image rules only in `KIT`
   in `src/game/uiview/theme.ts`, starting `.ui-book.ui-kit`. Keep class names, `data-key` attributes and the order of
   buttons: `tools/play-ui.mjs`, `tools/play-drag.mjs` and the tests find elements by them.
4. **New painted art goes to an image model.** Ask a GPT helper with image generation (Sol) for the piece, with the
   palette and the kit's rules from `docs/ui-look.md`: drawn at 2x, transparent, no text, ornament only in the corners
   of a nine-slice, plain stretchable edges. It adds the file to `public/assets/ui/kit/`, the name to `uikit.images`
   in the manifest, the prompt to `assets-src/ui-kit-prompts.json` and the slice to `assets-src/ui-kit-slices.json`.
   Drawing art in CSS or code stands in for a picture only as the fallback under `ui-kit`.
5. **After shots.** Run `bun tools/ui-shots.mjs .artifacts/ui/after`. Compare both sheets at 1440 and at 390. Done
   when every state you touched reads as the same look as its neighbours, nothing overlaps or clips, text on the
   world is readable on bright grass, and the phone sheet keeps 44 px targets.
6. **Checks.** `bun tools/verify-assets.mjs`, `bun run check`, then the `verify-game` skill, which runs the browser
   plays that click through the interface.

## What breaks easily

- A plain `button` reset with a class selector loses to `.gu-root button`; the reset is wrapped in `:where()` so a
  single class wins. Keep it that way.
- A fieldset's legend cannot sit in a grid; Settings floats it left of its strip instead.
- The kit is lazy. Never move it into `ui` or another entry the loader preloads (`src/features/assets/manifest.ts`):
  every image there is fetched and decoded before the first frame.
- Pixel-art icons stay `image-rendering: pixelated` at whole multiples of 32 px. Kit art and line icons use `auto`.
