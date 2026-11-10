// The look: warm paper panels with 10px corners and one soft shadow, dark glass over the world, one sans face from
// the system and one teal accent. The direction is the handbook's (design/.critly/direction.md).
// Every size answers to the root's own width (a container query), not the window's.

export const STYLES = /* css */ `
.gu-root {
  /* Warm paper for panels, and dark glass for what sits over the world. The same values as .ui-book in src/game/uiview/theme.ts. */
  --paper: oklch(0.975 0.014 88);
  --paper-2: oklch(0.945 0.02 86);
  --paper-3: oklch(0.91 0.026 84);
  --paper-4: oklch(0.88 0.03 82);
  --paper-light: oklch(0.99 0.008 90);
  --plate: var(--paper-light);
  --ink: oklch(0.29 0.022 62);
  --ink-2: oklch(0.47 0.022 68);
  --ink-3: oklch(0.6 0.018 70);
  --line: oklch(0.29 0.022 62 / 0.12);
  --line-strong: oklch(0.29 0.022 62 / 0.28);
  --brass: oklch(0.8 0.13 78);
  --brass-dark: oklch(0.62 0.13 68);
  /* the one accent, teal from the lume crystal: the next action, the thing picked, the slot a stack will land in */
  --accent: oklch(0.53 0.095 192);
  --accent-press: oklch(0.47 0.09 192);
  --accent-soft: oklch(0.53 0.095 192 / 0.16);
  --accent-ink: oklch(0.99 0.01 192);
  --accent-light: oklch(0.84 0.08 188);
  /* a finished thing, and a new one */
  --done: oklch(0.52 0.12 150);
  --new: oklch(0.6 0.15 62);
  --new-light: oklch(0.85 0.12 78);
  --scrim: oklch(0.18 0.02 60 / 0.45);
  --shadow: oklch(0.18 0.03 60 / 0.28);
  --lift: 0 1px 2px oklch(0.18 0.03 60 / 0.14), 0 12px 32px oklch(0.18 0.03 60 / 0.24);
  --glass: oklch(0.21 0.018 62 / 0.62);
  --glass-2: oklch(1 0 0 / 0.1);
  --glass-ink: oklch(0.985 0.008 88);
  --glass-ink-2: oklch(0.87 0.014 86);
  --glass-shadow: 0 2px 10px oklch(0.12 0.02 60 / 0.22);
  --tip: oklch(0.26 0.02 62);
  --radius: 10px;
  --radius-sm: 6px;
  /* spacing: 4 8 12 16 24 32 48 */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  --target: 40px;
  --slot: 64px;
  --gu-size: 1;

  position: absolute; inset: 0; z-index: 20; overflow: hidden;
  container: gu / size;
  pointer-events: none; user-select: none; -webkit-user-select: none;
  color: var(--ink); color-scheme: light;
  font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: lining-nums;
}
.gu-root *, .gu-root *::before, .gu-root *::after { box-sizing: border-box; }
.gu-root [hidden] { display: none !important; }
/* :where keeps the reset weightless, so any class below can set a margin. */
.gu-root :where(h1, h2, h3, p, ul, dl, dd, fieldset, legend) { margin: 0; padding: 0; border: 0; }
.gu-root :where(ul) { list-style: none; }
.gu-root :where(h1, h2, h3) { font-size: inherit; font-weight: 600; }
.gu-root button, .gu-root input { font: inherit; color: inherit; }
.gu-root button { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.gu-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.gu-num { font-variant-numeric: tabular-nums lining-nums; }
.gu-quiet { color: var(--ink-2); font-weight: 400; }
.gu-label { font-size: 12px; font-weight: 600; line-height: 1.3; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-2); }
.gu-empty { color: var(--ink-2); max-width: 44ch; text-wrap: pretty; }

/* ---- pictures and keys ---- */
.gu-pic { position: relative; display: block; flex: none; overflow: hidden; }
.gu-pic-cell { position: absolute; left: 0; top: 0; transform-origin: 0 0; background-repeat: no-repeat; image-rendering: pixelated; }
.gu-pic-small .gu-pic-cell { image-rendering: auto; }
.gu-pic-plain { display: grid; place-items: center; background: var(--paper-3); color: var(--ink-2); font-weight: 600; line-height: 1; border-radius: var(--radius-sm); }
.gu-keys { display: inline-flex; align-items: center; gap: var(--s1); flex: none; }
.gu-keys-join { color: var(--ink-2); font-size: 13px; }
.gu-root kbd {
  display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 6px;
  font: inherit; font-size: 13px; font-weight: 600; line-height: 1; white-space: nowrap; color: var(--ink);
  background: var(--paper-light); border: 0; border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line-strong), inset 0 -2px 0 var(--line);
}

/* ---- buttons ---- */
.gu-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  min-height: var(--target); padding: 0 18px;
  color: var(--ink); background-color: var(--paper-2); border: 0; border-radius: var(--radius);
  font-weight: 600; white-space: nowrap;
  transition: transform 80ms var(--ease);
}
.gu-btn:hover { background-color: var(--paper-3); }
.gu-btn:active { background-color: var(--paper-4); transform: scale(0.98); }
.gu-btn.gu-primary { background-color: var(--accent); color: var(--accent-ink); }
.gu-btn.gu-primary:hover, .gu-btn.gu-primary:active { background-color: var(--accent-press); }
.gu-btn:disabled, .gu-btn[aria-disabled='true'] { background-color: transparent; box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--ink-3); cursor: default; transform: none; }
.gu-close {
  display: grid; place-items: center; flex: none; width: var(--target); height: var(--target); margin: -6px -8px -6px auto;
  background: none; border: 0; border-radius: var(--radius); font-size: 24px; font-weight: 400; line-height: 1; color: var(--ink-2);
}
.gu-close:hover { background: var(--paper-2); color: var(--ink); }
.gu-close:active { background: var(--paper-3); }

/* ---- the stage and the panel ---- */
.gu-stage { position: absolute; inset: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; padding: var(--s4); background: var(--scrim); pointer-events: auto; }
.gu-panel {
  position: relative; display: flex; flex-direction: column; min-width: 0; max-width: 100%; max-height: 100%;
  padding: 24px 28px 28px;
  background-color: var(--paper); border: 0; border-radius: 14px;
  box-shadow: var(--lift);
  zoom: var(--gu-size);
  animation: gu-in 140ms var(--ease);
}
.gu-panel:focus-visible { outline: none; }
/* It grows a little from the middle but never fades, so a panel is readable from its first frame. */
@keyframes gu-in { from { transform: scale(0.98); } }
.gu-corner { display: none; }
.gu-panel-head { display: flex; align-items: center; gap: var(--s5); min-height: var(--target); margin-bottom: var(--s4); }
.gu-panel-title { font-size: 20px; font-weight: 650; letter-spacing: -0.015em; }
/* The body scrolls. The padding keeps a focus ring at its edge from being cut off. */
.gu-panel-body { min-height: 0; margin: -4px; padding: 4px; overflow: auto; overscroll-behavior: contain; }
.gu-section + .gu-section, .gu-choices + .gu-section, .gu-section + .gu-choices { margin-top: var(--s6); }
.gu-section > .gu-label, .gu-choices > .gu-label { display: block; margin-bottom: var(--s3); }

/* ---- bag ---- */
.gu-tabs { display: flex; gap: var(--s1); padding: 3px; background: var(--paper-2); border-radius: var(--radius); }
.gu-tab { min-height: 34px; padding: 0 14px; background: none; border: 0; border-radius: 7px; color: var(--ink-2); font-weight: 500; }
.gu-tab:hover { color: var(--ink); }
.gu-tab[aria-selected='true'] { color: var(--ink); font-weight: 600; background: var(--paper-light); box-shadow: 0 1px 2px var(--line-strong); }
.gu-bag-things { display: grid; gap: var(--s2); }
.gu-bag-things > .gu-label:not(:first-child) { margin-top: var(--s4); }
.gu-bag:not(.gu-bag-things) { width: 560px; max-width: 100%; }
.gu-slots { display: grid; grid-template-columns: repeat(9, var(--slot)); gap: 6px; }
.gu-slot {
  position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0;
  background: var(--paper-2); border: 0; border-radius: var(--radius); touch-action: none;
}
.gu-slot:hover { background: var(--paper-3); }
.gu-slot:active { background: var(--paper-4); }
.gu-slot-empty { cursor: default; }
.gu-slot-empty:hover { background: var(--paper-2); }
.gu-quick { background: var(--paper-3); }
.gu-quick:hover, .gu-quick.gu-slot-empty:hover { background: var(--paper-4); }
.gu-picked, .gu-picked:hover { background: var(--paper-light); box-shadow: inset 0 0 0 2px var(--accent); }
.gu-slot-key { position: absolute; z-index: 1; left: 6px; top: 3px; font-size: 12px; font-weight: 600; line-height: 1.3; color: var(--ink-2); }
.gu-slot-count, .gu-ghost-count { position: absolute; z-index: 1; right: 3px; bottom: 3px; min-width: 20px; padding: 0 5px; font-size: 13px; font-weight: 700; line-height: 18px; text-align: center; color: var(--ink); background: var(--paper-light); border-radius: var(--radius-sm); }
/* A drag: the stack it came from fades, the slot under the pointer lights up, and a refused slot says no. */
.gu-slot.is-drag-from > .gu-pic, .gu-slot.is-drag-from > .gu-slot-count { opacity: 0.3; }
.gu-slot.is-split-from { box-shadow: inset 0 0 0 2px var(--line-strong); }
.gu-slot.is-drop { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.gu-slot.is-refused { box-shadow: inset 0 0 0 2px var(--new); cursor: not-allowed; }
.gu-ghost { position: absolute; left: 0; top: 0; z-index: 60; display: grid; place-items: center; width: 56px; height: 56px; pointer-events: none; background: var(--paper-light); border-radius: var(--radius); box-shadow: 0 0 0 2px var(--accent), 0 10px 24px oklch(0.18 0.03 60 / 0.35); will-change: transform; }
:root.gu-dragging, :root.gu-dragging * { cursor: grabbing !important; }
.gu-bag-foot { margin-top: var(--s4); font-size: 14px; color: var(--ink-2); text-wrap: pretty; }
.gu-bag-foot kbd { height: 20px; min-width: 20px; font-size: 12px; vertical-align: 1px; }
/* The tooltip: dark, so it reads over the paper and stands apart from it. It sits in the stage, so it can leave the panel. */
.gu-tip {
  position: absolute; left: 0; top: 0; z-index: 50; display: grid; gap: 4px; width: max-content; max-width: 260px; padding: 10px 14px 12px;
  color: var(--glass-ink); background: var(--tip); border-radius: var(--radius); box-shadow: var(--lift); pointer-events: none;
  font-size: calc(14px * var(--gu-size)); line-height: 1.4;
}
.gu-tip-name { font-size: 1.07em; font-weight: 650; }
.gu-tip-name .gu-quiet { color: var(--glass-ink-2); }
.gu-tip-use { color: var(--accent-light); font-weight: 500; }
.gu-tip-text { color: var(--glass-ink-2); text-wrap: pretty; }
.gu-tip-note { color: var(--new-light); font-size: 0.93em; }

/* ---- recipes ---- */
.gu-make { width: 580px; max-width: 100%; }
.gu-recipes { display: grid; }
.gu-recipe { display: grid; grid-template-columns: 56px 1fr auto; gap: var(--s4); align-items: center; padding: var(--s3) 0; }
.gu-recipe + .gu-recipe { border-top: 1px solid var(--line); }
.gu-recipe > .gu-pic { width: 56px !important; height: 56px !important; padding: 4px; background: var(--paper-2); border-radius: var(--radius); }
.gu-recipe > .gu-pic > .gu-pic-cell { left: 4px; top: 4px; }
.gu-recipe-name { font-weight: 600; }
.gu-needs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; color: var(--ink-2); }
.gu-need { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 4px; font-size: 14px; background: var(--paper-2); border-radius: 999px; }
.gu-short { color: var(--new); }
.gu-short .gu-num { font-weight: 700; }
.gu-recipe-act { display: grid; justify-items: end; gap: var(--s1); }
.gu-recipe-act .gu-btn { min-width: 88px; }
.gu-why { max-width: 22ch; font-size: 13px; color: var(--ink-2); text-align: right; text-wrap: balance; }

/* ---- almanac ---- */
.gu-book { display: grid; grid-template-columns: 216px 1px 1fr; gap: 0 var(--s5); width: 840px; max-width: 100%; min-height: 420px; }
.gu-book-blank { display: grid; grid-template-columns: 1fr; place-items: center; }
.gu-index { display: grid; gap: var(--s5); align-content: start; }
.gu-index-group { display: grid; gap: 2px; }
.gu-index-group .gu-label { margin-bottom: var(--s1); padding-left: var(--s3); }
.gu-page-link { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); min-height: var(--target); padding: 0 var(--s3); background: none; border: 0; border-radius: var(--radius); text-align: left; }
.gu-page-link:hover { background: var(--paper-2); }
.gu-page-link[aria-current='page'] { background: var(--paper-2); font-weight: 600; box-shadow: inset 3px 0 0 var(--accent); }
.gu-new { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--new); }
.gu-new::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.gu-spine { background: var(--line); }
.gu-leaf { position: relative; }
.gu-leaf-head { display: flex; align-items: center; gap: var(--s5); padding-bottom: var(--s5); }
.gu-leaf-head .gu-pic { background-color: var(--paper-2); border-radius: 14px; }
.gu-leaf-title { font-size: 30px; font-weight: 700; line-height: 1.15; letter-spacing: -0.025em; text-wrap: balance; }
.gu-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s6); padding-top: var(--s5); border-top: 1px solid var(--line); }
.gu-column .gu-label { margin-bottom: var(--s3); }
.gu-facts { display: grid; gap: var(--s3); }
.gu-fact { min-height: 1.5em; max-width: 34ch; text-wrap: pretty; }
.gu-dashes { display: block; width: 78%; height: 0.95em; border-bottom: 2px dashed var(--line-strong); }
.gu-inked { display: inline-block; animation: gu-ink 900ms var(--ease) both; }
@keyframes gu-ink { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.gu-stamp { margin-left: auto; align-self: start; padding: 4px 12px; border: 1.5px solid var(--done); border-radius: 999px; color: var(--done); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transform: rotate(-4deg); }
.gu-stamped { animation: gu-stamp 160ms var(--ease) both; }
@keyframes gu-stamp { from { transform: rotate(-4deg) scale(1.3); } }

/* ---- quests ---- */
.gu-quests { width: 540px; max-width: 100%; }
.gu-quest + .gu-quest { margin-top: var(--s6); }
.gu-quest-title { display: flex; align-items: baseline; gap: var(--s3); font-size: 20px; font-weight: 650; letter-spacing: -0.015em; }
.gu-quest-summary { margin-top: var(--s1); max-width: 56ch; color: var(--ink-2); text-wrap: pretty; }
.gu-steps { display: grid; gap: var(--s2); margin-top: var(--s3); }
.gu-step { display: grid; grid-template-columns: 16px 1fr auto; gap: var(--s3); align-items: baseline; }
.gu-step-mark { width: 12px; height: 12px; border: 1.5px solid var(--ink-2); border-radius: 50%; transform: translateY(1px); }
.gu-step-done .gu-step-mark { background: var(--done); border-color: var(--done); }
.gu-step-done .gu-step-text, .gu-quest-done .gu-quest-title { color: var(--ink-2); }
.gu-quest-done .gu-quest-title { font-size: 16px; }
.gu-quest-done .gu-quest-state { color: var(--done); }

/* ---- menus: pause, settings, the end ---- */
.gu-menu { display: grid; gap: var(--s2); width: 300px; max-width: 100%; }
.gu-menu .gu-btn { min-height: 48px; }
.gu-menu-note { font-size: 14px; color: var(--ink-2); }
/* Settings: what is seen and heard on the left, the keys on the right. The Picture section is first and has room to grow. */
.gu-settings { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s7); width: 880px; max-width: 100%; }
.gu-settings > .gu-section { margin-top: 0; }
.gu-settings-side { display: grid; gap: var(--s6); align-content: start; }
.gu-settings-side > * + * { margin-top: 0 !important; }
/* A legend inside a section that has its own heading is read, not shown. */
.gu-settings-side .gu-section .gu-choices > legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.gu-strip { display: flex; gap: 2px; padding: 3px; background: var(--paper-2); border-radius: var(--radius); }
.gu-choice { position: relative; flex: 1; min-width: 0; }
.gu-choice input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.gu-choice span { display: grid; place-items: center; min-height: 34px; padding: 0 var(--s2); border-radius: 7px; color: var(--ink-2); font-weight: 500; white-space: nowrap; }
.gu-choice input:hover + span { color: var(--ink); background: var(--paper-3); }
.gu-choice input:checked + span { color: var(--ink); font-weight: 600; background: var(--paper-light); box-shadow: 0 1px 2px var(--line-strong); }
.gu-choice input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.gu-slider { display: grid; grid-template-columns: 96px 1fr 48px; gap: var(--s4); align-items: center; min-height: var(--target); }
.gu-slider input { width: 100%; min-width: 0; height: var(--target); margin: 0; accent-color: var(--accent); cursor: pointer; }
.gu-slider output { text-align: right; color: var(--ink-2); }
.gu-keylist { display: grid; grid-template-columns: 1fr auto; gap: 10px var(--s5); align-items: center; }
.gu-keylist dt { color: var(--ink-2); }
.gu-keylist dd { justify-self: end; }
.gu-panel-end { padding: var(--s7) var(--s7) var(--s6); }
.gu-end { display: grid; justify-items: center; gap: var(--s5); width: 440px; max-width: 100%; text-align: center; }
.gu-end-title { font-size: 28px; font-weight: 700; line-height: 1.15; letter-spacing: -0.025em; text-wrap: balance; }
.gu-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s5) var(--s6); width: 100%; padding: var(--s2) 0; }
.gu-stat { display: flex; flex-direction: column-reverse; }
.gu-stat dd { font-size: 40px; font-weight: 700; line-height: 1.1; letter-spacing: -0.03em; }
.gu-stat dt { color: var(--ink-2); }
.gu-end-line { max-width: 40ch; color: var(--ink-2); text-wrap: balance; }
.gu-end .gu-btn { min-height: 48px; min-width: 200px; }

/* ---- title ---- */
.gu-stage-title {
  place-items: center start; padding: var(--s7) 8cqw;
  /* A plain dawn: the ground on top, the sun's glow behind the horizon, the sky under both. */
  background:
    linear-gradient(180deg, oklch(0.46 0.08 150 / 0) 71%, oklch(0.46 0.08 150) 71%, oklch(0.3 0.06 155) 100%),
    radial-gradient(46cqw 30cqh at 66% 71%, oklch(0.95 0.09 90 / 0.95), oklch(0.85 0.13 60 / 0) 70%),
    linear-gradient(180deg, oklch(0.34 0.07 285) 0%, oklch(0.5 0.1 330) 30%, oklch(0.74 0.12 45) 56%, oklch(0.88 0.1 82) 71%);
}
.gu-art-title .gu-stage-title { background: var(--gu-title-art) center / cover no-repeat, oklch(0.3 0.06 155); image-rendering: pixelated; }
.gu-panel-plate { padding: var(--s6); }
.gu-plate { display: grid; gap: var(--s6); width: 320px; max-width: 100%; }
.gu-chapter { font-size: 40px; font-weight: 700; line-height: 1.05; letter-spacing: -0.035em; text-wrap: balance; }
.gu-plate .gu-menu { width: 100%; }

/* ---- over the game: prompt, hints, toasts, the ring. Dark glass, so the world shows around them. ---- */
.gu-over { position: absolute; inset: 0; }
.gu-over kbd { box-shadow: 0 1px 0 oklch(0.12 0.02 60 / 0.4); }
.gu-card { display: flex; align-items: center; gap: var(--s3); padding: 6px 6px 6px var(--s4); color: var(--glass-ink); background: var(--glass); border: 0; border-radius: var(--radius); box-shadow: var(--glass-shadow); pointer-events: auto; zoom: var(--gu-size); }
.gu-card .gu-close { width: 36px; height: 36px; margin: 0; font-size: 22px; color: var(--glass-ink-2); }
.gu-card .gu-close:hover { color: var(--glass-ink); background: var(--glass-2); }
.gu-card .gu-close:active { background: oklch(1 0 0 / 0.16); }
.gu-top { position: absolute; left: 50%; top: var(--s4); display: grid; justify-items: center; gap: var(--s2); width: min(460px, 100% - 32px); transform: translateX(-50%); }
.gu-top.gu-held { visibility: hidden; }
.gu-hint { width: auto; max-width: 100%; animation: gu-drop 140ms var(--ease); }
.gu-hint-text { flex: 1; max-width: 46ch; padding: var(--s1) 0; font-size: 15px; font-weight: 500; text-wrap: pretty; }
.gu-note { min-height: 44px; padding-right: var(--s2); font-weight: 600; font-size: 15px; animation: gu-drop 140ms var(--ease); }
.gu-note:hover { background: oklch(0.21 0.018 62 / 0.74); }
.gu-note::before { content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--new-light); }
@keyframes gu-drop { from { transform: translateY(-6px); } }
.gu-prompt { position: absolute; left: 50%; display: flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; color: var(--glass-ink); background: var(--glass); border: 0; border-radius: var(--radius); box-shadow: var(--glass-shadow); font-size: 15px; font-weight: 600; white-space: nowrap; transform: translateX(-50%); zoom: var(--gu-size); }
.gu-prompt kbd { min-width: 28px; height: 28px; font-size: 14px; }
.gu-toasts { position: absolute; left: var(--s4); bottom: var(--s4); display: grid; justify-items: start; gap: 6px; max-width: calc(100% - 32px); zoom: var(--gu-size); }
.gu-toast { display: flex; align-items: center; gap: var(--s2); min-height: 36px; padding: 4px var(--s3) 4px 6px; color: var(--glass-ink); background: var(--glass); border: 0; border-radius: var(--radius); box-shadow: var(--glass-shadow); font-size: 15px; font-weight: 500; animation: gu-rise 160ms var(--ease); }
.gu-toast > .gu-pic { width: 28px !important; height: 28px !important; }
.gu-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gu-toast-count { color: var(--accent-light); font-weight: 700; }
.gu-toast-count:empty { display: none; }
@keyframes gu-rise { from { transform: translateY(8px); } }
.gu-ring { position: absolute; left: 0; top: 0; width: 32px; height: 32px; }
.gu-ring svg { display: block; width: 32px; height: 32px; transform: rotate(-90deg); }
.gu-ring circle { fill: none; }
.gu-ring-edge { stroke: oklch(0.2 0.03 60 / 0.55); stroke-width: 6; }
.gu-ring-track { stroke: oklch(0.975 0.014 88 / 0.35); stroke-width: 3; }
.gu-ring-arc { stroke: var(--paper-light); stroke-width: 3; stroke-linecap: round; }

/* ---- a root too narrow for the wide panels ---- */
@container gu (width < 1040px) {
  .gu-settings { grid-template-columns: 1fr; gap: var(--s6); width: 520px; }
}

/* ---- a narrow root: bigger targets, one column, six slots across ---- */
@container gu (width < 640px) {
  .gu-root > * { --target: 44px; }
  .gu-stage { padding: var(--s2); }
  .gu-panel, .gu-card, .gu-prompt, .gu-toasts { zoom: 1; }
  .gu-panel { width: 100%; padding: 20px 16px 20px; border-radius: 12px; }
  .gu-panel-head { gap: var(--s3); }
  .gu-panel-title { font-size: 18px; }
  .gu-slots { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
  .gu-slot .gu-pic { width: 36px !important; height: 36px !important; }
  .gu-slot .gu-pic-cell { transform: scale(1.125) !important; }
  .gu-tip { max-width: min(260px, 100% - 16px); }
  .gu-bag:not(.gu-bag-things), .gu-make, .gu-quests, .gu-settings, .gu-book, .gu-end { width: 100%; }
  .gu-recipe { grid-template-columns: 56px 1fr; align-items: start; }
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
  .gu-leaf-title { font-size: 24px; }
  .gu-columns { grid-template-columns: 1fr; gap: var(--s5); }
  .gu-slider { grid-template-columns: 80px 1fr 44px; gap: var(--s3); }
  .gu-choice { flex: 1 1 auto; }
  .gu-choice span { min-height: 38px; }
  .gu-panel-end { padding: var(--s6) var(--s5) var(--s5); }
  .gu-stat dd { font-size: 32px; }
  .gu-stage-title { place-items: end center; padding: var(--s4); }
  .gu-panel-plate { padding: var(--s5); }
  .gu-plate { width: 100%; gap: var(--s5); }
  .gu-chapter { font-size: 32px; }
  .gu-menu { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .gu-panel, .gu-hint, .gu-note, .gu-toast, .gu-stamped { animation: none; }
  .gu-inked { animation: gu-fade 300ms linear both; }
  .gu-btn { transition: none; }
}
@keyframes gu-fade { from { opacity: 0.3; } }
`;
