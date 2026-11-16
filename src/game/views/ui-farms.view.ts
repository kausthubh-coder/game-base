// The farms' interface, in the Gilded Hearth look (docs/ui-look.md) and from the approved sheets in
// assets-src/concept/interface: `ratetag`, `bench` and `kit`. The field book's creature pages are the Almanac's.
//
// - The rate tag hangs over each farm the hero stands near: its name and rate on night glass, and under it the one
//   line that says what is wrong. E beside the farm opens its panel: the rate, the symptom, the fix one press
//   further ("Why?"), the best rate, and Give or Take.
// - A collector chest's use opens what it holds, with Take all.
// - The Workbench: the four steps, the sword, the bow, the staff and the armour, the recipe, the two fittings, Make.
//   It opens from the Make panel's gold pill, or from the Road kit's tab.
// - The Road kit (K): the three slots and every kit thing in the bag, a detail card, Equip.
//
// Panels pause the game while open and take Esc before the pause menu does.
import type { BenchMake, FarmView, FarmsApi, Systems } from '../api.sim.ts';
import { farmDef } from '../content/farms.ts';
import { FITTINGS, FITTING_ICONS, GEAR_ICONS, GEAR_STEPS, KIT, type FittingId, type GearTier, type WeaponKind } from '../content/gear.ts';
import { KIT_IDS, type FarmId, type KitId } from '../content/ids.ts';
import type { GameView } from '../shell/view.ts';
import { worldLabelLayout } from './world-label-layout.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** Within this many blocks of a farm its tag shows. */
const TAG_NEAR = 14;
const PAUSE = 'farms-panel';

