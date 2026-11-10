// The look: a book. Parchment panels, ink lines, small brass corners, one serif from the system.
// Every size answers to the root's own width (a container query), not the window's.

export const STYLES = /* css */ `
.gu-root {
  /* paper and ink */
  /* The paper, the rule and the brass are the colors of ui/panel.png and ui/button.png, so the fallback matches the art. */
  --paper: oklch(0.886 0.076 76);
  --paper-2: oklch(0.845 0.072 78);
  --paper-3: oklch(0.795 0.078 76);
  --paper-light: oklch(0.909 0.089 85);
  --plate: oklch(0.921 0.032 87);
  --ink: oklch(0.27 0.025 40);
  --ink-2: oklch(0.38 0.04 55);
  --ink-3: oklch(0.43 0.04 58);
  --line: oklch(0.27 0.025 40 / 0.28);
  --line-strong: oklch(0.402 0.055 61);
  --brass: oklch(0.76 0.112 82);
  --brass-dark: oklch(0.6 0.105 76);
  /* the one accent: the next action and the thing picked */
  --accent: oklch(0.46 0.15 32);
  --accent-press: oklch(0.4 0.14 32);
  --accent-ink: oklch(0.97 0.02 85);
  /* a finished thing */
  --done: oklch(0.42 0.075 165);
  --scrim: oklch(0.2 0.03 60 / 0.5);
  --shadow: oklch(0.15 0.03 60 / 0.4);
  /* spacing: 4 8 12 16 24 32 48 */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  --target: 40px;
  --gu-size: 1;

  position: absolute; inset: 0; z-index: 20; overflow: hidden;
  container: gu / size;
  pointer-events: none; user-select: none; -webkit-user-select: none;
  color: var(--ink); color-scheme: light;
  font: 16px/1.45 ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
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
.gu-root button { cursor: pointer; touch-action: manipulation; }
.gu-root :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.gu-num { font-variant-numeric: tabular-nums lining-nums; }
.gu-quiet { color: var(--ink-2); font-weight: 400; }
.gu-label { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-2); }
.gu-empty { color: var(--ink-2); max-width: 44ch; text-wrap: pretty; }

/* ---- pictures and keys ---- */
.gu-pic { position: relative; display: block; flex: none; overflow: hidden; }
.gu-pic-cell { position: absolute; left: 0; top: 0; transform-origin: 0 0; background-repeat: no-repeat; image-rendering: pixelated; }
.gu-pic-small .gu-pic-cell { image-rendering: auto; }
.gu-pic-plain { display: grid; place-items: center; background: var(--paper-3); color: var(--ink-2); font-weight: 600; line-height: 1; border-radius: 2px; }
.gu-keys { display: inline-flex; align-items: center; gap: var(--s1); flex: none; }
.gu-keys-join { color: var(--ink-2); font-size: 14px; }
.gu-root kbd {
  display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px;
  font: inherit; font-size: 14px; font-weight: 600; line-height: 1; white-space: nowrap;
  background: var(--plate); border: 1px solid var(--line-strong); border-bottom-width: 2px; border-radius: 3px;
}

/* ---- buttons ---- */
.gu-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  min-height: var(--target); padding: 0 18px;
  background-color: var(--plate); border: 2px solid var(--ink); border-radius: 2px;
  font-weight: 600; white-space: nowrap;
  transition: transform 80ms var(--ease);
}
.gu-btn:hover { background-color: var(--paper-light); }
.gu-btn:active { background-color: var(--paper-2); transform: translateY(1px); }
.gu-btn.gu-primary { background-color: var(--accent); color: var(--accent-ink); }
.gu-btn.gu-primary:hover, .gu-btn.gu-primary:active { background-color: var(--accent-press); }
.gu-btn:disabled, .gu-btn[aria-disabled='true'] { background-color: transparent; border-color: var(--line); color: var(--ink-3); cursor: default; transform: none; }
/* The button picture is the frame. The fill stays a color, so hover, press and the accent still show. */
.gu-art-button .gu-btn { border-color: transparent; border-radius: 0; border-image: var(--gu-button-art) var(--gu-button-slice) / var(--gu-button-width) stretch; background-clip: padding-box; image-rendering: pixelated; }
.gu-art-button .gu-btn:disabled, .gu-art-button .gu-btn[aria-disabled='true'] { background-color: var(--plate); opacity: 0.55; }
.gu-close {
  display: grid; place-items: center; flex: none; width: var(--target); height: var(--target); margin-left: auto;
  background: none; border: 0; border-radius: 2px; font-size: 24px; line-height: 1; color: var(--ink-2);
}
.gu-close:hover { background: var(--paper-2); color: var(--ink); }
.gu-close:active { background: var(--paper-3); }

/* ---- the stage and the panel frame ---- */
.gu-stage { position: absolute; inset: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; padding: var(--s4); background: var(--scrim); pointer-events: auto; }
.gu-panel {
  position: relative; display: flex; flex-direction: column; min-width: 0; max-width: 100%; max-height: 100%;
  padding: 32px 36px 36px;
  background-color: var(--paper); border: 2px solid var(--ink); border-radius: 2px;
  box-shadow: inset 0 0 0 2px var(--paper-light), inset 0 0 0 4px var(--paper), inset 0 0 0 6px var(--line-strong), 0 16px 48px var(--shadow);
  zoom: var(--gu-size);
  animation: gu-in 120ms var(--ease);
}
.gu-panel:focus-visible { outline: none; }
/*
 * The panel picture is the frame: a border image cut at its corner ornaments. The picture's middle has a stain
 * that smears when stretched, so three of the corner elements become sheets of flat paper laid over everything
 * inside the frame lines: a tall one, a wide one and a middle one, which together leave only the four ornaments
 * showing. --u is one picture pixel. The 2px is the panel's own border.
 */
.gu-art-panel .gu-panel {
  --u: var(--gu-panel-unit);
  isolation: isolate;
  border-color: transparent; border-radius: 0;
  border-image: var(--gu-panel-art) var(--gu-panel-slice) / calc(var(--gu-panel-slice) * var(--u)) stretch;
  background-clip: padding-box; image-rendering: pixelated;
  box-shadow: 0 16px 48px var(--shadow);
  padding: 36px 40px 40px;
}
.gu-art-panel .gu-panel > * { image-rendering: auto; }
.gu-art-panel .gu-panel > .gu-corner { z-index: -1; width: auto; height: auto; border: 0; background: var(--paper); }
.gu-art-panel .gu-panel > .gu-corner:nth-of-type(1) { inset: calc(10 * var(--u) - 2px) calc(28 * var(--u) - 2px); }
.gu-art-panel .gu-panel > .gu-corner:nth-of-type(2) { inset: calc(28 * var(--u) - 2px) calc(10 * var(--u) - 2px); }
.gu-art-panel .gu-panel > .gu-corner:nth-of-type(3) { inset: calc(16 * var(--u) - 2px); }
.gu-art-panel .gu-panel > .gu-corner:nth-of-type(4) { display: none; }
/* It moves but never fades, so a panel is readable from its first frame. */
@keyframes gu-in { from { transform: scale(0.97); } }
.gu-corner { position: absolute; width: 14px; height: 14px; background: linear-gradient(135deg, var(--brass), var(--brass-dark)); border: 2px solid var(--ink); pointer-events: none; }
.gu-corner:nth-of-type(1) { left: -4px; top: -4px; }
.gu-corner:nth-of-type(2) { right: -4px; top: -4px; }
.gu-corner:nth-of-type(3) { right: -4px; bottom: -4px; }
.gu-corner:nth-of-type(4) { left: -4px; bottom: -4px; }
.gu-panel-head { display: flex; align-items: center; gap: var(--s5); min-height: var(--target); margin-bottom: var(--s4); }
.gu-panel-title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
/* The body scrolls. The padding keeps a focus ring at its edge from being cut off. */
.gu-panel-body { min-height: 0; margin: -4px; padding: 4px; overflow: auto; overscroll-behavior: contain; }
.gu-section + .gu-section, .gu-choices + .gu-section, .gu-section + .gu-choices { margin-top: var(--s6); }
.gu-section > .gu-label, .gu-choices > .gu-label { display: block; margin-bottom: var(--s3); }

/* ---- bag ---- */
.gu-tabs { display: flex; gap: var(--s1); }
.gu-tab { min-height: var(--target); padding: 0 var(--s3); background: none; border: 0; border-bottom: 2px solid transparent; color: var(--ink-2); }
.gu-tab:hover { color: var(--ink); }
.gu-tab[aria-selected='true'] { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
.gu-bag-things { display: grid; grid-template-columns: auto 240px; gap: var(--s6); align-items: start; }
.gu-bag:not(.gu-bag-things) { width: 560px; max-width: 100%; }
.gu-slots { display: grid; grid-template-columns: repeat(9, 64px); gap: 6px; }
.gu-slot { position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0; background: var(--paper-2); border: 0; border-radius: 2px; }
.gu-slot:hover { background: var(--paper-3); }
.gu-quick { background: var(--paper-3); margin-bottom: var(--s3); }
.gu-quick:hover { background: oklch(0.76 0.08 75); }
.gu-picked { box-shadow: inset 0 0 0 2px var(--accent); }
.gu-slot-key { position: absolute; z-index: 1; left: 2px; top: 2px; padding: 0 3px; font-size: 12px; line-height: 1.3; color: var(--ink-2); background-color: var(--paper-3); border-radius: 2px; }
.gu-slot-count { position: absolute; z-index: 1; right: 2px; bottom: 2px; padding: 0 4px; font-size: 13px; font-weight: 600; line-height: 1.3; background: var(--paper); border-radius: 2px; }
.gu-detail { display: grid; gap: var(--s2); align-content: start; min-height: 200px; }
.gu-detail-name { margin-top: var(--s2); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.gu-detail-text { max-width: 34ch; text-wrap: pretty; }

/* ---- recipes ---- */
.gu-make { width: 560px; max-width: 100%; }
.gu-recipes { display: grid; gap: var(--s5); }
.gu-recipe { display: grid; grid-template-columns: 48px 1fr auto; gap: var(--s4); align-items: start; }
.gu-recipe-name { font-weight: 600; }
.gu-needs { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s4); margin-top: var(--s1); color: var(--ink-2); }
.gu-need { display: inline-flex; align-items: center; gap: 6px; }
.gu-short .gu-num { color: var(--ink); font-weight: 600; }
.gu-recipe-act { display: grid; justify-items: end; gap: var(--s1); }
.gu-why { max-width: 22ch; font-size: 14px; color: var(--ink-2); text-align: right; text-wrap: balance; }

/* ---- almanac ---- */
.gu-book { display: grid; grid-template-columns: 216px 32px 1fr; width: 820px; max-width: 100%; min-height: 420px; }
.gu-book-blank { display: grid; grid-template-columns: 1fr; place-items: center; }
.gu-index { display: grid; gap: var(--s5); align-content: start; padding-right: var(--s2); }
.gu-index-group { display: grid; gap: 2px; }
.gu-index-group .gu-label { margin-bottom: var(--s1); padding-left: var(--s3); }
.gu-page-link { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); min-height: var(--target); padding: 0 var(--s3); background: none; border: 0; border-radius: 2px; text-align: left; }
.gu-page-link:hover { background: var(--paper-2); }
.gu-page-link[aria-current='page'] { background: var(--paper-3); font-weight: 600; }
.gu-new { font-size: 13px; font-weight: 600; color: var(--accent); }
/* The spine: a soft shadow down the fold, not a line. */
.gu-spine { background: linear-gradient(90deg, oklch(0.27 0.025 40 / 0), oklch(0.27 0.025 40 / 0.1) 50%, oklch(0.27 0.025 40 / 0)); }
.gu-leaf { position: relative; padding-left: var(--s4); }
.gu-leaf-head { display: flex; align-items: center; gap: var(--s4); padding-bottom: var(--s5); }
.gu-leaf-head .gu-pic { background-color: var(--paper-2); border-radius: 2px; }
.gu-leaf-title { font-size: 28px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; }
.gu-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s6); padding-top: var(--s5); border-top: 1px solid var(--line); }
.gu-column .gu-label { margin-bottom: var(--s3); }
.gu-facts { display: grid; gap: var(--s3); }
.gu-fact { min-height: 1.45em; max-width: 34ch; text-wrap: pretty; }
.gu-dashes { display: block; width: 78%; height: 0.95em; border-bottom: 2px dashed oklch(0.27 0.025 40 / 0.32); }
.gu-inked { display: inline-block; animation: gu-ink 900ms var(--ease) both; }
@keyframes gu-ink { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.gu-stamp { margin-left: auto; align-self: start; padding: 3px 10px; border: 2px solid var(--done); border-radius: 3px; color: var(--done); font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; transform: rotate(-6deg); }
.gu-stamped { animation: gu-stamp 140ms var(--ease) both; }
@keyframes gu-stamp { from { transform: rotate(-6deg) scale(1.3); } }

/* ---- quests ---- */
.gu-quests { width: 520px; max-width: 100%; }
.gu-quest + .gu-quest { margin-top: var(--s6); }
.gu-quest-title { display: flex; align-items: baseline; gap: var(--s3); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.gu-quest-summary { margin-top: var(--s1); max-width: 56ch; color: var(--ink-2); text-wrap: pretty; }
.gu-steps { display: grid; gap: var(--s2); margin-top: var(--s3); }
.gu-step { display: grid; grid-template-columns: 16px 1fr auto; gap: var(--s3); align-items: baseline; }
.gu-step-mark { width: 12px; height: 12px; border: 1.5px solid var(--ink-2); border-radius: 50%; transform: translateY(1px); }
.gu-step-done .gu-step-mark { background: var(--done); border-color: var(--done); }
.gu-step-done .gu-step-text, .gu-quest-done .gu-quest-title { color: var(--ink-2); }
.gu-quest-done .gu-quest-title { font-size: 16px; }
.gu-quest-done .gu-quest-state { color: var(--done); }

/* ---- menus: pause, settings, the end ---- */
.gu-menu { display: grid; gap: var(--s2); width: 280px; max-width: 100%; }
.gu-menu .gu-btn { min-height: 48px; }
.gu-menu-note { font-size: 14px; color: var(--ink-2); }
.gu-settings { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s7); width: 880px; max-width: 100%; }
.gu-settings > .gu-section { margin-top: 0; }
.gu-strip { display: flex; gap: var(--s1); }
.gu-choice { position: relative; flex: 1; min-width: 0; }
.gu-choice input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.gu-choice span { display: grid; place-items: center; min-height: var(--target); padding: 0 var(--s2); background: var(--paper-2); border-radius: 2px; }
.gu-choice input:hover + span { background: var(--paper-3); }
.gu-choice input:checked + span { background: var(--ink); color: var(--paper); font-weight: 600; }
.gu-choice input:focus-visible + span { outline: 2px solid var(--ink); outline-offset: 2px; }
.gu-slider { display: grid; grid-template-columns: 96px 1fr 48px; gap: var(--s4); align-items: center; min-height: var(--target); }
.gu-slider input { width: 100%; min-width: 0; height: var(--target); margin: 0; accent-color: var(--ink); cursor: pointer; }
.gu-slider output { text-align: right; color: var(--ink-2); }
.gu-keylist { display: grid; grid-template-columns: 1fr auto; gap: var(--s2) var(--s5); align-items: center; }
.gu-keylist dd { justify-self: end; }
.gu-panel-end { padding: var(--s7) var(--s7) var(--s6); }
.gu-end { display: grid; justify-items: center; gap: var(--s5); width: 440px; max-width: 100%; text-align: center; }
.gu-end-title { font-size: 28px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; }
.gu-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s5) var(--s6); width: 100%; padding: var(--s2) 0; }
.gu-stat { display: flex; flex-direction: column-reverse; }
.gu-stat dd { font-size: 40px; font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; }
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
.gu-chapter { font-size: 40px; font-weight: 600; line-height: 1.08; letter-spacing: -0.025em; text-wrap: balance; }
.gu-plate .gu-menu { width: 100%; }

/* ---- over the game: prompt, hints, toasts, the ring ---- */
.gu-over { position: absolute; inset: 0; }
.gu-card { display: flex; align-items: center; gap: var(--s3); padding: var(--s2) var(--s2) var(--s2) var(--s4); background: var(--paper); border: 2px solid var(--ink); border-radius: 2px; box-shadow: 0 6px 20px var(--shadow); pointer-events: auto; zoom: var(--gu-size); }
.gu-top { position: absolute; left: 50%; top: var(--s4); display: grid; justify-items: center; gap: var(--s2); width: min(440px, 100% - 32px); transform: translateX(-50%); }
.gu-hint { width: 100%; animation: gu-drop 140ms var(--ease); }
.gu-hint-text { flex: 1; max-width: 46ch; padding: var(--s1) 0; text-wrap: pretty; }
.gu-note { min-height: 44px; padding-right: var(--s3); font-weight: 600; animation: gu-drop 140ms var(--ease); }
.gu-note:hover { background: var(--paper-2); }
@keyframes gu-drop { from { transform: translateY(-6px); } }
.gu-prompt { position: absolute; left: 50%; display: flex; align-items: center; gap: var(--s2); padding: 6px 14px 6px 8px; background: var(--paper); border: 2px solid var(--ink); border-radius: 2px; box-shadow: 0 4px 14px var(--shadow); font-weight: 600; white-space: nowrap; transform: translateX(-50%); zoom: var(--gu-size); }
.gu-toasts { position: absolute; left: var(--s4); bottom: var(--s4); display: grid; justify-items: start; gap: var(--s1); max-width: calc(100% - 32px); zoom: var(--gu-size); }
.gu-toast { display: flex; align-items: center; gap: var(--s2); min-height: 36px; padding: 2px var(--s3) 2px var(--s2); background: var(--paper); border: 2px solid var(--ink); border-radius: 2px; box-shadow: 0 3px 10px var(--shadow); animation: gu-rise 140ms var(--ease); }
.gu-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gu-toast-count { font-weight: 600; }
.gu-toast-count:empty { display: none; }
@keyframes gu-rise { from { transform: translateY(6px); } }
.gu-ring { position: absolute; left: 0; top: 0; width: 32px; height: 32px; }
.gu-ring svg { display: block; width: 32px; height: 32px; transform: rotate(-90deg); }
.gu-ring circle { fill: none; }
.gu-ring-edge { stroke: oklch(0.2 0.03 60 / 0.55); stroke-width: 6; }
.gu-ring-track { stroke: oklch(0.886 0.076 76 / 0.35); stroke-width: 3; }
.gu-ring-arc { stroke: var(--paper-light); stroke-width: 3; stroke-linecap: round; }

/* ---- a root too narrow for the bag's two columns ---- */
@container gu (width < 1040px) {
  .gu-bag-things { grid-template-columns: 1fr; gap: var(--s4); }
  .gu-slots { grid-template-columns: repeat(9, minmax(0, 64px)); }
  .gu-detail { grid-template-columns: 64px 1fr; column-gap: var(--s4); min-height: 132px; }
  .gu-detail > .gu-pic { grid-row: span 3; }
  .gu-detail > .gu-empty { grid-column: 1 / -1; }
  .gu-detail-name { margin-top: 0; }
  .gu-settings { grid-template-columns: 1fr; gap: var(--s6); width: 520px; }
}

/* ---- a narrow root: bigger targets, one column ---- */
@container gu (width < 640px) {
  .gu-root > * { --target: 44px; }
  .gu-stage { padding: var(--s2); }
  .gu-panel, .gu-card, .gu-prompt, .gu-toasts { zoom: 1; }
  .gu-panel { width: 100%; padding: var(--s5) 20px var(--s5); }
  .gu-art-panel .gu-panel { --u: calc(var(--gu-panel-unit) / 2); padding: var(--s5) 20px var(--s5); }
  .gu-panel-head { gap: var(--s3); }
  .gu-slots { grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .gu-quick { margin-bottom: 0; }
  .gu-bag:not(.gu-bag-things), .gu-make, .gu-quests, .gu-settings, .gu-book, .gu-end { width: 100%; }
  .gu-recipe { grid-template-columns: 48px 1fr; }
  .gu-recipe-act { grid-column: 2; justify-items: start; }
  .gu-why { max-width: none; text-align: left; }
  .gu-book { grid-template-columns: 1fr; min-height: 0; gap: var(--s4); }
  .gu-index { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); padding: 0; }
  .gu-index-group { display: flex; align-items: center; gap: var(--s1); flex: none; }
  .gu-index-group .gu-label { margin: 0; padding: 0 var(--s1) 0 0; }
  .gu-page-link { background: var(--paper-2); white-space: nowrap; }
  .gu-leaf { padding-left: 0; }
  .gu-spine { display: none; }
  .gu-leaf-head .gu-pic { zoom: 0.667; }
  .gu-leaf-title { font-size: 24px; }
  .gu-columns { grid-template-columns: 1fr; gap: var(--s5); }
  .gu-slider { grid-template-columns: 80px 1fr 44px; gap: var(--s3); }
  .gu-choice { flex: 1 1 auto; }
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
