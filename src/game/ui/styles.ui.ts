// The look, "Gilded Hearth" (docs/ui-look.md): cream parchment panels with a gold hairline inside the edge, navy
// ink, night glass over the world, Fraunces for titles and Nunito for the rest, gold for the thing picked and the
// next action. These rules draw it in CSS alone; the views add the painted kit on top (src/game/uiview/theme.ts).
// Every size answers to the root's own width (a container query), not the window's.

export const STYLES = /* css */ `
.gu-root {
  /* The same values as .ui-book in src/game/uiview/theme.ts. */
  --paper: #ece5d8;
  --paper-2: #e4dbc9;
  --paper-3: #d9cdb6;
  --paper-4: #cdbfa4;
  --paper-light: #f6f1e7;
  --plate: var(--paper-light);
  --ink: #3b4255;
  --ink-2: #6b6f7e;
  --ink-3: #9a9caa;
  --line: rgb(59 66 85 / 0.14);
  --line-strong: rgb(59 66 85 / 0.3);
  --gold: #d3bc8e;
  --gold-bright: #f0d48a;
  --bronze: #a6895a;
  --brass: var(--gold);
  --brass-dark: var(--bronze);
  --night: #1f2433;
  --night-2: #2b3245;
  --navy: #4a5366;
  /* gold: the next action, the thing picked, the slot a stack will land in */
  --accent: #c9a25e;
  --accent-press: #b48c4a;
  --accent-soft: rgb(211 188 142 / 0.3);
  --accent-ink: var(--night);
  --accent-light: var(--gold-bright);
  /* a finished thing, and a new one */
  --done: #5e8a4a;
  --new: #c9802a;
  --new-light: #f2c46b;
  --scrim: rgb(14 17 27 / 0.62);
  --shadow: rgb(10 12 20 / 0.35);
  --lift: 0 2px 4px rgb(10 12 20 / 0.18), 0 18px 48px rgb(10 12 20 / 0.38);
  --frame: inset 0 0 0 5px var(--paper), inset 0 0 0 6px var(--gold), inset 0 0 0 7px rgb(211 188 142 / 0.35);
  --glass: rgb(22 26 38 / 0.62);
  --glass-2: rgb(255 255 255 / 0.08);
  --glass-line: rgb(211 188 142 / 0.45);
  --glass-ink: #f6f1e7;
  --glass-ink-2: #d9d2c3;
  --glass-shadow: 0 2px 12px rgb(10 12 20 / 0.28);
  --tip: #232838;
  --radius: 12px;
  --radius-sm: 7px;
  --display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
  /* spacing: 4 8 12 16 24 32 48 */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  --target: 44px;
  --slot: 64px;
  --gu-size: 1;

  position: absolute; inset: 0; z-index: 20; overflow: hidden;
  container: gu / size;
  pointer-events: none; user-select: none; -webkit-user-select: none;
  color: var(--ink); color-scheme: light;
  font: 500 16px/1.5 'Nunito', ui-rounded, 'SF Pro Rounded', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: lining-nums;
}
.gu-root *, .gu-root *::before, .gu-root *::after { box-sizing: border-box; }
.gu-root [hidden] { display: none !important; }
/* :where keeps the reset weightless, so any class below can set a margin. */
.gu-root :where(h1, h2, h3, p, ul, dl, dd, fieldset, legend) { margin: 0; padding: 0; border: 0; }
.gu-root :where(ul) { list-style: none; }
.gu-root :where(h1, h2, h3) { font-size: inherit; font-weight: 600; }
:where(.gu-root) button, :where(.gu-root) input { font: inherit; color: inherit; }
.gu-root button { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.gu-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.gu-num { font-variant-numeric: tabular-nums lining-nums; }
.gu-quiet { color: var(--ink-2); font-weight: 500; }
/* A small heading: Fraunces, a gold diamond before it. */
.gu-label { display: flex; align-items: center; gap: 8px; font-family: var(--display); font-size: 15px; font-weight: 650; line-height: 1.3; letter-spacing: 0.01em; color: var(--ink); }
.gu-label::before { content: ''; flex: none; width: 7px; height: 7px; background: var(--accent); transform: rotate(45deg); }
.gu-empty { color: var(--ink-2); max-width: 44ch; text-wrap: pretty; font-style: italic; }

/* ---- pictures and keys ---- */
.gu-pic { position: relative; display: block; flex: none; overflow: hidden; }
.gu-pic-cell { position: absolute; left: 0; top: 0; transform-origin: 0 0; background-repeat: no-repeat; image-rendering: pixelated; }
.gu-pic-small .gu-pic-cell { image-rendering: auto; }
.gu-pic-plain { display: grid; place-items: center; background: var(--paper-3); color: var(--ink-2); font-weight: 700; line-height: 1; border-radius: var(--radius-sm); }
.gu-keys { display: inline-flex; align-items: center; gap: var(--s1); flex: none; }
.gu-keys-join { color: var(--ink-2); font-size: 13px; }
.gu-root kbd {
  display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 7px;
  font: inherit; font-size: 13px; font-weight: 800; line-height: 1; white-space: nowrap; color: var(--ink);
  background: var(--paper-light); border: 0; border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--bronze), inset 0 -2px 0 rgb(166 137 90 / 0.45);
}

/* ---- buttons: navy pills with a gold hairline; the next action is gold ---- */
.gu-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: var(--target); padding: 0 22px;
  color: var(--paper-light); background: linear-gradient(180deg, #56607a, var(--navy) 55%, #424a5c); border: 0; border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 6px rgb(10 12 20 / 0.22);
  font-weight: 700; letter-spacing: 0.01em; white-space: nowrap;
  transition: transform 80ms var(--ease), filter 120ms var(--ease);
}
.gu-btn:hover { filter: brightness(1.12); }
.gu-btn:active { transform: scale(0.97); filter: brightness(0.95); }
.gu-btn.gu-primary { color: var(--night); background: linear-gradient(180deg, #f6dfa0, #e2c07a 55%, #cfa863); box-shadow: inset 0 0 0 1px rgb(255 247 220 / 0.7), 0 0 0 1px var(--bronze), 0 2px 10px rgb(201 162 94 / 0.45); }
.gu-btn:disabled, .gu-btn[aria-disabled='true'] { color: var(--ink-3); background: var(--paper-2); box-shadow: inset 0 0 0 1px var(--line-strong); cursor: default; transform: none; filter: none; }
/* A menu button with a line icon: the icon in a round well at the left. */
.gu-btn-icon { justify-content: flex-start; padding-left: 8px; }
.gu-btn-ornament { flex: none; display: grid; place-items: center; width: 30px; height: 30px; padding: 4px; border-radius: 50%; background: rgb(14 17 27 / 0.35); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.5); }
.gu-primary .gu-btn-ornament { background: rgb(59 66 85 / 0.88); }
.gu-close {
  display: grid; place-items: center; flex: none; width: 38px; height: 38px; margin: -4px -6px -4px auto;
  color: var(--ink); background: var(--paper-light); border: 0; border-radius: 50%; font-size: 22px; font-weight: 600; line-height: 1;
  box-shadow: inset 0 0 0 1.5px var(--gold), 0 1px 3px rgb(10 12 20 / 0.2);
  transition: transform 80ms var(--ease);
}
.gu-close:hover { background: #fff; transform: scale(1.06); }
.gu-close:active { transform: scale(0.96); }

/* ---- the stage and the panel ---- */
.gu-stage {
  position: absolute; inset: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; padding: var(--s4);
  background: radial-gradient(120% 90% at 50% 45%, rgb(20 24 36 / 0.45), rgb(10 12 20 / 0.82)); pointer-events: auto;
}
.gu-panel {
  position: relative; display: flex; flex-direction: column; min-width: 0; max-width: 100%; max-height: 100%;
  padding: 30px 36px 34px;
  background: radial-gradient(140% 100% at 20% 0%, var(--paper-light), var(--paper) 60%); border: 0; border-radius: 16px;
  box-shadow: var(--frame), var(--lift);
  zoom: var(--gu-size);
  animation: gu-in 160ms var(--ease);
}
.gu-panel:focus-visible { outline: none; }
/* It grows a little from the middle but never fades, so a panel is readable from its first frame. */
@keyframes gu-in { from { transform: scale(0.97) translateY(6px); } }
.gu-corner { display: none; }
.gu-panel-head { position: relative; display: flex; align-items: center; gap: var(--s5); min-height: var(--target); margin-bottom: var(--s5); padding-bottom: var(--s3); }
.gu-panel-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gold) 20%, var(--gold) 80%, transparent); }
.gu-panel-title { font-family: var(--display); font-size: 26px; font-weight: 650; line-height: 1.1; letter-spacing: -0.005em; color: var(--ink); }
/* The body scrolls. The padding keeps a focus ring at its edge from being cut off. */
.gu-panel-body { min-height: 0; margin: -4px; padding: 4px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--paper-4) transparent; }
.gu-section + .gu-section, .gu-choices + .gu-section, .gu-section + .gu-choices { margin-top: var(--s6); }
.gu-section > .gu-label, .gu-choices > .gu-label { margin-bottom: var(--s3); }

/* ---- bag ---- */
.gu-tabs { display: flex; gap: 2px; padding: 3px; background: var(--paper-3); border-radius: 999px; box-shadow: inset 0 1px 2px rgb(59 66 85 / 0.15); }
.gu-tab { position: relative; min-height: calc(var(--target) - 8px); padding: 0 18px; background: none; border: 0; border-radius: 999px; color: var(--ink-2); font-weight: 700; }
/* The track's padding is part of the target, so a tab answers across the strip's full height. */
.gu-tab::after { content: ''; position: absolute; inset: -3px 0; }
.gu-tab:hover { color: var(--ink); }
.gu-tab[aria-selected='true'] { color: var(--paper-light); background: var(--navy); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.6), 0 1px 3px rgb(10 12 20 / 0.25); }
.gu-bag-things { display: grid; gap: var(--s2); }
.gu-bag-things > .gu-label:not(:first-child) { margin-top: var(--s4); }
.gu-bag:not(.gu-bag-things) { width: 640px; max-width: 100%; }
.gu-slots { display: grid; grid-template-columns: repeat(9, var(--slot)); gap: 8px; }
/* A slot is a night well with a gold rim, the way a bag of things looks in the hand. */
.gu-slot {
  position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0;
  background: radial-gradient(90% 90% at 30% 20%, #3a4258, var(--night-2)); border: 0; border-radius: var(--radius); touch-action: none;
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), inset 0 2px 6px rgb(0 0 0 / 0.3);
}
.gu-slot:hover { background: radial-gradient(90% 90% at 30% 20%, #4a5470, #323a50); }
.gu-slot:active { filter: brightness(0.95); }
.gu-slot-empty { cursor: default; background: rgb(59 66 85 / 0.12); box-shadow: inset 0 0 0 1px rgb(166 137 90 / 0.35); }
.gu-slot-empty:hover { background: rgb(59 66 85 / 0.16); }
.gu-quick { background: radial-gradient(90% 90% at 30% 20%, #4a4434, #34302a); }
.gu-quick.gu-slot-empty { background: rgb(166 137 90 / 0.16); }
.gu-quick:hover, .gu-quick.gu-slot-empty:hover { filter: brightness(1.1); }
.gu-picked, .gu-picked:hover { box-shadow: inset 0 0 0 2px var(--gold-bright), 0 0 0 2px rgb(240 212 138 / 0.35), 0 0 14px rgb(240 212 138 / 0.55); }
.gu-slot-key { position: absolute; z-index: 1; left: 7px; top: 4px; font-size: 11px; font-weight: 800; line-height: 1.3; color: var(--gold); text-shadow: 0 1px 2px rgb(0 0 0 / 0.6); }
.gu-slot-empty .gu-slot-key { color: var(--bronze); text-shadow: none; }
.gu-slot-count, .gu-ghost-count { position: absolute; z-index: 1; right: 4px; bottom: 4px; min-width: 20px; padding: 0 5px; font-size: 12px; font-weight: 800; line-height: 17px; text-align: center; color: var(--ink); background: var(--paper-light); border-radius: 5px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.35); }
/* A drag: the stack it came from fades, the slot under the pointer lights up, and a refused slot says no. */
.gu-slot.is-drag-from > .gu-pic, .gu-slot.is-drag-from > .gu-slot-count { opacity: 0.3; }
.gu-slot.is-split-from { box-shadow: inset 0 0 0 2px var(--line-strong); }
.gu-slot.is-drop { background: radial-gradient(90% 90% at 30% 20%, #6a5a34, #4a3f28); box-shadow: inset 0 0 0 2px var(--gold-bright), 0 0 14px rgb(240 212 138 / 0.6); }
.gu-slot.is-refused { box-shadow: inset 0 0 0 2px #d06a4a; cursor: not-allowed; }
.gu-ghost { position: absolute; left: 0; top: 0; z-index: 60; display: grid; place-items: center; width: 56px; height: 56px; pointer-events: none; background: var(--night-2); border-radius: var(--radius); box-shadow: 0 0 0 2px var(--gold-bright), 0 0 18px rgb(240 212 138 / 0.55), 0 12px 26px rgb(10 12 20 / 0.45); will-change: transform; }
:root.gu-dragging, :root.gu-dragging * { cursor: grabbing !important; }
.gu-bag-foot { margin-top: var(--s5); font-size: 14px; color: var(--ink-2); text-wrap: pretty; text-align: center; }
.gu-foot-coarse { display: none; }
@media (pointer: coarse) { .gu-foot-fine { display: none; } .gu-foot-coarse { display: inline; } }
.gu-bag-foot kbd { height: 22px; min-width: 22px; font-size: 12px; vertical-align: 1px; }
/* The tooltip: night glass with a gold hairline, so it reads over the paper and stands apart from it. It sits in the stage, so it can leave the panel. */
.gu-tip {
  position: absolute; left: 0; top: 0; z-index: 50; display: grid; gap: 4px; width: max-content; max-width: 280px; padding: 12px 16px 14px;
  color: var(--glass-ink); background: linear-gradient(180deg, #2c3346, var(--tip)); border-radius: var(--radius); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), var(--lift); pointer-events: none;
  font-size: calc(14px * var(--gu-size)); line-height: 1.45;
}
.gu-tip-name { font-family: var(--display); font-size: 1.15em; font-weight: 650; color: var(--gold-bright); }
.gu-tip-name .gu-quiet { color: var(--glass-ink-2); font-family: 'Nunito', sans-serif; font-size: 0.85em; }
.gu-tip-use { color: var(--paper-light); font-weight: 700; }
.gu-tip-text { color: var(--glass-ink-2); text-wrap: pretty; }
.gu-tip-note { color: var(--new-light); font-size: 0.93em; }

/* ---- recipes: each a card on the page ---- */
.gu-make { width: 600px; max-width: 100%; }
.gu-recipes { display: grid; gap: 10px; }
.gu-recipe { display: grid; grid-template-columns: 64px 1fr auto; gap: var(--s4); align-items: center; padding: 12px 16px 12px 12px; background: rgb(255 255 255 / 0.4); border-radius: var(--radius); box-shadow: inset 0 0 0 1px var(--line); }
.gu-recipe > .gu-pic { width: 64px !important; height: 64px !important; padding: 8px; background: radial-gradient(90% 90% at 30% 20%, #3a4258, var(--night-2)); border-radius: var(--radius); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55); }
.gu-recipe > .gu-pic > .gu-pic-cell { left: 8px; top: 8px; }
.gu-recipe-name { font-family: var(--display); font-size: 18px; font-weight: 650; }
.gu-needs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; color: var(--ink-2); }
.gu-need { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 4px; font-size: 14px; font-weight: 700; background: var(--paper-2); border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.gu-short { color: var(--new); }
.gu-short .gu-num { font-weight: 800; }
.gu-recipe-act { display: grid; justify-items: end; gap: var(--s1); }
.gu-recipe-act .gu-btn { min-width: 96px; }
.gu-why { max-width: 22ch; font-size: 13px; color: var(--ink-2); text-align: right; text-wrap: balance; }

/* ---- almanac: an open book, the index on the left page and the entry on the right ---- */
.gu-book { display: grid; grid-template-columns: 220px 22px 1fr; gap: 0 var(--s5); width: 880px; max-width: 100%; min-height: 440px; }
.gu-book-blank { display: grid; grid-template-columns: 1fr; place-items: center; }
.gu-book-blank .gu-empty { font-family: var(--display); font-size: 18px; text-align: center; }
.gu-index { display: grid; gap: var(--s5); align-content: start; }
.gu-index-group { display: grid; gap: 2px; }
.gu-index-group .gu-label { margin-bottom: var(--s1); padding-left: var(--s2); }
.gu-page-link { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); min-height: var(--target); padding: 0 var(--s3); background: none; border: 0; border-radius: var(--radius); text-align: left; font-weight: 600; }
.gu-page-link:hover { background: rgb(255 255 255 / 0.45); }
.gu-page-link[aria-current='page'] { color: var(--paper-light); background: var(--navy); font-weight: 700; box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.6); }
.gu-new { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--new); }
.gu-new::before { content: ''; width: 7px; height: 7px; background: currentColor; transform: rotate(45deg); }
.gu-page-link[aria-current='page'] .gu-new { color: var(--gold-bright); }
/* The gutter between the two pages: a soft fold. */
.gu-spine { background: linear-gradient(90deg, transparent, rgb(59 66 85 / 0.1) 40%, rgb(59 66 85 / 0.18) 50%, rgb(59 66 85 / 0.1) 60%, transparent); }
.gu-leaf { position: relative; }
.gu-leaf-head { display: flex; align-items: center; gap: var(--s5); padding-bottom: var(--s5); }
.gu-leaf-head .gu-pic { background: radial-gradient(90% 90% at 30% 20%, #f8f3e8, var(--paper-3)); border-radius: 50%; box-shadow: inset 0 0 0 2px var(--gold), 0 4px 12px rgb(10 12 20 / 0.15); }
.gu-leaf-title { font-family: var(--display); font-size: 34px; font-weight: 650; line-height: 1.1; letter-spacing: -0.01em; text-wrap: balance; }
.gu-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s6); padding-top: var(--s5); border-top: 1px solid var(--gold); }
.gu-column .gu-label { margin-bottom: var(--s3); }
.gu-facts { display: grid; gap: var(--s3); }
.gu-fact { min-height: 1.5em; max-width: 34ch; text-wrap: pretty; }
.gu-dashes { display: block; width: 78%; height: 0.95em; border-bottom: 2px dotted var(--paper-4); }
.gu-inked { display: inline-block; animation: gu-ink 900ms var(--ease) both; }
@keyframes gu-ink { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.gu-stamp { margin-left: auto; align-self: start; padding: 5px 14px; border: 2px solid var(--done); border-radius: 999px; color: var(--done); font-family: var(--display); font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transform: rotate(-5deg); box-shadow: inset 0 0 0 2px rgb(94 138 74 / 0.2); }
.gu-stamped { animation: gu-stamp 160ms var(--ease) both; }
@keyframes gu-stamp { from { transform: rotate(-5deg) scale(1.3); } }

/* ---- quests ---- */
.gu-quests { width: 560px; max-width: 100%; }
.gu-quest { padding: 16px 18px; background: rgb(255 255 255 / 0.4); border-radius: var(--radius); box-shadow: inset 0 0 0 1px var(--line); }
.gu-quest + .gu-quest { margin-top: var(--s3); }
.gu-quest-title { display: flex; align-items: baseline; gap: var(--s3); font-family: var(--display); font-size: 21px; font-weight: 650; }
.gu-quest-summary { margin-top: var(--s1); max-width: 56ch; color: var(--ink-2); text-wrap: pretty; }
.gu-steps { display: grid; gap: var(--s2); margin-top: var(--s3); }
.gu-step { display: grid; grid-template-columns: 16px 1fr auto; gap: var(--s3); align-items: baseline; }
.gu-step-mark { width: 10px; height: 10px; border: 1.5px solid var(--bronze); transform: translateY(1px) rotate(45deg); }
.gu-step-done .gu-step-mark { background: var(--done); border-color: var(--done); }
.gu-step-done .gu-step-text, .gu-quest-done .gu-quest-title { color: var(--ink-2); }
.gu-quest-done { background: transparent; }
.gu-quest-done .gu-quest-title { font-size: 17px; }
.gu-quest-done .gu-quest-state { color: var(--done); font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; }

/* ---- menus: pause, settings, the end ---- */
.gu-menu { display: grid; gap: 10px; width: 320px; max-width: 100%; }
.gu-menu .gu-btn { min-height: 50px; font-size: 16px; }
.gu-menu-note { font-size: 14px; color: var(--ink-2); text-align: center; }
.gu-panel-pause .gu-panel-head { justify-content: center; }
.gu-panel-pause .gu-panel-title { font-size: 30px; }
/* Settings: what is seen and heard on the left, the keys on the right. Each row is a band: its name, then its control. */
.gu-settings { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: var(--s7); width: 960px; max-width: 100%; }
.gu-settings > .gu-section { margin-top: 0; }
.gu-settings-side { display: grid; gap: var(--s6); align-content: start; }
.gu-settings-side > * + * { margin-top: 0 !important; }
.gu-settings-side .gu-section > .gu-label { margin-bottom: var(--s2); }
.gu-settings-side .gu-choices, .gu-settings-side .gu-slider, .gu-settings-side .gu-section > .gu-btn { margin: 0; }
.gu-settings-side .gu-choices, .gu-settings-side .gu-slider { padding: 6px 10px; border-radius: 10px; }
.gu-settings-side .gu-choices:nth-child(even), .gu-settings-side .gu-slider:nth-child(even) { background: rgb(255 255 255 / 0.38); }
/* The row's name floats left of its strip, so a fieldset's legend can sit beside it. */
.gu-settings-side .gu-choices { display: block; }
.gu-settings-side .gu-choices > legend { float: left; width: 34%; min-height: calc(var(--target) - 6px); display: flex; align-items: center; padding: 0 12px 0 0; font-family: inherit; font-size: 15px; font-weight: 600; color: var(--ink); }
.gu-settings-side .gu-choices > legend::before { content: none; }
.gu-settings-side .gu-choices > .gu-strip { margin-left: 34%; }
.gu-settings-view .gu-choices + .gu-choices { margin-top: 0; }
.gu-section > .gu-btn { margin-top: var(--s3) !important; }
.gu-strip { display: flex; gap: 2px; padding: 3px; background: var(--paper-3); border-radius: 999px; box-shadow: inset 0 1px 2px rgb(59 66 85 / 0.15); }
.gu-choice { position: relative; flex: 1; min-width: 0; }
.gu-choice input { position: absolute; inset: -3px 0; width: 100%; height: calc(100% + 6px); margin: 0; opacity: 0; cursor: pointer; }
.gu-choice span { display: grid; place-items: center; min-height: calc(var(--target) - 12px); padding: 0 6px; border-radius: 999px; color: var(--ink-2); font-size: 13.5px; font-weight: 700; white-space: nowrap; }
.gu-choice input:hover + span { color: var(--ink); background: rgb(255 255 255 / 0.4); }
.gu-choice input:checked + span { color: var(--paper-light); background: var(--navy); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.6), 0 1px 3px rgb(10 12 20 / 0.25); }
.gu-choice input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.gu-slider { display: grid; grid-template-columns: 34% 1fr 56px; gap: var(--s3); align-items: center; min-height: var(--target); }
.gu-slider label { font-size: 15px; font-weight: 600; line-height: 1.25; }
.gu-slider input { -webkit-appearance: none; appearance: none; width: 100%; min-width: 0; height: var(--target); margin: 0; background: transparent; cursor: pointer; }
.gu-slider input::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--bronze), var(--gold)); box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.25); }
.gu-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -7px; background: var(--paper-light); border-radius: 50%; box-shadow: 0 0 0 2px var(--bronze), 0 2px 5px rgb(10 12 20 / 0.35); }
.gu-slider input::-moz-range-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--bronze), var(--gold)); }
.gu-slider input::-moz-range-thumb { width: 18px; height: 18px; border: 2px solid var(--bronze); background: var(--paper-light); border-radius: 50%; }
.gu-slider output { text-align: right; font-size: 14px; font-weight: 700; color: var(--ink-2); }
.gu-keylist { display: grid; grid-template-columns: 1fr auto; gap: 0 var(--s5); align-items: center; }
.gu-keylist dt, .gu-keylist dd { min-height: 38px; display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
.gu-keylist dt { color: var(--ink); font-size: 14px; font-weight: 600; line-height: 1.3; }
.gu-keylist dd { justify-content: flex-end; }
.gu-panel-end { padding: var(--s7) var(--s7) var(--s6); }
.gu-end { display: grid; justify-items: center; gap: var(--s5); width: 460px; max-width: 100%; text-align: center; }
.gu-end-title { font-family: var(--display); font-size: 32px; font-weight: 650; line-height: 1.12; text-wrap: balance; }
.gu-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s5) var(--s6); width: 100%; padding: var(--s4) 0; border-block: 1px solid var(--gold); }
.gu-stat { display: flex; flex-direction: column-reverse; }
.gu-stat dd { font-family: var(--display); font-size: 42px; font-weight: 650; line-height: 1.1; color: var(--ink); }
.gu-stat dt { color: var(--ink-2); font-weight: 600; }
.gu-end-line { max-width: 40ch; color: var(--ink-2); text-wrap: balance; }
.gu-end .gu-btn { min-height: 50px; min-width: 220px; }

/* ---- title: no box. The name is set large over the picture, the menu a column of pills under it. ---- */
.gu-stage-title {
  place-items: center start; padding: var(--s7) 7cqw;
  background:
    linear-gradient(90deg, rgb(10 12 20 / 0.72), rgb(10 12 20 / 0.25) 45%, transparent 70%),
    radial-gradient(46cqw 30cqh at 66% 71%, rgb(255 226 160 / 0.9), rgb(255 190 120 / 0) 70%),
    linear-gradient(180deg, #2f2a52 0%, #6b4b7a 30%, #d39a6a 56%, #f1d49a 71%, #4c7a46 71%, #2a4a30 100%);
}
.gu-art-title .gu-stage-title { background: linear-gradient(90deg, rgb(10 12 20 / 0.74), rgb(10 12 20 / 0.3) 42%, transparent 68%), var(--gu-title-art) center / cover no-repeat, #2a4a30; image-rendering: pixelated; }
.gu-panel-plate { padding: 0; background: none; box-shadow: none; border-radius: 0; animation: gu-title-in 600ms var(--ease) both; }
@keyframes gu-title-in { from { transform: translateY(10px); opacity: 0.4; } }
.gu-plate { display: grid; gap: var(--s6); width: 360px; max-width: 100%; }
.gu-chapter { position: relative; padding-bottom: 22px; font-family: var(--display); font-size: 58px; font-weight: 650; line-height: 1; letter-spacing: -0.01em; color: var(--paper-light); text-wrap: balance; text-shadow: 0 2px 4px rgb(10 12 20 / 0.6), 0 0 30px rgb(10 12 20 / 0.5); }
.gu-chapter::after { content: ''; position: absolute; left: 0; bottom: 0; width: 70%; height: 2px; background: linear-gradient(90deg, var(--gold-bright), rgb(240 212 138 / 0)); }
.gu-plate .gu-menu { width: 100%; }
.gu-plate .gu-menu-note { text-align: left; color: var(--glass-ink-2); text-shadow: 0 1px 2px rgb(10 12 20 / 0.8); }
.gu-plate .gu-btn:not(.gu-primary):not(:disabled) { background: rgb(22 26 38 / 0.6); }
.gu-plate .gu-btn:disabled { color: rgb(246 241 231 / 0.45); background: rgb(22 26 38 / 0.35); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.25); }

/* ---- over the game: prompt, hints, toasts, the ring. Night glass with a gold hairline, so the world shows around them. ---- */
.gu-over { position: absolute; inset: 0; }
.gu-over kbd { color: var(--night); background: linear-gradient(180deg, var(--paper-light), var(--paper-3)); box-shadow: inset 0 0 0 1px var(--gold), 0 1px 0 rgb(10 12 20 / 0.4); }
.gu-card { display: flex; align-items: center; gap: var(--s3); padding: 6px 6px 6px var(--s4); color: var(--glass-ink); background: var(--glass); border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--glass-line), var(--glass-shadow); pointer-events: auto; zoom: var(--gu-size); }
.gu-card .gu-close { position: relative; width: 32px; height: 32px; margin: 0; font-size: 18px; color: var(--glass-ink-2); background: var(--glass-2); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.4); }
/* It looks 32px, and answers across 44px. */
.gu-card .gu-close::after { content: ''; position: absolute; inset: -6px; }
.gu-card .gu-close:hover { color: var(--glass-ink); background: rgb(255 255 255 / 0.16); }
.gu-top { position: absolute; left: 50%; top: var(--s4); display: grid; justify-items: center; gap: var(--s2); width: min(480px, 100% - 32px); transform: translateX(-50%); }
.gu-top.gu-held { visibility: hidden; }
.gu-hint { width: auto; max-width: 100%; padding-left: 18px; animation: gu-drop 160ms var(--ease); }
.gu-hint::before { content: ''; flex: none; width: 8px; height: 8px; background: var(--gold-bright); transform: rotate(45deg); box-shadow: 0 0 8px rgb(240 212 138 / 0.8); }
.gu-hint-text { flex: 1; max-width: 46ch; padding: var(--s1) 0; font-size: 15px; font-weight: 600; text-wrap: pretty; text-shadow: 0 1px 2px rgb(0 0 0 / 0.4); }
.gu-note { min-height: 44px; padding-right: var(--s2); font-weight: 700; font-size: 15px; animation: gu-drop 160ms var(--ease); }
.gu-note:hover { background: rgb(22 26 38 / 0.72); }
.gu-note::before { content: ''; flex: none; width: 8px; height: 8px; background: var(--new-light); transform: rotate(45deg); }
@keyframes gu-drop { from { transform: translateY(-6px); } }
.gu-prompt { position: absolute; left: 50%; display: flex; align-items: center; gap: 10px; padding: 5px 18px 5px 5px; color: var(--glass-ink); background: var(--glass); border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--glass-line), var(--glass-shadow); font-size: 15px; font-weight: 700; white-space: nowrap; transform: translateX(-50%); zoom: var(--gu-size); text-shadow: 0 1px 2px rgb(0 0 0 / 0.4); }
.gu-prompt kbd { min-width: 30px; height: 30px; font-size: 14px; border-radius: 50%; text-shadow: none; }
.gu-toasts { position: absolute; left: var(--s4); bottom: var(--s4); display: grid; justify-items: start; gap: 6px; max-width: calc(100% - 32px); zoom: var(--gu-size); }
.gu-toast { display: flex; align-items: center; gap: var(--s2); min-height: 38px; padding: 4px var(--s4) 4px 6px; color: var(--glass-ink); background: linear-gradient(90deg, rgb(22 26 38 / 0.78), rgb(22 26 38 / 0.35)); border: 0; border-left: 2px solid var(--gold); border-radius: 0 999px 999px 0; box-shadow: var(--glass-shadow); font-size: 15px; font-weight: 600; animation: gu-rise 160ms var(--ease); text-shadow: 0 1px 2px rgb(0 0 0 / 0.5); }
.gu-toast > .gu-pic { width: 28px !important; height: 28px !important; }
.gu-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gu-toast-count { color: var(--gold-bright); font-weight: 800; }
.gu-toast-count:empty { display: none; }
@keyframes gu-rise { from { transform: translateX(-8px); } }
.gu-ring { position: absolute; left: 0; top: 0; width: 32px; height: 32px; }
.gu-ring svg { display: block; width: 32px; height: 32px; transform: rotate(-90deg); }
.gu-ring circle { fill: none; }
.gu-ring-edge { stroke: rgb(22 26 38 / 0.6); stroke-width: 6; }
.gu-ring-track { stroke: rgb(246 241 231 / 0.3); stroke-width: 3; }
.gu-ring-arc { stroke: var(--gold-bright); stroke-width: 3; stroke-linecap: round; }

/* ---- a root too narrow for the wide panels ---- */
@container gu (width < 1080px) {
  .gu-settings { grid-template-columns: 1fr; gap: var(--s6); width: 560px; }
}

/* ---- a narrow root: bigger targets, one column, six slots across ---- */
@container gu (width < 640px) {
  .gu-root > * { --target: 44px; }
  .gu-stage { padding: var(--s2); }
  .gu-panel, .gu-card, .gu-prompt, .gu-toasts { zoom: 1; }
  .gu-panel { width: 100%; padding: 22px 18px 22px; border-radius: 14px; }
  .gu-panel-plate { width: auto; }
  .gu-panel-head { gap: var(--s3); }
  .gu-panel-title { font-size: 22px; }
  .gu-slots { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
  .gu-slot .gu-pic { width: 36px !important; height: 36px !important; }
  .gu-slot .gu-pic-cell { transform: scale(1.125) !important; }
  .gu-tip { max-width: min(260px, 100% - 16px); }
  .gu-bag:not(.gu-bag-things), .gu-make, .gu-quests, .gu-settings, .gu-book, .gu-end { width: 100%; }
  .gu-recipe { grid-template-columns: 56px 1fr; align-items: start; }
  .gu-recipe > .gu-pic { width: 56px !important; height: 56px !important; padding: 4px; }
  .gu-recipe > .gu-pic > .gu-pic-cell { left: 4px; top: 4px; }
  .gu-recipe-act { grid-column: 2; justify-items: start; }
  .gu-why { max-width: none; text-align: left; }
  .gu-book { grid-template-columns: 1fr; min-height: 0; gap: var(--s4); }
  .gu-index { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); padding: 0; }
  .gu-index-group { display: flex; align-items: center; gap: var(--s1); flex: none; }
  .gu-index-group .gu-label { margin: 0; padding: 0 var(--s1) 0 0; }
  .gu-page-link { background: var(--paper-2); white-space: nowrap; }
  .gu-spine { display: none; }
  .gu-leaf-head { gap: var(--s4); }
  .gu-leaf-head .gu-pic { zoom: 0.667; }
  .gu-leaf-title { font-size: 26px; }
  .gu-columns { grid-template-columns: 1fr; gap: var(--s5); }
  .gu-settings-side .gu-choices > legend { float: none; width: auto; min-height: 0; padding: 0 0 6px; }
  .gu-settings-side .gu-choices > .gu-strip { margin-left: 0; }
  .gu-slider { grid-template-columns: 96px 1fr 44px; gap: var(--s3); }
  .gu-choice { flex: 1 1 auto; }
  .gu-panel-end { padding: var(--s6) var(--s5) var(--s5); }
  .gu-stat dd { font-size: 32px; }
  .gu-stage-title { place-items: end center; padding: var(--s5) var(--s4); background-position: center; }
  .gu-art-title .gu-stage-title { background: linear-gradient(0deg, rgb(10 12 20 / 0.8), rgb(10 12 20 / 0.2) 55%, transparent 75%), var(--gu-title-art) center / cover no-repeat, #2a4a30; }
  .gu-plate { width: 100%; gap: var(--s5); }
  .gu-chapter { font-size: 40px; }
  .gu-menu { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .gu-panel, .gu-panel-plate, .gu-hint, .gu-note, .gu-toast, .gu-stamped { animation: none; }
  .gu-inked { animation: gu-fade 300ms linear both; }
  .gu-btn, .gu-close { transition: none; }
}
@keyframes gu-fade { from { opacity: 0.3; } }
`;