const STYLE = /* css */ `
/* ---- the rate tag: night glass pills over the world ---- */
.ui-book .fm-tag { position: absolute; left: 0; top: 0; display: grid; justify-items: center; gap: 6px; pointer-events: none; will-change: transform;
  transform-origin: 50% 100%; }
.ui-book .fm-leader { position: absolute; height: 1px; background: var(--ui-gold); opacity: 0.7; transform-origin: 0 50%; pointer-events: none; }
.ui-book .fm-pill { display: inline-flex; align-items: center; gap: 10px; max-width: min(520px, 86vw); padding: 7px 22px 7px 16px; border-radius: 999px;
  color: var(--ui-glass-ink); background: var(--ui-glass); box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow);
  font: 700 16px/1.25 var(--ui-font); white-space: nowrap; text-shadow: 0 1px 2px rgb(10 12 20 / 0.6); }
.ui-book .fm-pill b { font: 650 19px/1.2 var(--ui-display); color: var(--ui-paper-light); }
.ui-book .fm-pill i { font-style: normal; color: var(--ui-glass-ink-2); }
.ui-book .fm-pill.fm-sym { padding: 6px 18px 6px 14px; font-size: 14px; white-space: normal; text-align: left; }
.ui-book .fm-dia { flex: none; width: 10px; height: 10px; rotate: 45deg; background: var(--ui-gold-bright); box-shadow: 0 0 6px rgb(240 212 138 / 0.7); }
.ui-book .fm-dia.is-done { background: var(--ui-done-light); box-shadow: 0 0 6px rgb(169 208 138 / 0.7); }
.ui-book .fm-dia.is-new { background: var(--ui-new); }

@media (max-width: 640px) {
  .ui-book .fm-tag { max-width: calc(100vw - 16px); gap: 4px; }
  .ui-book .fm-pill { max-width: calc(100vw - 16px); box-sizing: border-box; gap: 6px; padding: 6px 12px; font-size: 12px; white-space: normal; }
  .ui-book .fm-pill b { font-size: 15px; }
  .ui-book .fm-pill.fm-sym { font-size: 12px; padding: 6px 12px; }
  .ui-book .fm-pill i { min-width: 0; }
}
/* ---- a panel: paper in a gold frame ---- */
.ui-book .fm-stage { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: auto; z-index: 30;
  background: radial-gradient(120% 90% at 50% 45%, rgb(20 24 36 / 0.45), rgb(10 12 20 / 0.82)); font-family: var(--ui-font); }
.ui-book .fm-panel { position: relative; display: flex; flex-direction: column; gap: 14px; width: min(980px, 100%); max-height: 100%; overflow: auto;
  padding: 30px 40px 34px; color: var(--ui-ink); border-radius: 16px;
  background: radial-gradient(140% 100% at 20% 0%, var(--ui-paper-light), var(--ui-paper) 60%);
  box-shadow: inset 0 0 0 1.5px var(--ui-gold), inset 0 0 0 6px var(--ui-paper), inset 0 0 0 7px rgb(166 137 90 / 0.5), var(--ui-lift);
  animation: fm-in 160ms var(--ui-ease); }
.ui-book.ui-kit .fm-panel { border: 56px solid transparent; border-image: var(--kit-panel) 112 fill / 56px stretch; background: none; box-shadow: var(--ui-lift); padding: 0; border-radius: 0; }
@keyframes fm-in { from { transform: scale(0.97) translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .ui-book .fm-panel, .ui-book .fm-screen { animation: none; } }
.ui-book .fm-small { width: min(620px, 100%); }
.ui-book .fm-head { position: relative; display: grid; justify-items: center; gap: 2px; padding-bottom: 12px; }
.ui-book .fm-head::after { content: ''; position: absolute; left: 18%; right: 18%; bottom: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--ui-gold) 20%, var(--ui-gold) 80%, transparent); }
.ui-book .fm-head h2 { margin: 0; font: 650 34px/1.1 var(--ui-display); letter-spacing: 0.005em; }
.ui-book .fm-head small { font: 700 14px/1.2 var(--ui-font); color: var(--ui-ink-2); letter-spacing: 0.04em; text-transform: uppercase; }
.ui-book .fm-close { position: absolute; top: 0; right: 0; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%;
  color: var(--ui-ink); background: var(--ui-paper-light); box-shadow: inset 0 0 0 1.5px var(--ui-gold), 0 1px 3px rgb(10 12 20 / 0.2); font: 600 22px/1 var(--ui-font); cursor: pointer; }
.ui-book.ui-kit .fm-close { color: transparent; background: var(--kit-close) center / 100% 100% no-repeat; box-shadow: none; }
.ui-book .fm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 46px; padding: 0 24px; border: 0; border-radius: 999px; cursor: pointer;
  color: var(--ui-paper-light); background: linear-gradient(180deg, #56607a, #4a5366 55%, #424a5c); font: 700 16px/1 var(--ui-font); white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 6px rgb(10 12 20 / 0.22); transition: transform 80ms var(--ui-ease), filter 120ms var(--ui-ease); }
.ui-book .fm-btn:hover { filter: brightness(1.12); }
.ui-book .fm-btn:active { transform: scale(0.97); }
.ui-book .fm-btn.is-gold { color: var(--ui-night); background: linear-gradient(180deg, #f6dfa0, #e2c07a 55%, #cfa863);
  box-shadow: inset 0 0 0 1px rgb(255 247 220 / 0.7), 0 0 0 1px var(--ui-bronze), 0 2px 10px rgb(201 162 94 / 0.45); font: 650 22px/1 var(--ui-display); min-height: 54px; min-width: 300px; }
.ui-book .fm-btn:disabled { color: var(--ui-ink-2); background: var(--ui-paper-2); box-shadow: inset 0 0 0 1px var(--ui-line-strong); cursor: default; filter: none; transform: none; }
.ui-book .fm-strip { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--ui-paper-3); box-shadow: inset 0 1px 2px rgb(10 12 20 / 0.15); }
.ui-book .fm-strip button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 999px; cursor: pointer;
  color: var(--ui-ink); background: transparent; font: 700 15px/1 var(--ui-font); }
.ui-book .fm-strip button .fm-dia { background: transparent; box-shadow: inset 0 0 0 2px var(--ui-bronze); }
.ui-book .fm-strip button[aria-pressed='true'] .fm-dia { background: var(--ui-gold-bright); box-shadow: 0 0 6px rgb(240 212 138 / 0.7); }
.ui-book .fm-strip button[aria-pressed='true'] { color: var(--ui-paper-light); background: linear-gradient(180deg, #56607a, #4a5366); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55); }
.ui-book .fm-strip button:disabled { opacity: 0.5; cursor: default; }
.ui-book .fm-rule { margin: 0; font: 600 15px/1.45 var(--ui-font); color: var(--ui-ink-2); text-align: center; }

/* ---- the farm panel ---- */
.ui-book .fm-rate { display: grid; justify-items: center; gap: 4px; }
.ui-book .fm-rate strong { font: 650 40px/1.05 var(--ui-display); }
.ui-book .fm-rate span { font: 700 15px/1.2 var(--ui-font); color: var(--ui-ink-2); }
.ui-book .fm-lines { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.ui-book .fm-lines li { display: grid; grid-template-columns: 110px 1fr; gap: 14px; align-items: baseline; padding: 10px 2px; border-bottom: 1px solid var(--ui-line); }
.ui-book .fm-lines li > b { font: 650 17px/1.2 var(--ui-display); color: var(--ui-bronze); }
.ui-book .fm-lines li > span { font: 650 16px/1.4 var(--ui-font); }
.ui-book .fm-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.ui-book .fm-take { font: 700 14px/1.2 var(--ui-font); color: var(--ui-ink-2); }

/* ---- night wells for icons ---- */
.ui-book .fm-well { position: relative; display: grid; place-items: center; flex: none; width: 56px; height: 56px; border-radius: 12px;
  background: radial-gradient(circle at 50% 35%, var(--ui-night-2), var(--ui-night)); box-shadow: inset 0 0 0 1.5px var(--ui-bronze), 0 2px 4px rgb(10 12 20 / 0.25); }
.ui-book .fm-well > .ui-cell { display: block; width: 64%; height: 64%; image-rendering: pixelated; }
.ui-book .fm-well > b { position: absolute; right: -4px; bottom: -4px; min-width: 20px; padding: 1px 5px; border-radius: 8px; font: 800 12px/16px var(--ui-font);
  color: var(--ui-ink); background: var(--ui-paper-light); box-shadow: 0 1px 2px rgb(10 12 20 / 0.35); text-align: center; }
.ui-book .fm-goods { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; min-height: 60px; }
.ui-book .fm-empty { font: 600 16px/1.4 var(--ui-font); color: var(--ui-ink-2); text-align: center; }

/* ---- the Workbench ---- */
.ui-book .fm-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.ui-book .fm-steps button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 0; border-radius: 999px; cursor: pointer;
  color: var(--ui-paper-light); background: linear-gradient(180deg, #56607a, #4a5366 55%, #424a5c); font: 700 17px/1 var(--ui-font);
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), 0 2px 6px rgb(10 12 20 / 0.22); }
.ui-book .fm-steps button[aria-pressed='true'] { color: var(--ui-night); background: linear-gradient(180deg, #f6dfa0, #e2c07a 55%, #cfa863); box-shadow: inset 0 0 0 1px rgb(255 247 220 / 0.7), 0 0 0 1px var(--ui-bronze); }
.ui-book .fm-steps button.is-locked { opacity: 0.55; }
.ui-book .fm-steps .fm-dia { background: currentColor; box-shadow: none; width: 9px; height: 9px; }
.ui-book .fm-kinds { display: flex; justify-content: center; gap: 14px; }
.ui-book .fm-kinds button { width: 72px; height: 72px; padding: 0; border: 0; border-radius: 12px; cursor: pointer;
  background: radial-gradient(circle at 50% 35%, var(--ui-night-2), var(--ui-night)); box-shadow: inset 0 0 0 1.5px var(--ui-bronze); display: grid; place-items: center; }
.ui-book .fm-kinds button[aria-pressed='true'] { box-shadow: inset 0 0 0 2.5px var(--ui-gold-bright), 0 0 14px rgb(240 212 138 / 0.65); }
.ui-book .fm-kinds button > .ui-cell { display: block; width: 64%; height: 64%; image-rendering: pixelated; }
.ui-book .fm-make { display: grid; grid-template-columns: 210px minmax(0, 1fr) minmax(0, 1.2fr); gap: 22px; align-items: start; }
.ui-book .fm-big { display: grid; place-items: center; aspect-ratio: 1; border-radius: 14px; background: radial-gradient(circle at 50% 35%, var(--ui-night-2), var(--ui-night));
  box-shadow: inset 0 0 0 2px var(--ui-bronze), 0 3px 8px rgb(10 12 20 / 0.3); }
.ui-book .fm-big > .ui-cell { display: block; width: 72%; height: 72%; image-rendering: pixelated; }
.ui-book .fm-make h3 { margin: 6px 0 10px; font: 650 26px/1.15 var(--ui-display); }
.ui-book .fm-make h4 { margin: 0 0 8px; font: 700 15px/1.2 var(--ui-font); color: var(--ui-ink-2); }
.ui-book .fm-needs { display: grid; gap: 8px; }
.ui-book .fm-need { display: flex; align-items: center; gap: 12px; padding: 6px 12px 6px 6px; border-radius: 12px; background: var(--ui-paper-light); box-shadow: inset 0 0 0 1px var(--ui-line); font: 650 16px/1.2 var(--ui-font); }
.ui-book .fm-need .fm-well { width: 44px; height: 44px; border-radius: 10px; }
.ui-book .fm-need em { margin-left: auto; font-style: normal; font: 800 14px/1 var(--ui-font); color: var(--ui-done); }
.ui-book .fm-need.is-short em { color: #b0542f; }
.ui-book .fm-fits { display: grid; gap: 12px; padding-left: 22px; border-left: 1px solid var(--ui-line-strong); }
.ui-book .fm-fits h3 { margin: 0 0 4px; font: 650 22px/1.2 var(--ui-display); }
.ui-book .fm-fit { display: grid; grid-template-columns: 20px 56px 1fr; gap: 14px; align-items: center; padding: 12px 16px; border: 0; border-radius: 14px; cursor: pointer; text-align: left;
  color: var(--ui-ink); background: var(--ui-paper-light); box-shadow: inset 0 0 0 1px var(--ui-line-strong); font: inherit; }
.ui-book .fm-fit[aria-pressed='true'] { background: linear-gradient(180deg, #fbf1d6, #f1dfb2); box-shadow: inset 0 0 0 2px var(--ui-gold), 0 0 14px rgb(240 212 138 / 0.45); }
.ui-book .fm-fit .fm-dia { background: transparent; box-shadow: inset 0 0 0 2px var(--ui-bronze); width: 13px; height: 13px; }
.ui-book .fm-fit[aria-pressed='true'] .fm-dia { background: var(--ui-gold-bright); box-shadow: inset 0 0 0 2px var(--ui-bronze); }
.ui-book .fm-fit strong { display: block; font: 650 20px/1.2 var(--ui-display); }
.ui-book .fm-fit small { display: block; font: 700 14px/1.3 var(--ui-font); color: var(--ui-ink-2); }
.ui-book .fm-fit span { display: block; font: 600 14px/1.35 var(--ui-font); }
.ui-book .fm-why { min-height: 20px; margin: 0; font: 700 15px/1.3 var(--ui-font); color: #9b4d2a; text-align: center; }
.ui-book .fm-owned { font: 700 14px/1.3 var(--ui-font); color: var(--ui-ink-2); text-align: center; }

/* ---- the Road kit: a full-screen menu ---- */
.ui-book .fm-screen { position: absolute; inset: 0; z-index: 30; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; pointer-events: auto; font-family: var(--ui-font); color: var(--ui-paper-light);
  background: radial-gradient(120% 85% at 50% 0%, rgb(46 54 84 / 0.95), rgb(24 28 43 / 0.97) 55%, rgb(12 14 22 / 0.98)); animation: fm-up 200ms var(--ui-ease); }
.ui-book.ui-kit .fm-screen { background: var(--kit-stars) 0 0 / 384px 384px repeat, radial-gradient(120% 85% at 50% 0%, rgb(46 54 84 / 0.95), rgb(24 28 43 / 0.97) 55%, rgb(12 14 22 / 0.98)); }
@keyframes fm-up { from { transform: translateY(12px); } }
.ui-book .fm-rail { position: relative; display: flex; align-items: center; gap: 18px; min-height: 76px; padding: 0 28px; }
.ui-book .fm-rail::after { content: ''; position: absolute; left: 0; right: 0; bottom: 8px; height: 1px; background: linear-gradient(90deg, transparent, rgb(211 188 142 / 0.6) 15%, rgb(211 188 142 / 0.6) 85%, transparent); }
.ui-book .fm-rail h2 { margin: 0; font: 650 32px/1 var(--ui-display); text-shadow: 0 2px 8px rgb(0 0 0 / 0.5); }
.ui-book .fm-tabs { display: flex; gap: 12px; margin: 0 auto; }
.ui-book .fm-tabs button { min-height: 44px; padding: 0 20px; border: 0; border-radius: 999px; cursor: pointer; color: var(--ui-paper-light); font: 700 15px/1 var(--ui-font);
  background: rgb(22 26 38 / 0.7); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55); }
.ui-book .fm-tabs button[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 12px rgb(240 212 138 / 0.5); }
.ui-book .fm-screen .fm-close { position: static; }
.ui-book .fm-kitbody { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; width: min(1100px, 100%); margin: 0 auto; padding: 18px 32px; overflow: auto; }
.ui-book .fm-kitbox { display: grid; gap: 14px; padding: 22px 26px 26px; border-radius: 16px; background: rgb(14 17 27 / 0.55); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.5); }
.ui-book .fm-kitbox h3 { display: flex; align-items: center; gap: 14px; margin: 0; font: 650 22px/1.2 var(--ui-display); }
.ui-book .fm-kitbox h3::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgb(211 188 142 / 0.6), transparent); }
.ui-book .fm-slots, .ui-book .fm-reserve { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ui-book .fm-card { position: relative; display: grid; justify-items: center; align-content: center; gap: 8px; min-height: 150px; padding: 14px 10px; border: 0; border-radius: 14px; cursor: pointer;
  color: var(--ui-paper-light); background: radial-gradient(circle at 50% 30%, var(--ui-night-2), var(--ui-night)); box-shadow: inset 0 0 0 1.5px rgb(166 137 90 / 0.8); font: 700 16px/1.2 var(--ui-font); }
.ui-book.ui-kit .fm-card { background: var(--kit-card) center / 100% 100% no-repeat; align-content: start; padding-top: 22px; }
/* On the painted card the name sits on its cream band at the foot, in ink. */
.ui-book.ui-kit .fm-card:not(.is-empty) > .fm-name { position: absolute; left: 8%; right: 8%; bottom: 9%; color: var(--ui-ink); text-shadow: none; font-size: 15px; }
.ui-book.ui-kit .fm-card:not(.is-empty) .fm-count { bottom: auto; top: 10px; }
.ui-book .fm-reserve .fm-card { min-height: 112px; }
.ui-book .fm-card > .ui-cell { display: block; width: 64px; height: 64px; image-rendering: pixelated; }
.ui-book .fm-card[aria-pressed='true'] { box-shadow: inset 0 0 0 2.5px var(--ui-gold-bright), 0 0 18px rgb(240 212 138 / 0.55); }
.ui-book .fm-card.is-empty { color: var(--ui-glass-ink-2); box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.3); background: rgb(14 17 27 / 0.4); }
.ui-book .fm-card.is-none { opacity: 0.45; }
.ui-book .fm-card .fm-num { position: absolute; left: 10px; top: 10px; display: grid; place-items: center; width: 28px; height: 28px; rotate: 45deg; border-radius: 4px;
  background: linear-gradient(180deg, #f6dfa0, #cfa863); box-shadow: 0 0 0 1px var(--ui-bronze); }
.ui-book .fm-card .fm-num > i { rotate: -45deg; font: 800 14px/1 var(--ui-font); font-style: normal; color: var(--ui-night); }
.ui-book .fm-card .fm-count { position: absolute; right: 10px; bottom: 10px; padding: 2px 8px; border-radius: 8px; font: 800 13px/1.2 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper-light); }
.ui-book .fm-detail { display: grid; justify-items: center; gap: 12px; padding: 30px 26px; border-radius: 16px; color: var(--ui-ink);
  background: radial-gradient(140% 100% at 20% 0%, var(--ui-paper-light), var(--ui-paper) 60%); box-shadow: inset 0 0 0 1.5px var(--ui-gold), var(--ui-lift); }
.ui-book.ui-kit .fm-detail { background: var(--kit-detail) center / 100% 100% no-repeat; box-shadow: 0 10px 30px rgb(0 0 0 / 0.4); }
.ui-book .fm-detail > .ui-cell { display: block; width: 112px; height: 112px; image-rendering: pixelated; }
.ui-book .fm-detail h3 { margin: 0; font: 650 30px/1.1 var(--ui-display); text-align: center; }
.ui-book .fm-detail ul { display: grid; gap: 10px; width: 100%; margin: 4px 0 8px; padding: 12px 0 0; list-style: none; border-top: 1px solid var(--ui-gold); }
.ui-book .fm-detail li { display: grid; grid-template-columns: 14px 1fr; gap: 12px; align-items: baseline; font: 650 15px/1.35 var(--ui-font); }
.ui-book .fm-detail li::before { content: ''; width: 9px; height: 9px; rotate: 45deg; background: var(--ui-gold); }
.ui-book .fm-cues { display: flex; justify-content: flex-end; align-items: center; gap: 18px; min-height: 56px; padding: 0 28px; }
.ui-book .fm-cues span { display: inline-flex; align-items: center; gap: 8px; font: 700 15px/1 var(--ui-font); }
.ui-book .fm-cues kbd { padding: 4px 9px; border-radius: 7px; font: 800 13px/1 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper-light); box-shadow: inset 0 -2px 0 var(--ui-paper-3); }
.ui-book .fm-pillbtn { position: absolute; z-index: 31; right: 24px; bottom: 24px; pointer-events: auto; min-width: 0; font-size: 18px; }

@media (max-width: 760px) {
  .ui-book .fm-make { grid-template-columns: 1fr; }
  .ui-book .fm-fits { padding-left: 0; border-left: 0; }
  .ui-book .fm-steps { grid-template-columns: repeat(2, 1fr); }
  .ui-book .fm-kitbody { grid-template-columns: 1fr; padding: 12px 16px; }
  .ui-book .fm-panel { padding: 20px 18px 24px; }
  .ui-book .fm-btn.is-gold { min-width: 0; width: 100%; }
}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids) if (kid !== null) node.append(kid);
  return node;
};
const dia = (state = ''): HTMLElement => el('i', { class: `fm-dia${state ? ` is-${state}` : ''}`, 'aria-hidden': 'true' });

export function install(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const book = bookOf(view);
  const art = book.art;
  addStyle(view.root, 'farms', STYLE);

  const icon = (name: string): HTMLElement | null => art.iconElement(name);
  const itemName = (id: string): string => sys.items?.get(id as never)?.name ?? id;
  const itemIcon = (id: string): string => sys.items?.get(id as never)?.icon ?? '';
  const well = (item: string, count?: number): HTMLElement => el('span', { class: 'fm-well' }, icon(itemIcon(item)), count !== undefined ? el('b', {}, String(count)) : null);

  // ---------------------------------------------------------------- the panels' one stage
  let open: { name: string; root: HTMLElement; redraw: () => void } | null = null;

  function show(name: string, root: HTMLElement, redraw: () => void): void {
    close();
    open = { name, root, redraw };
    view.root.append(root);
    view.setPaused(PAUSE, true);
    game.player.busy = true;
    document.exitPointerLock?.();
    redraw();
    game.events.emit('ui.sound', { sound: 'open' });
  }

  function close(): void {
    if (!open) return;
    open.root.remove();
    open = null;
    view.setPaused(PAUSE, false);
    game.player.busy = false;
    book.settle();
    game.events.emit('ui.sound', { sound: 'close' });
  }

  const closeButton = (): HTMLElement => {
    const button = el('button', { class: 'fm-close', type: 'button', 'aria-label': 'Close' }, '×');
    button.addEventListener('click', close);
    return button;
  };

  // ---------------------------------------------------------------- the farm panel
  function farmPanel(id: FarmId): void {
    const def = farmDef(id);
    const stage = el('div', { class: 'fm-stage', 'data-panel': 'farm' });
    const panel = el('section', { class: 'fm-panel fm-small', role: 'dialog', 'aria-label': def.name });
    stage.append(panel);
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    let why = false;
    const redraw = (): void => {
      const farm = sys.farms?.get(id);
      if (!farm) return;
      const lines = el('ul', { class: 'fm-lines' },
        el('li', {}, el('b', {}, 'Rule'), el('span', {}, def.rule)),
        el('li', {}, el('b', {}, 'Wrong'), el('span', { 'data-key': 'symptom' }, farm.symptom || 'Nothing is built here yet.')),
        why ? el('li', {}, el('b', {}, 'Fix'), el('span', { 'data-key': 'fix' }, farm.fix || def.route)) : null,
        el('li', {}, el('b', {}, 'Best'), el('span', {}, farm.best ? `${farm.best} a day, the best this farm has made` : 'Not yet')),
      );
      const whyButton = el('button', { class: 'fm-btn', type: 'button', 'data-key': 'why' }, why ? 'Hide the fix' : 'Why?');
      whyButton.addEventListener('click', () => { why = !why; redraw(); });
      const row = el('div', { class: 'fm-row' }, whyButton);
      if (def.takes) {
        const strip = el('div', { class: 'fm-strip', role: 'group', 'aria-label': 'Give or take' });
        for (const mode of ['give', 'take'] as const) {
          const b = el('button', { type: 'button', 'aria-pressed': String(farm.mode === mode), 'data-key': mode }, dia(), mode === 'give' ? 'Give' : 'Take');
          if (mode === 'take' && (farm.away > 0 || farm.take <= 0) && farm.mode !== 'take') b.setAttribute('disabled', '');
          b.addEventListener('click', () => {
            (sys.farms as FarmsApi | undefined)?.setMode?.(id, mode);
            redraw();
          });
          strip.append(b);
        }
        row.append(strip);
        row.append(el('span', { class: 'fm-take' }, farm.away > 0 ? `Quiet for ${farm.away} more ${farm.away === 1 ? 'day' : 'days'}` : `Take: ${farm.take} now · quiet 3 days`));
      }
      panel.replaceChildren(
        el('header', { class: 'fm-head' }, el('small', {}, def.kind === 'wild' ? 'Wild farm' : def.kind === 'beast' ? 'Beast farm' : 'Crop farm'), el('h2', {}, def.name), closeButton()),
        el('div', { class: 'fm-rate' }, el('strong', { 'data-key': 'rate' }, farm.tag || 'Not built yet'), el('span', {}, farm.sub)),
        lines,
        row,
        el('p', { class: 'fm-rule' }, def.choice),
      );
    };
    show('farm', stage, redraw);
  }

  // ---------------------------------------------------------------- a collector chest
  function chestPanel(id: string): void {
    const stage = el('div', { class: 'fm-stage', 'data-panel': 'collector' });
    const panel = el('section', { class: 'fm-panel fm-small', role: 'dialog', 'aria-label': 'Collector chest' });
    stage.append(panel);
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    const redraw = (): void => {
      const stacks = sys.machines?.chest(id) ?? [];
      const held = stacks.reduce((n, s) => n + s.count, 0);
      const take = el('button', { class: 'fm-btn is-gold', type: 'button', 'data-key': 'take-all' }, 'Take all');
      if (!held) take.setAttribute('disabled', '');
      take.addEventListener('click', () => { sys.machines?.empty(id); redraw(); });
      panel.replaceChildren(
        el('header', { class: 'fm-head' }, el('small', {}, `${held} of ${sys.machines?.chestSize ?? 60}`), el('h2', {}, 'Collector chest'), closeButton()),
        held ? el('div', { class: 'fm-goods' }, ...stacks.map((s) => well(s.id, s.count))) : el('p', { class: 'fm-empty' }, 'Empty. It takes in loose goods within three blocks, and what a chute brings it.'),
        el('div', { class: 'fm-row' }, take),
      );
    };
    show('collector', stage, redraw);
  }

  // ---------------------------------------------------------------- the Workbench
  type Pick = WeaponKind | 'armor';
  const benchState: { tier: GearTier; pick: Pick; fitting: FittingId | null } = { tier: 2, pick: 'sword', fitting: null };

  function benchPanel(): void {
    const bench = sys.bench;
    if (!bench) return;
    const gear = bench.gear();
    benchState.pick = gear.weapon;
    // Open on the next step the weapon in hand can take.
    benchState.tier = Math.min(4, gear.tier + 1) as GearTier;
    benchState.fitting = null;
    const stage = el('div', { class: 'fm-stage', 'data-panel': 'bench' });
    const panel = el('section', { class: 'fm-panel', role: 'dialog', 'aria-label': 'Workbench' });
    stage.append(panel);
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    const redraw = (): void => {
      const step = GEAR_STEPS[benchState.tier - 1];
      const pick = benchState.pick;
      const fits = step.fittings;
      if (benchState.fitting && !fits.includes(benchState.fitting)) benchState.fitting = null;
      if (!benchState.fitting && fits.length) benchState.fitting = fits[0];
      const make: BenchMake | null = benchState.tier === 1 ? null : pick === 'armor' ? { what: 'armor', tier: benchState.tier } : { what: pick, tier: benchState.tier, fitting: benchState.fitting as FittingId };
      const steps = el('div', { class: 'fm-steps', role: 'group', 'aria-label': 'Step' });
      for (const s of GEAR_STEPS) {
        const b = el('button', { type: 'button', 'aria-pressed': String(s.tier === benchState.tier), 'data-key': `step-${s.tier}` }, dia(), s.name.replace(' and ', ' & '));
        b.addEventListener('click', () => { benchState.tier = s.tier; redraw(); });
        steps.append(b);
      }
      const kinds = el('div', { class: 'fm-kinds', role: 'group', 'aria-label': 'What to make' });
      for (const k of ['sword', 'bow', 'staff', 'armor'] as const) {
        const b = el('button', { type: 'button', 'aria-pressed': String(k === pick), 'aria-label': k, 'data-key': k }, icon(GEAR_ICONS[k][benchState.tier - 1]));
        b.addEventListener('click', () => { benchState.pick = k; redraw(); });
        kinds.append(b);
      }
      const name = pick === 'armor' ? step.armor : step.weapons[pick];
      const needs = el('div', { class: 'fm-needs' });
      for (const need of make ? bench.cost(make) : []) {
        const have = sys.inventory?.count(need.id) ?? 0;
        needs.append(el('div', { class: `fm-need${have < need.count ? ' is-short' : ''}` }, well(need.id), el('span', {}, itemName(need.id)), el('em', {}, `${Math.min(have, need.count)} / ${need.count}`)));
      }
      if (!make) needs.append(el('p', { class: 'fm-empty' }, 'A loan from the guild. Everything better, you make.'));
      const fitsBox = el('div', { class: 'fm-fits' }, el('h3', {}, pick === 'armor' || !fits.length ? 'No fitting at this step.' : 'Choose one fitting.'));
      if (pick !== 'armor') {
        for (const f of fits) {
          const fit = FITTINGS[f];
          const b = el('button', { class: 'fm-fit', type: 'button', 'aria-pressed': String(f === benchState.fitting), 'data-key': f },
            dia(), el('span', { class: 'fm-well' }, icon(FITTING_ICONS[f])),
            el('span', {}, el('strong', {}, fit.name), el('small', {}, fit.needs.map(itemName).join(' and ')), el('span', {}, fit.does)));
          b.addEventListener('click', () => { benchState.fitting = f; redraw(); });
          fitsBox.append(b);
        }
      }
      const reason = make ? bench.why(make) : 'The guild issue is a loan, not made.';
      const makeButton = el('button', { class: 'fm-btn is-gold', type: 'button', 'data-key': 'make' }, 'Make');
      if (reason) makeButton.setAttribute('disabled', '');
      makeButton.addEventListener('click', () => {
        if (!make || !bench.make(make)) return;
        game.events.emit('toast', { text: `Made: ${name}${make.what !== 'armor' ? `, with the ${FITTINGS[make.fitting].name.toLowerCase()}` : ''}.`, icon: GEAR_ICONS[pick][benchState.tier - 1] });
        redraw();
      });
      const owned = bench.weapons().map((w) => `${GEAR_STEPS[w.tier - 1].weapons[w.weapon]}${w.fitting ? ` (${FITTINGS[w.fitting].name.toLowerCase()})` : ''}`).join(', ');
      panel.replaceChildren(
        el('header', { class: 'fm-head' }, el('h2', {}, 'Workbench'), closeButton()),
        steps,
        kinds,
        el('div', { class: 'fm-make' },
          el('div', { class: 'fm-big' }, icon(GEAR_ICONS[pick][benchState.tier - 1])),
          el('div', {}, el('h3', {}, name), el('h4', {}, 'Recipe'), needs),
          fitsBox),
        el('p', { class: 'fm-why', 'data-key': 'why' }, reason && make ? reason : ''),
        el('div', { class: 'fm-row' }, makeButton),
        el('p', { class: 'fm-owned' }, `In hand: ${GEAR_STEPS[bench.gear().tier - 1].weapons[bench.gear().weapon]}. You own: ${owned}. Armour: ${GEAR_STEPS[bench.gear().armor - 1].armor}.`),
      );
    };
    show('bench', stage, redraw);
  }

  // ---------------------------------------------------------------- the Road kit
  const kitState: { slot: 0 | 1 | 2; shown: KitId | null } = { slot: 0, shown: null };
  function kitPanel(): void {
    const bench = sys.bench;
    if (!bench) return;
    const screen = el('div', { class: 'fm-screen', role: 'dialog', 'aria-label': 'Road kit', 'data-panel': 'kit' });
    const redraw = (): void => {
      const gear = bench.gear();
      const count = (id: KitId): number => sys.inventory?.count(id) ?? 0;
      const slots = el('div', { class: 'fm-slots' });
      gear.kit.forEach((kit, i) => {
        const b = el('button', { class: `fm-card${kit ? '' : ' is-empty'}`, type: 'button', 'aria-pressed': String(i === kitState.slot), 'data-key': `slot-${i + 1}` },
          el('span', { class: 'fm-num' }, el('i', {}, String(i + 1))),
          kit ? icon(itemIcon(kit)) : null, el('span', { class: 'fm-name' }, kit ? KIT[kit].name : 'Empty'), kit ? el('span', { class: 'fm-count' }, `×${count(kit)}`) : null);
        b.addEventListener('click', () => { kitState.slot = i as 0 | 1 | 2; if (kit) kitState.shown = kit; redraw(); });
        slots.append(b);
      });
      const reserve = el('div', { class: 'fm-reserve' });
      for (const id of KIT_IDS) {
        const b = el('button', { class: `fm-card${count(id) ? '' : ' is-none'}`, type: 'button', 'aria-pressed': String(id === kitState.shown), 'data-key': id },
          icon(itemIcon(id)), el('span', { class: 'fm-name' }, KIT[id].name), count(id) ? el('span', { class: 'fm-count' }, `×${count(id)}`) : null);
        b.addEventListener('click', () => { kitState.shown = id; redraw(); });
        reserve.append(b);
      }
      const shown = kitState.shown ?? gear.kit.find((k) => k !== null) ?? KIT_IDS[0];
      const equip = el('button', { class: 'fm-btn is-gold', type: 'button', 'data-key': 'equip' }, gear.kit.includes(shown) ? 'Take out' : 'Equip');
      if (!gear.kit.includes(shown) && count(shown) <= 0) equip.setAttribute('disabled', '');
      equip.addEventListener('click', () => {
        const at = gear.kit.indexOf(shown);
        if (at >= 0) bench.equip(at as 0 | 1 | 2, null);
        else bench.equip(kitState.slot, shown);
        redraw();
      });
      const things = KIT[shown].needs.map(itemName).join(' and ');
      screen.replaceChildren(
        el('header', { class: 'fm-rail' }, el('h2', {}, 'Road kit'), tabs('kit'), closeButton()),
        el('div', { class: 'fm-kitbody' },
          el('div', { class: 'fm-kitbox' }, el('h3', {}, `Equipped (${gear.kit.filter(Boolean).length}/3)`), slots, el('h3', {}, `Reserve (${KIT_IDS.reduce((n, id) => n + count(id), 0)})`), reserve),
          el('aside', { class: 'fm-detail', 'data-key': 'detail' }, icon(itemIcon(shown)), el('h3', {}, KIT[shown].name),
            el('ul', {}, el('li', {}, `${things[0].toUpperCase()}${things.slice(1)}. Made at the workbench.`), el('li', {}, KIT[shown].does), el('li', {}, 'Used up when it works.')),
            equip)),
        el('footer', { class: 'fm-cues' }, el('span', {}, el('kbd', {}, '1-3'), 'Slot'), el('span', {}, el('kbd', {}, 'K'), 'Close'), el('span', {}, el('kbd', {}, 'Esc'), 'Close')),
      );
    };
    show('kit', screen, redraw);
  }

  function tabs(on: 'kit' | 'bench'): HTMLElement {
    const box = el('nav', { class: 'fm-tabs' });
    for (const [name, label] of [['kit', 'Road kit'], ['bench', 'Workbench']] as const) {
      const b = el('button', { type: 'button', 'aria-pressed': String(name === on) }, label);
      b.addEventListener('click', () => (name === 'kit' ? kitPanel() : benchPanel()));
      box.append(b);
    }
    return box;
  }

  // ---------------------------------------------------------------- the gold pill on the Make panel
  const pill = el('button', { class: 'fm-btn is-gold fm-pillbtn', type: 'button', 'data-key': 'open-bench' }, 'Workbench: gear and fittings');
  pill.style.display = 'none';
  pill.addEventListener('click', () => {
    book.ui.close();
    benchPanel();
  });
  view.root.append(pill);
  book.onPanel((panel) => { pill.style.display = panel === 'make' ? '' : 'none'; });

  // ---------------------------------------------------------------- what the rules ask to open
  game.events.on('ui.open', ({ panel, detail }) => {
    if (panel === 'farm' && detail) farmPanel(detail as FarmId);
    else if (panel === 'collector' && detail) chestPanel(detail);
    else if (panel === 'bench') benchPanel();
    else if (panel === 'kit') kitPanel();
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (open && (event.code === 'Escape' || (event.code === 'KeyK' && (open.name === 'kit' || open.name === 'bench')))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (open?.name === 'kit' && /^Digit[123]$/.test(event.code)) {
      kitState.slot = (Number(event.code.slice(5)) - 1) as 0 | 1 | 2;
      event.stopImmediatePropagation();
      open.redraw();
      return;
    }
    if (!open && event.code === 'KeyK' && view.started && !book.menuOpen && book.panel === null && !(sys.talk?.active ?? false)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      kitPanel();
    }
  }, { capture: true });

  // ---------------------------------------------------------------- the rate tags over the world
  interface Tag { leader: HTMLElement; root: HTMLElement; title: HTMLElement; sub: HTMLElement; sym: HTMLElement; symText: HTMLElement; dia: HTMLElement; words: string; place: (x: number, y: number, reach?: number) => boolean }
  const tags = new Map<FarmId, Tag>();
  const point = { x: 0, y: 0 };
  const feet = { x: 0, y: 0 }, head = { x: 0, y: 0 };
  const ordered: FarmView[] = [];
  function tagFor(farm: FarmView): Tag {
    let tag = tags.get(farm.id);
    if (!tag) {
      const title = el('b');
      const sub = el('i');
      const d = dia();
      const symText = el('span');
      const sym = el('div', { class: 'fm-pill fm-sym' }, d, symText);
      const root = el('div', { class: 'fm-tag', 'data-farm': farm.id }, el('div', { class: 'fm-pill' }, dia(), title, sub), sym);
      const leader = el('span', { class: 'fm-leader', 'aria-hidden': 'true' });
      root.append(leader);
      view.root.append(root);
      tag = { leader, root, title, sub, sym, symText, dia: d, words: '', place: worldLabelLayout(view.root).register(root) };
      tags.set(farm.id, tag);
    }
    return tag;
  }

  view.onFrame(() => {
    const farms = sys.farms?.all() ?? [];
    const me = view.playerPosition;
    const hidden = !view.started || open !== null || book.covered || book.menuOpen;
    const layout = worldLabelLayout(view.root);
    layout.protectHero(view.project(me.x, me.y, me.z, feet), view.project(me.x, me.y + 2, me.z, head));
    // Place the nearest farm first. Secondary pills keep identity and production;
    // symptoms and fixes remain in the ordinary E panel.
    ordered.length = 0;
    for (const farm of farms) ordered.push(farm);
    const active = sys.interact?.nearest()?.id;
    ordered.sort((a,b) => a.id === active?.slice(5) ? -1 : b.id === active?.slice(5) ? 1 : (a.at ? Math.hypot(a.at.x-me.x,a.at.z-me.z) : Infinity) - (b.at ? Math.hypot(b.at.x-me.x,b.at.z-me.z) : Infinity));
    for (const tag of tags.values()) tag.root.style.display = 'none';
    let shown = 0;
    for (const farm of ordered) {
      const at = farm.at;
      const near = !hidden && at !== null && farm.tag !== '' && Math.hypot(at.x - me.x, at.z - me.z) <= TAG_NEAR;
      const on = near && at ? view.project(at.x, at.y + view.lift(at.x, at.y, at.z), at.z, point) : null;
      const existing = tags.get(farm.id);
      if (!on) {
        if (existing) existing.root.style.display = 'none';
        continue;
      }
      const tag = tagFor(farm);
      tag.root.style.display = '';
      const words = `${farm.tag}|${farm.symptom}|${farm.living}`;
      if (tag.words !== words) {
        tag.words = words;
        tag.title.textContent = farmDef(farm.id).name;
        tag.sub.textContent = `· ${farm.tag}`;
        tag.symText.textContent = farm.symptom;
        tag.sym.style.display = farm.symptom ? '' : 'none';
        tag.dia.className = `fm-dia${farm.living && farm.rate >= farm.best ? ' is-done' : ''}`;
      }
      tag.sym.style.display = shown === 0 && farm.symptom ? '' : 'none';
      let placed = tag.place(on.x, on.y, 160);
      if (!placed && shown === 0) {
        tag.sym.style.display = 'none';
        placed = tag.place(on.x, on.y, 240);
      }
      if (placed) {
        shown++;
        const rect = tag.root.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, on.x - rect.x));
        const y = on.y >= rect.bottom ? rect.height : on.y <= rect.top ? 0 : on.y - rect.y;
        const dx = on.x - rect.x - x, dy = on.y - rect.y - y;
        tag.leader.style.left = `${x}px`; tag.leader.style.top = `${y}px`;
        tag.leader.style.width = `${Math.hypot(dx, dy)}px`;
        tag.leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
      else tag.root.style.display = 'none';
    }
  });
}
