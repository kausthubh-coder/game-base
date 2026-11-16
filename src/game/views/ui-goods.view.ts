// Goods and coin on screen, in the Gilded Hearth look (docs/ui-look.md):
//
//   - Coin: cream text and the coin icon at the right end of the quick slots, never a box.
//   - The granary's counter and the market green's stalls, on "E": the settlement's small paper panel with each good
//     the buyer takes, what it has taken today of its cap, Sell, and what coin buys there (the ring of land and the
//     queen's seed at the granary, furniture and a guide on the green). Market day's rush order is a row of its own.
//   - The queen's ledger, from the granary's panel: a full-screen night menu as the approved mockup draws it
//     (assets-src/concept/interface/ledger.webp). Down the left the four sections as navy cards, the picked one
//     ringed in gold; on the right the picked section on cream paper with what it needs, the reward and Deliver. Once
//     the four are filled, the standing orders take the same two columns.
//
// The rules are src/game/goods. This file only reads `sys.goods` and calls `sell`, `pick`, `deliver`, `fill`,
// `meetRush` and `buy`.
import type { GoodsApi, ItemId, LedgerView, OrderView, Systems } from '../api.sim.ts';
import {
  BUYERS, FURNITURE, LAND_RING, LEDGER, MARKET_EVERY, ORDERS, ROAD, SEED_SACK, ledgerDef, orderDef, pumpsStanding,
  type OrderId, type ShopId, type TownBuyer,
} from '../content/goods.ts';
import type { LedgerSection, VaultId } from '../content/ids.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { button, el, homePanel, rule } from '../uiview/home-panel.ts';
import { addStyle } from '../uiview/theme.ts';

const PAUSE = 'goods-ledger';
/** Seconds between two looks at the coin and the open panel. */
const LOOK_EVERY = 0.25;
const VAULTS: readonly { id: VaultId; name: string }[] = [
  { id: 'pumphouse', name: 'The Pump House' }, { id: 'lampgallery', name: 'The Lamp Gallery' }, { id: 'seedvault', name: 'The Seed Vault' },
];

const STYLE = /* css */ `
/* ---- coin, at the right end of the quick slots: cream text over the world ---- */
.ui-book .gd-coin { position: absolute; left: 100%; top: 50%; margin-left: 14px; transform: translateY(-50%); display: flex; align-items: center; gap: 6px;
  pointer-events: none; color: var(--ui-glass-ink); font: 700 22px/1 var(--ui-display); font-variant-numeric: tabular-nums; text-shadow: var(--ui-text-shadow); white-space: nowrap; }
.ui-book .gd-coin > .ui-cell { width: 32px; height: 32px; filter: drop-shadow(0 1px 2px rgb(10 12 20 / 0.7)); }
.ui-book .gd-coin.is-up { animation: gd-up 420ms var(--ui-ease); }
@keyframes gd-up { 40% { transform: translateY(calc(-50% - 4px)); color: var(--ui-gold-bright); } }
@media (max-width: 760px) { .ui-book .gd-coin { left: auto; right: 6px; top: auto; bottom: 100%; margin: 0 0 8px; transform: none; } .ui-book .gd-coin.is-up { animation: none; } }

/* ---- the buyers' panels: rows on the settlement's paper ---- */
.ui-book .gd-well { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px;
  background: radial-gradient(90% 90% at 30% 20%, #3a4258, #1f2433); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.6); }
.ui-book .gd-well > .ui-cell { width: 32px; height: 32px; }
.ui-book .gd-good { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 8px 6px 8px; border-radius: 16px; background: var(--ui-paper-2); }
.ui-book .gd-good-words { flex: 1; display: grid; gap: 2px; min-width: 0; }
.ui-book .gd-good-name { font-weight: 800; }
.ui-book .gd-good-sub { font-size: 0.86em; color: var(--ui-ink-2); }
.ui-book .gd-good .hp-btn { min-width: 0; padding: 0 16px; }
.ui-book .gd-good .hp-btn + .hp-btn { margin-left: -4px; }
.ui-book .gd-good.is-rush { background: #f6e8c4; box-shadow: inset 0 0 0 1.5px var(--ui-gold); }
.ui-book .gd-good.is-done { background: #dfe8cf; }
.ui-book .gd-meter { height: 5px; margin-top: 3px; border-radius: 3px; background: rgb(59 66 85 / 0.16); overflow: hidden; }
.ui-book .gd-meter > i { display: block; height: 100%; background: linear-gradient(90deg, var(--ui-bronze), var(--ui-gold-bright)); }
.ui-book .gd-day { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 12px; font-size: 0.82em; font-weight: 800; color: var(--ui-paper-light); background: #c9802a; }
.ui-book .gd-purse { margin: 12px 0 0; text-align: center; font: 700 1.1em var(--ui-display); }
.ui-book .gd-purse .ui-cell { display: inline-block; width: 24px; height: 24px; vertical-align: -5px; margin-right: 4px; }
.ui-book .gd-guides { display: flex; gap: 8px; flex-wrap: wrap; }
.ui-book .gd-guides .hp-btn { flex: 1; min-width: 0; padding: 0 12px; font-size: 0.9em; }

/* ---- the queen's ledger: a full-screen night menu ---- */
.ui-book .gd-ledger { position: absolute; inset: 0; z-index: 40; display: grid; pointer-events: auto; grid-template-rows: auto 1fr auto; color: var(--ui-paper-light);
  font-family: var(--ui-font); font-weight: 600; font-size: calc(15px * var(--ui-size));
  background: radial-gradient(120% 85% at 50% 0%, rgb(46 54 84 / 0.97), rgb(24 28 43 / 0.98) 55%, rgb(12 14 22 / 0.99)); animation: gd-in 200ms var(--ui-ease); }
.ui-book.ui-kit .gd-ledger { background: var(--kit-stars) 0 0 / 384px 384px repeat, radial-gradient(120% 85% at 50% 0%, rgb(46 54 84 / 0.97), rgb(24 28 43 / 0.98) 55%, rgb(12 14 22 / 0.99)); }
.ui-book .gd-ledger[hidden] { display: none; }
@keyframes gd-in { from { transform: translateY(12px); } }
.ui-book .gd-rail { position: relative; isolation: isolate; display: flex; align-items: center; gap: 14px; padding: 12px 28px 26px; }
.ui-book .gd-rail::before { content: ''; position: absolute; z-index: -1; inset: 0 0 auto; height: 72px; background: linear-gradient(180deg, rgb(10 12 20 / 0.7), rgb(20 24 38 / 0.55)); box-shadow: 0 1px 0 rgb(211 188 142 / 0.55); }
.ui-book.ui-kit .gd-rail::before { height: 60px; top: 8px; background: transparent; box-shadow: none; border: solid transparent; border-width: 0 100px; border-image: var(--kit-rail) 0 200 fill / 0 100px stretch; }
.ui-book.ui-kit .gd-rail { padding: 14px 92px 26px; }
.ui-book .gd-rail-icon { width: 42px; height: 42px; display: grid; place-items: center; }
.ui-book .gd-rail-icon > .ui-cell { width: 40px; height: 40px; filter: drop-shadow(0 0 4px rgb(240 212 138 / 0.5)); }
.ui-book .gd-rail h2 { flex: 1; margin: 0; font: 650 30px/1.1 var(--ui-display); text-shadow: 0 2px 8px rgb(0 0 0 / 0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-book .gd-x { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; cursor: pointer; color: var(--ui-ink); font: 700 20px/1 var(--ui-font);
  background: var(--ui-paper-light); box-shadow: inset 0 0 0 2px var(--ui-gold), 0 2px 6px rgb(0 0 0 / 0.4); }
.ui-book.ui-kit .gd-x { color: transparent; background: var(--kit-close) center / 100% 100% no-repeat; box-shadow: none; }
.ui-book .gd-x:hover { filter: brightness(1.08); transform: scale(1.06); }
.ui-book .gd-body { display: grid; grid-template-columns: minmax(300px, 520px) minmax(320px, 600px); justify-content: center; align-content: start; gap: clamp(24px, 6vw, 110px); padding: 10px 40px; min-height: 0; overflow: auto; scrollbar-color: rgb(211 188 142 / 0.35) transparent; }
.ui-book .gd-list { display: grid; gap: 10px; align-content: start; align-self: start; padding: 10px; border-radius: 18px; box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.55); background: rgb(14 17 27 / 0.35); }
.ui-book .gd-list-head { margin: 4px 8px 0; color: var(--ui-gold); font: 700 0.85em var(--ui-font); letter-spacing: 0.14em; text-transform: uppercase; }
.ui-book .gd-card { position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 16px; width: 100%; padding: 12px 18px 12px 12px; border: 0; border-radius: 16px; cursor: pointer; text-align: left; font: inherit; color: inherit;
  background: linear-gradient(180deg, #262c3f, #1d2232); box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.45), 0 3px 8px rgb(0 0 0 / 0.3); transition: transform 120ms var(--ui-ease), box-shadow 120ms var(--ui-ease); }
.ui-book .gd-card:hover, .ui-book .gd-card:focus-visible { outline: none; transform: translateY(-2px); box-shadow: inset 0 0 0 1.5px var(--ui-gold), 0 0 14px rgb(240 212 138 / 0.25), 0 6px 12px rgb(0 0 0 / 0.35); }
.ui-book .gd-card[aria-pressed='true'] { background: linear-gradient(180deg, #2d3448, #222839); box-shadow: inset 0 0 0 2.5px var(--ui-gold-bright), 0 0 22px rgb(240 212 138 / 0.4); }
.ui-book .gd-pic { grid-row: span 3; width: 84px; height: 84px; display: grid; place-items: center; border-radius: 12px; background: radial-gradient(80% 80% at 50% 35%, #6e7f6b, #2f3a35); box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.6); }
.ui-book .gd-pic > .ui-cell { width: 64px; height: 64px; }
.ui-book .gd-card-name { font: 700 1.45em/1.15 var(--ui-display); color: var(--ui-paper-light); }
.ui-book .gd-card-needs { grid-column: 2; color: var(--ui-glass-ink-2); font-size: 0.95em; }
.ui-book .gd-card-needs b { color: var(--ui-gold-bright); font-weight: 800; }
.ui-book .gd-chip { grid-column: 2; justify-self: start; display: inline-flex; align-items: center; gap: 8px; padding: 4px 14px; border-radius: 14px; font-size: 0.9em; color: var(--ui-paper-light); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.65); }
.ui-book .gd-chip.is-done { color: #e9f2dc; background: #5e8a4a; box-shadow: none; }
.ui-book .gd-dia { grid-column: 3; grid-row: 1; align-self: start; width: 13px; height: 13px; margin-top: 8px; transform: rotate(45deg); border: 1.5px solid var(--ui-gold); }
.ui-book .gd-card[aria-pressed='true'] .gd-dia { background: var(--ui-gold-bright); border-color: var(--ui-gold-bright); box-shadow: 0 0 8px rgb(240 212 138 / 0.8); }
.ui-book .gd-card.is-filled .gd-dia { background: #5e8a4a; border-color: #a8c48f; }

.ui-book .gd-page { position: relative; align-self: start; display: grid; gap: 12px; padding: 30px 34px 28px; border-radius: 18px; color: var(--ui-ink);
  background: radial-gradient(140% 100% at 20% 0%, var(--ui-paper-light), var(--ui-paper) 65%); box-shadow: inset 0 0 0 1.5px var(--ui-gold), inset 0 0 0 7px var(--ui-paper-light), inset 0 0 0 8px rgb(166 137 90 / 0.45), 0 16px 36px rgb(0 0 0 / 0.45); }
.ui-book .gd-page h3 { margin: 0; text-align: center; font: 700 calc(34px * var(--ui-size))/1.1 var(--ui-display); }
.ui-book .gd-page .hp-rule { margin: 0 auto 2px; }
.ui-book .gd-about { margin: 0; text-align: center; color: var(--ui-ink-2); }
.ui-book .gd-need { display: flex; align-items: center; gap: 16px; min-height: 64px; padding: 8px 22px 8px 14px; border-radius: 12px; color: var(--ui-paper-light);
  background: linear-gradient(180deg, #232a3c, #1a1f2e); box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.6), 0 2px 6px rgb(0 0 0 / 0.25); }
.ui-book .gd-need > .ui-cell { width: 44px; height: 44px; flex: none; }
.ui-book .gd-need-name { flex: 1; font: 700 1.3em var(--ui-display); }
.ui-book .gd-need-count { font: 700 1.3em var(--ui-display); font-variant-numeric: tabular-nums; }
.ui-book .gd-need.is-full { box-shadow: inset 0 0 0 2px #8fb377, 0 2px 6px rgb(0 0 0 / 0.25); }
.ui-book .gd-need.is-full .gd-need-count { color: #b9d9a1; }
.ui-book .gd-note { display: flex; gap: 10px; align-items: baseline; margin: 0 4px; }
.ui-book .gd-note::before { content: ''; flex: none; width: 9px; height: 9px; transform: rotate(45deg) translateY(-1px); background: #c9802a; }
.ui-book .gd-note small { color: var(--ui-ink-2); }
.ui-book .gd-reward { display: grid; justify-items: center; gap: 8px; }
.ui-book .gd-reward-tag { padding: 3px 18px; border-radius: 14px; font: 700 1em var(--ui-display); background: #e9d9ae; box-shadow: inset 0 0 0 1px var(--ui-bronze); }
.ui-book .gd-reward-line { display: flex; align-items: center; gap: 14px; font: 700 1.25em/1.3 var(--ui-display); text-align: left; }
.ui-book .gd-reward-line > .ui-cell { width: 56px; height: 56px; flex: none; }
.ui-book .gd-page .hp-btn.hp-primary { width: 100%; min-height: 58px; font: 700 1.6em var(--ui-display); }
.ui-book .gd-said { margin: 0; text-align: center; color: #4c7a38; font-weight: 800; }
.ui-book .gd-said:empty { display: none; }

.ui-book .gd-foot { display: flex; align-items: center; gap: 18px; min-height: 60px; padding: 10px 36px 14px; background: linear-gradient(0deg, rgb(10 12 20 / 0.65), rgb(10 12 20 / 0)); box-shadow: inset 0 1px 0 rgb(211 188 142 / 0.4); }
.ui-book .gd-foot-count { flex: 1; font: 700 1.35em var(--ui-display); }
.ui-book .gd-foot kbd { display: inline-grid; place-items: center; min-width: 44px; height: 30px; padding: 0 8px; margin-right: 8px; border-radius: 8px; font: 800 0.85em var(--ui-font); color: var(--ui-paper-light); background: #2b3245; box-shadow: inset 0 0 0 1.5px var(--ui-gold); }
.ui-book.ui-kit .gd-foot kbd { background: transparent; box-shadow: none; border: solid transparent; border-width: 0 10px; padding: 0 2px; border-image: var(--kit-keycap) 0 40 fill / 0 10px stretch; }
@media (prefers-reduced-motion: reduce) { .ui-book .gd-ledger { animation: none; } .ui-book .gd-card { transition: none; } }
@media (max-width: 860px) {
  .ui-book .gd-body { grid-template-columns: minmax(0, 1fr); padding: 6px 14px; gap: 16px; }
  .ui-book .gd-rail, .ui-book.ui-kit .gd-rail { padding: 10px 14px 22px; }
  .ui-book .gd-rail h2 { font-size: 24px; }
  .ui-book .gd-pic { width: 60px; height: 60px; }
  .ui-book .gd-pic > .ui-cell { width: 48px; height: 48px; }
  .ui-book .gd-page { padding: 22px 18px 20px; }
  .ui-book .gd-foot { padding: 8px 14px 12px; }
}
`;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function install(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const book = bookOf(view);
  const art = book.art;
  addStyle(view.root, 'goods', STYLE);
  const panel = homePanel(view, book);
  const goods = (): GoodsApi | undefined => sys.goods;

  const itemName = (id: ItemId): string => sys.items?.get(id)?.name ?? id;
  const icon = (name: string): HTMLElement => art.iconElement(name) ?? el('span', 'ui-cell');
  const itemIcon = (id: ItemId): HTMLElement => icon(sys.items?.get(id)?.icon ?? id);
  const coinIcon = (): HTMLElement => icon('coin');

  // ---------------------------------------------------------------- coin beside the quick slots
  const purse = el('div', 'gd-coin');
  purse.dataset.key = 'coin';
  const purseCount = el('span', 'gd-coin-count', '0');
  purse.append(coinIcon(), purseCount);
  let shownCoin = -1;

  // ---------------------------------------------------------------- a buyer's panel
  let openBuyer: TownBuyer | null = null;
  let note = '';

  function goodRow(buyer: TownBuyer, item: ItemId, price: number, taken: number, cap: number): HTMLElement {
    const api = goods();
    const have = sys.inventory?.count(item) ?? 0;
    const left = Math.max(0, cap - taken);
    const row = el('div', 'gd-good');
    row.dataset.key = `good:${item}`;
    const words = el('div', 'gd-good-words');
    words.append(el('span', 'gd-good-name', `${itemName(item)} · ${price} coin`), el('span', 'gd-good-sub', `Today ${taken} of ${cap} · you have ${have}`));
    const meter = el('div', 'gd-meter');
    const fill = el('i', '');
    fill.style.width = `${cap ? Math.min(100, (taken / cap) * 100) : 0}%`;
    meter.append(fill);
    words.append(meter);
    const well = el('span', 'gd-well');
    well.append(itemIcon(item));
    row.append(well, words);
    const sell = (n: number): void => {
      const sold = api?.sell(buyer, item, n) ?? 0;
      note = sold ? `Sold ${sold} ${itemName(item).toLowerCase()} for ${sold * price} coin.` : '';
      redraw();
    };
    const ten = button('Sell 10', false, () => sell(10));
    ten.dataset.key = `sell10:${item}`;
    const all = button('Sell all', false, () => sell(have));
    all.dataset.key = `sell:${item}`;
    if (!have || !left) { ten.disabled = true; all.disabled = true; }
    row.append(ten, all);
    return row;
  }

  function shopRow(id: ShopId, name: string, sub: string, label = 'Buy', vault?: VaultId): HTMLElement {
    const api = goods();
    const entry = api?.shop().find((s) => s.id === id);
    const row = el('div', 'gd-good');
    row.dataset.key = `shop:${id}`;
    const words = el('div', 'gd-good-words');
    words.append(el('span', 'gd-good-name', `${name} · ${entry?.coin ?? 0} coin`), el('span', 'gd-good-sub', entry?.why && !entry.why.startsWith('It costs') ? entry.why : sub));
    const well = el('span', 'gd-well');
    well.append(id === 'seeds' ? itemIcon(SEED_SACK.item) : coinIcon());
    const buy = button(label, false, () => {
      const why = api?.buy(id, vault);
      note = why ? `${why}.` : '';
      redraw();
    });
    buy.dataset.key = `buy:${id}`;
    if (entry?.why) buy.disabled = true;
    row.append(well, words, buy);
    return row;
  }

  function buyerPanel(buyer: TownBuyer, body: HTMLElement): void {
    const api = goods();
    if (!api) return;
    const view = api.buyer(buyer);
    const def = BUYERS[buyer];
    const title = el('h2', 'hp-title', def.name);
    const day = game.clock.day;
    const sub = el('p', 'hp-sub');
    if (def.marketDay) {
      if (view.marketDay) sub.append(el('span', 'gd-day', 'Market day: twice the usual'));
      else {
        const until = MARKET_EVERY - (day % MARKET_EVERY);
        sub.textContent = `Market day in ${plural(until, 'day', 'days')}.`;
      }
    } else {
      sub.textContent = 'The queen\'s granary. 20 more a day for every pump out of the town\'s fields.';
    }
    const rows = el('div', 'hp-rows');
    for (const g of view.goods) rows.append(goodRow(buyer, g.item, g.price, g.taken, g.cap));
    if (buyer === 'granary') {
      const pumped = api.pumpWheat();
      if (pumped > 0) rows.append(el('p', 'gd-note', `${pumped} of your wheat grew under the Order's pump. The granary takes it first; the queen's ledger will not.`));
    }
    body.append(title, rule(view.marketDay ? 3 : 1), sub, rows);

    // Market day's rush order.
    const rush = buyer === 'market' ? api.rush() : null;
    if (rush) {
      const have = sys.inventory?.count(rush.item) ?? 0;
      const row = el('div', `gd-good is-rush${rush.met ? ' is-done' : ''}`);
      row.dataset.key = 'rush';
      const well = el('span', 'gd-well');
      well.append(itemIcon(rush.item));
      const words = el('div', 'gd-good-words');
      const minutes = Math.ceil(rush.left / 60);
      words.append(
        el('span', 'gd-good-name', `Rush order: ${rush.count} ${itemName(rush.item).toLowerCase()} by nightfall`),
        el('span', 'gd-good-sub', rush.met ? 'Met. Sunroot seeds nobody else sells, and coin.' : rush.left > 0 ? `You have ${have}. ${plural(minutes, 'minute', 'minutes')} of light left.` : 'Night has come. It is gone.'),
      );
      const give = button('Deliver', true, () => {
        note = api.meetRush() ? '' : 'Not enough yet.';
        redraw();
      });
      give.dataset.key = 'rush:deliver';
      give.style.minWidth = '0';
      if (rush.met || rush.left <= 0 || have < rush.count) give.disabled = true;
      row.append(well, words, give);
      body.append(el('div', 'hp-sep'), row);
    }

    // What coin buys here.
    const buys = el('div', 'hp-rows');
    if (buyer === 'granary') {
      buys.append(shopRow('ring', 'A ring of land', `${LAND_RING.blocks} more blocks round your claim, from the queen.`));
      buys.append(shopRow('seeds', 'The queen\'s seed', `A sack of ${SEED_SACK.count} wheat seed.`));
    } else {
      const grade = api.furniture().grade;
      const next = FURNITURE[Math.min(grade, FURNITURE.length - 1)];
      buys.append(shopRow('furniture', `${next.name} furniture`, `${next.text} Each use gives ${next.hearts} hearts.`));
      const guides = el('div', 'gd-good');
      guides.dataset.key = 'shop:guide';
      const words = el('div', 'gd-good-words');
      const entry = api.shop().find((s) => s.id === 'guide');
      words.append(el('span', 'gd-good-name', `A guide to a vault's door · ${ROAD.guide.coin} coin`));
      const row = el('div', 'gd-guides');
      for (const v of VAULTS) {
        const cleared = game.flags.is(`vault.${v.id}.cleared`);
        const b = button(v.name, false, () => {
          const why = api.buy('guide', v.id);
          if (why) { note = `${why}.`; redraw(); } else panel.close();
        });
        b.dataset.key = `guide:${v.id}`;
        if (entry?.why || cleared) b.disabled = true;
        row.append(b);
      }
      words.append(row, el('span', 'gd-good-sub', entry?.why && !entry.why.startsWith('It costs') ? entry.why : 'They walk you to the door and leave.'));
      guides.append(words);
      buys.append(guides);
    }
    body.append(el('div', 'hp-sep'), el('div', 'hp-heading', buyer === 'granary' ? 'From the queen' : 'From the stalls'), buys);
    if (note) body.append(el('p', 'hp-foot', note));
    const purseLine = el('p', 'gd-purse');
    purseLine.append(coinIcon(), `${api.coin()} coin`);
    body.append(purseLine);
    if (buyer === 'granary') {
      const ledger = button('The queen\'s ledger', true, () => { panel.close(); openLedger(); });
      ledger.dataset.key = 'open-ledger';
      if (!ledgerShown()) { ledger.disabled = true; ledger.title = 'The queen has not shown it to you yet'; }
      const actions = el('div', 'hp-actions');
      actions.append(ledger);
      body.append(actions);
    }
  }

  function showBuyer(buyer: TownBuyer): void {
    openBuyer = buyer;
    note = '';
    panel.open((body) => buyerPanel(buyer, body), true);
    game.events.emit('ui.sound', { sound: 'open' });
  }

  function redraw(): void {
    if (openBuyer && panel.isOpen) {
      const scroll = panel.body.parentElement?.scrollTop ?? 0;
      panel.body.replaceChildren();
      buyerPanel(openBuyer, panel.body);
      if (panel.body.parentElement) panel.body.parentElement.scrollTop = scroll;
    }
    if (ledgerOpen) drawLedger();
  }

  // ---------------------------------------------------------------- the queen's ledger
  const ledgerShown = (): boolean => game.flags.is('scene.22') || game.flags.is('quest.count.done') || LEDGER.some((s) => game.flags.is(`ledger.${s.section}.filled`));
  const layer = el('section', 'gd-ledger');
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', 'The queen\'s ledger');
  layer.dataset.panel = 'ledger';
  view.root.append(layer);
  let ledgerOpen = false;
  /** The section or order the right page shows. */
  let shown: { kind: 'section'; id: LedgerSection } | { kind: 'order'; id: OrderId } = { kind: 'section', id: 'granary' };
  let said = '';

  function openLedger(): void {
    const api = goods();
    if (!api) return;
    ledgerOpen = true;
    said = '';
    const all = api.ledger().every((s) => s.filled);
    const picked = api.picked();
    shown = all ? { kind: 'order', id: ORDERS[0].id } : { kind: 'section', id: picked && !api.ledger().find((s) => s.section === picked)?.filled ? picked : api.ledger().find((s) => !s.filled)!.section };
    layer.hidden = false;
    view.setPaused(PAUSE, true);
    game.player.busy = true;
    document.exitPointerLock?.();
    drawLedger();
    game.events.emit('ui.sound', { sound: 'open' });
  }

  function closeLedger(): void {
    if (!ledgerOpen) return;
    ledgerOpen = false;
    layer.hidden = true;
    layer.replaceChildren();
    view.setPaused(PAUSE, false);
    game.player.busy = false;
    book.settle();
    game.events.emit('ui.sound', { sound: 'close' });
  }

  window.addEventListener('keydown', (event) => {
    if (!ledgerOpen || event.code !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeLedger();
  }, { capture: true });

  const needsText = (needs: LedgerView['needs'], started: boolean): HTMLElement => {
    const line = el('span', 'gd-card-needs');
    needs.forEach((need, i) => {
      if (i) line.append(started ? '  •  ' : '  +  ');
      if (started) line.append(el('b', '', `${need.have} / ${need.count}`), ` ${itemName(need.item)}`);
      else line.append(`${need.count} ${itemName(need.item)}`);
    });
    return line;
  };

  function sectionCard(view_: LedgerView, filled: number): HTMLElement {
    const def = ledgerDef(view_.section);
    const card = el('button', `gd-card${view_.filled ? ' is-filled' : ''}`);
    card.type = 'button';
    card.dataset.key = `section:${view_.section}`;
    card.setAttribute('aria-pressed', String(shown.kind === 'section' && shown.id === view_.section));
    const pic = el('span', 'gd-pic');
    pic.append(icon(def.icon));
    const started = view_.needs.some((n) => n.have > 0);
    const frees = pumpsStanding(filled) - pumpsStanding(filled + 1);
    const chip = el('span', `gd-chip${view_.filled ? ' is-done' : ''}`, view_.filled ? 'Stocked' : frees === 1 ? 'Frees a pump' : `Frees ${frees} pumps`);
    card.append(pic, el('span', 'gd-card-name', def.name), el('i', 'gd-dia'), needsText(view_.needs, started && !view_.filled), chip);
    card.addEventListener('click', () => {
      shown = { kind: 'section', id: view_.section };
      said = '';
      if (!view_.filled) goods()?.pick(view_.section);
      drawLedger();
    });
    return card;
  }

  function orderCard(order: OrderView): HTMLElement {
    const def = orderDef(order.id);
    const card = el('button', 'gd-card');
    card.type = 'button';
    card.dataset.key = `order:${order.id}`;
    card.setAttribute('aria-pressed', String(shown.kind === 'order' && shown.id === order.id));
    const pic = el('span', 'gd-pic');
    pic.append(itemIcon(def.needs[0].item));
    const chip = el('span', `gd-chip${def.kind === 'pack' && order.ready ? ' is-done' : ''}`,
      def.kind === 'pack' ? (order.ready ? 'Packed' : 'To pack') : order.times ? `Delivered ${plural(order.times, 'time', 'times')}` : 'Standing order');
    card.append(pic, el('span', 'gd-card-name', def.name), el('i', 'gd-dia'), el('span', 'gd-card-needs', def.needs.map((n) => `${n.count} ${itemName(n.item)}`).join('  +  ') + (def.kit ? '  +  a full kit' : '')), chip);
    card.addEventListener('click', () => {
      shown = { kind: 'order', id: order.id };
      said = '';
      drawLedger();
    });
    return card;
  }

  function needRow(item: ItemId, have: number, count: number): HTMLElement {
    const row = el('div', `gd-need${have >= count ? ' is-full' : ''}`);
    row.append(itemIcon(item), el('span', 'gd-need-name', itemName(item)), el('span', 'gd-need-count', `${Math.min(have, count)} / ${count}`));
    return row;
  }

  function sectionPage(api: GoodsApi, section: LedgerView): HTMLElement {
    const def = ledgerDef(section.section);
    const page = el('div', 'gd-page');
    page.dataset.key = `page:${section.section}`;
    page.append(el('h3', '', def.name), rule(1), el('p', 'gd-about', def.about));
    for (const need of section.needs) page.append(needRow(need.item, need.have, need.count));
    if (def.needs.some((n) => n.item === 'wheat')) {
      const line = el('p', 'gd-note', 'Wheat from living fields only.');
      const pumped = api.pumpWheat();
      if (pumped > 0) line.append(el('small', '', ` ${pumped} pump wheat in your bag stays out.`));
      page.append(line);
    }
    page.append(el('div', 'hp-sep'));
    const reward = el('div', 'gd-reward');
    const line = el('div', 'gd-reward-line');
    line.append(icon(def.icon), def.gives);
    reward.append(el('span', 'gd-reward-tag', 'Reward'), line);
    page.append(reward);
    const deliverable = section.needs.some((n) => n.have < n.count && (n.item === 'wheat' ? (sys.inventory?.count('wheat') ?? 0) - api.pumpWheat() : sys.inventory?.count(n.item) ?? 0) > 0);
    const deliver = button(section.filled ? 'Stocked' : 'Deliver', true, () => {
      const before = api.ledger().find((s) => s.section === section.section)!.needs.map((n) => n.have);
      const put = api.deliver(section.section);
      const after = api.ledger().find((s) => s.section === section.section)!;
      said = put ? `Delivered ${after.needs.map((n, i) => (n.have - before[i] ? `${n.have - before[i]} ${itemName(n.item).toLowerCase()}` : '')).filter(Boolean).join(' and ')}.` : '';
      if (after.filled) said = `${def.name} is stocked.`;
      drawLedger();
    });
    deliver.dataset.key = 'deliver';
    if (section.filled || !deliverable) deliver.disabled = true;
    page.append(deliver, el('p', 'gd-said', said));
    return page;
  }

  function orderPage(api: GoodsApi, order: OrderView): HTMLElement {
    const def = orderDef(order.id);
    const page = el('div', 'gd-page');
    page.dataset.key = `page:${order.id}`;
    page.append(el('h3', '', def.name), rule(1), el('p', 'gd-about', def.gives));
    for (const need of order.needs) page.append(needRow(need.item, need.have, need.count));
    if (order.kit >= 0) {
      const row = el('div', `gd-need${order.kit >= 3 ? ' is-full' : ''}`);
      row.append(icon('quill-strip'), el('span', 'gd-need-name', 'A full kit'), el('span', 'gd-need-count', `${order.kit} / 3`));
      page.append(row);
    }
    page.append(el('div', 'hp-sep'));
    if (def.kind === 'deliver') {
      const reward = el('div', 'gd-reward');
      const line = el('div', 'gd-reward-line');
      line.append(coinIcon(), `${def.coin} coin each time${order.times ? `. Delivered ${plural(order.times, 'time', 'times')} of ${def.most}.` : '.'}`);
      reward.append(el('span', 'gd-reward-tag', 'Reward'), line);
      page.append(reward);
      const fill = button('Deliver', true, () => {
        said = api.fill(order.id) ? `Delivered. ${def.coin} coin.` : '';
        drawLedger();
      });
      fill.dataset.key = 'deliver';
      if (!order.ready) fill.disabled = true;
      page.append(fill, el('p', 'gd-said', said));
    } else {
      page.append(el('p', 'gd-note', order.ready ? 'All of it is in your pack.' : 'Carry it all at once. The queen takes none of it: it is what you will need.'));
    }
    return page;
  }

  function drawLedger(): void {
    const api = goods();
    if (!api) return;
    const sections = api.ledger();
    const filled = sections.filter((s) => s.filled).length;
    const all = filled === sections.length;
    const rail = el('header', 'gd-rail');
    const railIcon = el('span', 'gd-rail-icon');
    railIcon.append(icon('queens-charter'));
    const x = el('button', 'gd-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeLedger);
    rail.append(railIcon, el('h2', '', 'Queen\'s ledger'), x);

    const list = el('div', 'gd-list');
    if (all) {
      list.append(el('p', 'gd-list-head', 'Standing orders'));
      for (const order of api.orders()) list.append(orderCard(order));
      list.append(el('p', 'gd-list-head', 'Stocked'));
    }
    for (const section of sections) list.append(sectionCard(section, filled));
    let page: HTMLElement;
    if (shown.kind === 'order') {
      const id = shown.id;
      page = orderPage(api, api.orders().find((o) => o.id === id)!);
    } else {
      const id = shown.id;
      page = sectionPage(api, sections.find((s) => s.section === id)!);
    }
    const body = el('div', 'gd-body');
    body.append(list, page);
    const foot = el('footer', 'gd-foot');
    foot.append(el('span', 'gd-foot-count', all ? 'Every section filled. The gold road is dark.' : `${filled} / ${sections.length} sections filled.`));
    const cue = el('span', 'gd-cue');
    cue.append(el('kbd', '', 'Esc'), 'Close');
    foot.append(cue);
    const scroll = layer.querySelector('.gd-body')?.scrollTop ?? 0;
    layer.replaceChildren(rail, body, foot);
    body.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- hearing the game
  game.events.on('ui.open', ({ panel: name, detail }) => {
    if (name === 'goods' && (detail === 'granary' || detail === 'market')) showBuyer(detail);
    else if (name === 'ledger') openLedger();
  });

  let lookIn = 0;
  let signed = '';
  view.onFrame((dt) => {
    // The coin rides at the end of the quick slots; the HUD makes them on its first frame.
    if (!purse.isConnected) view.root.querySelector('.gb-hud-slots')?.append(purse);
    const coin = goods()?.coin() ?? 0;
    if (coin !== shownCoin) {
      if (shownCoin >= 0 && coin > shownCoin) {
        purse.classList.remove('is-up');
        void purse.offsetWidth;
        purse.classList.add('is-up');
      }
      shownCoin = coin;
      purseCount.textContent = String(coin);
    }
    purse.hidden = coin <= 0 && !(game.flags.is('quest.count.started') || game.flags.is('quest.count.done'));
    if (!panel.isOpen) openBuyer = null;
    if (ledgerOpen) {
      game.player.busy = true;
      if (book.panel !== null || (book.map?.isOpen ?? false)) closeLedger();
    }
    lookIn -= dt;
    if (lookIn > 0) return;
    lookIn = LOOK_EVERY;
    // The bag, the coin and the rush order's minutes change under an open panel: draw it again when they do.
    if (openBuyer && panel.isOpen) {
      const api = goods();
      const rush = api?.rush();
      const sign = `${api?.coin()}|${BUYERS[openBuyer].takes.map((i) => sys.inventory?.count(i)).join()}|${rush ? `${rush.met}${Math.ceil(rush.left / 60)}${sys.inventory?.count(rush.item)}` : ''}`;
      if (sign !== signed) { signed = sign; redraw(); }
    }
  });
}
