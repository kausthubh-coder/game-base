// Build mode: one press, drag and release works a whole field. The hoe tills a rectangle, seeds plant one,
// the can wets one, blocks and fences go down in a line, and a chest or a sprinkler follows the pointer and
// lands where the button comes up. A press on a placed thing takes it back into the hand, so moving it is
// two clicks. The last stroke can be taken back.
//
// A stroke is a small state machine, and docs/verify/build-stroke holds a model of it that a checker walks
// through every order of events. Keep the two in step: see .agents/skills/verify-build-stroke.
//
//   idle --press--> dragging --release--> idle   the cells are judged again and the `ok` ones are applied
//                   dragging --cancel---> idle   nothing changes
//
// A stroke is cancelled when build mode goes off, when a panel or a conversation takes the player, and
// when the held item is no longer the one it was pressed with. The release checks all three itself, because
// a release can come before the step that would have cancelled.
import { AIR, blockId } from '../../content/blocks.ts';
import { SOLID } from '../../features/world/chunk.sim.ts';
import { BAG_FULL_TOAST, carriesAnother } from '../actions/index.sim.ts';
import type { BuildApi, BuildChange, BuildPlan, BuildPoint, BuildTool, ItemId, PlanCell, Placed, StrokeKind, Systems } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { NO_TOOL, cornerOf, judge, snapTurns, strokeCells, toolOf } from './plan.sim.ts';

const TILLED = blockId('tilled_soil');
/** A pointer on the side of a block means the open cell in front of it. The ground of that cell is looked for this far down. */
const DROP = 3;
/** Quick slots: a thing taken back into the bag is put in the hand, which is one of these. */
const QUICK_SLOTS = 9;

/** One cell the last stroke changed, with what is needed to put it back. */
interface Entry extends BuildChange {
  /** The block that was there before, for a tilled cell. */
  was: number;
  /** The block that was set, for `block`. */
  block: number;
  /** The id of the placed thing, for `place`. */
  placed: string;
  /** The item that was taken from the bag, or null. */
  item: ItemId | null;
}

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const { world, events, player } = game;
  // Another system may be missing in a small test, so the ones this file can do without are read as optional.
  const sys = game.systems as Partial<Systems>;

  let active = false;
  /** The ground block under the pointer. `on` is false when the pointer is on nothing. */
  const pointer = { on: false, x: 0, y: 0, z: 0, placed: null as Placed | null };
  /** The stroke in progress: where it was pressed, the height it works at, where its far end is, and the item it was pressed with. */
  const stroke = { on: false, x0: 0, z0: 0, y: 0, x1: 0, z1: 0, item: null as ItemId | null };
  /** The quarter turns the player chose with `turn`, or -1 to let the piece turn by itself. It lasts while the same item is held. */
  let chosenTurns = -1, turnsItem: ItemId | null = null;
  let applying = false;

  const tools = new Map<string, BuildTool>();
  const pool: PlanCell[] = [];
  const cells: PlanCell[] = [];
  const plan = { tool: NO_TOOL, y: 0, dragging: false, cells, ok: 0, short: 0, skip: 0, refused: 0, have: 0, turns: 0, ax: 0, az: 0, lift: null as Placed | null };
  const corner = { x: 0, z: 0 };

  /** What the last stroke changed, for `undo`, and the same cells for a view, which stay after the undo. */
  const journal: Entry[] = [];
  const changes: BuildChange[] = [];

  const heldId = (): ItemId | null => sys.inventory?.held()?.id ?? null;
  const tool = (): BuildTool => toolOf(game, sys.inventory?.held() ?? null, tools);

  /** Fills `plan` for the stroke in progress, or for a press and release on the pointed cell. False when there is nothing to plan. */
  function compute(): boolean {
    if (!active || (!stroke.on && !pointer.on)) return false;
    const t = tool();
    if (turnsItem !== t.item) { turnsItem = t.item; chosenTurns = -1; }
    const y = stroke.on ? stroke.y : pointer.y;
    const x1 = stroke.on ? stroke.x1 : pointer.x, z1 = stroke.on ? stroke.z1 : pointer.z;
    plan.tool = t;
    plan.y = y;
    plan.dragging = stroke.on;
    plan.lift = stroke.on ? null : pointer.placed;
    plan.ok = plan.short = plan.skip = plan.refused = 0;
    plan.have = t.costs && t.item ? sys.inventory?.count(t.item) ?? 0 : 0;
    plan.turns = 0;
    plan.ax = x1;
    plan.az = z1;
    if (t.kind === 'none') {
      cells.length = 0;
      return true;
    }
    if (t.kind === 'place' && t.placeable && t.shape === 'one') {
      plan.turns = chosenTurns >= 0 ? chosenTurns : snapTurns(game, t.placeable, x1, y, z1);
      cornerOf(t.placeable, plan.turns, x1, z1, corner);
      plan.ax = corner.x;
      plan.az = corner.z;
    }
    const count = strokeCells(t.shape, stroke.on ? stroke.x0 : x1, stroke.on ? stroke.z0 : z1, x1, z1, cells, pool);
    let left = plan.have;
    for (let i = 0; i < count; i++) {
      const cell = cells[i];
      let verdict = judge(game, t, cell.x, y, cell.z, plan.turns);
      if (verdict === 'ok' && t.costs && left-- <= 0) verdict = 'short';
      cell.verdict = verdict;
      if (verdict === 'ok') plan.ok++;
      else if (verdict === 'short') plan.short++;
      else if (verdict === 'skip') plan.skip++;
      else plan.refused++;
    }
    return true;
  }

  /** Changes one cell the plan called `ok`. Returns false, and takes nothing from the bag, when the world would not have it. */
  function apply(t: BuildTool, x: number, y: number, z: number, turns: number): boolean {
    const bag = sys.inventory, crops = sys.crops;
    if (t.costs && (!bag || !t.item || bag.count(t.item) < 1)) return false;
    let entry: Entry | null = null;
    if (t.kind === 'till') {
      const was = world.getBlock(x, y, z);
      if (crops?.till(x, y, z)) entry = { kind: 'till', x, y, z, was, block: AIR, placed: '', item: null };
    } else if (t.kind === 'plant') {
      if (t.item && crops?.plant(x, y, z, t.item)) entry = { kind: 'plant', x, y, z, was: AIR, block: AIR, placed: '', item: t.item };
    } else if (t.kind === 'water') {
      if (crops?.wet?.(x, y, z)) entry = { kind: 'water', x, y, z, was: AIR, block: AIR, placed: '', item: null };
    } else if (t.kind === 'block') {
      if (world.setBlock(x, y + 1, z, t.block)) {
        events.emit('block.placed', { x, y: y + 1, z, id: t.block, by: 'player' });
        entry = { kind: 'block', x, y: y + 1, z, was: AIR, block: t.block, placed: '', item: t.item };
      }
    } else if (t.kind === 'place' && t.placeable) {
      cornerOf(t.placeable, turns, x, z, corner);
      const placed = sys.placeables?.place(t.placeable.kind, corner.x, y + 1, corner.z, turns);
      if (placed) entry = { kind: 'place', x: placed.x, y: placed.y, z: placed.z, was: AIR, block: AIR, placed: placed.id, item: t.item };
    }
    if (!entry) return false;
    if (t.costs && t.item) bag?.remove(t.item, 1);
    journal.push(entry);
    changes.push(entry);
    return true;
  }

  /** Judges the stroke against the world as it is now and applies every `ok` cell. Returns how many changed. */
  function commit(): number {
    if (!compute()) return 0;
    const t = plan.tool, y = plan.y, turns = plan.turns;
    journal.length = 0;
    changes.length = 0;
    applying = true;
    let watered: PlanCell | null = null;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.verdict !== 'ok' || !apply(t, cell.x, y, cell.z, turns)) continue;
      // One use of the can sends one event, on a crop when the stroke wet one, as the can does outside build mode.
      if (t.kind === 'water' && (!watered || (!sys.crops?.at(watered.x, y, watered.z) && sys.crops?.at(cell.x, y, cell.z)))) watered = cell;
    }
    applying = false;
    if (watered) events.emit('crop.watered', { x: watered.x, y, z: watered.z });
    if (changes.length > 0) events.emit('build.applied', { kind: t.kind, count: changes.length, undone: false });
    return changes.length;
  }

  /** Puts one cell of the last stroke back, when it is still as the stroke left it and its item fits in the bag. */
  function revert(e: Entry): boolean {
    const bag = sys.inventory, crops = sys.crops;
    if (e.kind === 'till') {
      if (world.getBlock(e.x, e.y, e.z) !== TILLED || crops?.at(e.x, e.y, e.z) || world.getBlock(e.x, e.y + 1, e.z) !== AIR) return false;
      world.setBlock(e.x, e.y, e.z, e.was);
      events.emit('block.placed', { x: e.x, y: e.y, z: e.z, id: e.was, by: 'world' });
      return true;
    }
    if (e.kind === 'plant') {
      // A crop that has grown since is the player's now. `pull` gives the seed back, and refuses when it does not fit.
      const state = crops?.at(e.x, e.y, e.z);
      return state !== null && state !== undefined && state.stage === 0 && crops?.pull?.(e.x, e.y, e.z) === true;
    }
    if (e.kind === 'block') {
      if (world.getBlock(e.x, e.y, e.z) !== e.block || !e.item || !bag || bag.add(e.item, 1) > 0) return false;
      world.setBlock(e.x, e.y, e.z, AIR);
      events.emit('block.broken', { x: e.x, y: e.y, z: e.z, id: e.block, by: 'world' });
      return true;
    }
    if (e.kind === 'place') {
      const placed = sys.placeables?.all().find((p) => p.id === e.placed);
      if (!placed || !sys.placeables || carriesAnother(sys.placeables, placed)) return false;
      if (!e.item || !bag || bag.add(e.item, 1) > 0) return false;
      sys.placeables?.remove(placed.id);
      return true;
    }
    return false;
  }

  /** Takes a placed thing back into the bag and into the hand. False, with a toast, when the bag is full. */
  function lift(placed: Placed): boolean {
    const bag = sys.inventory;
    const item = game.systems.items.all().find((def) => def.placeable === placed.kind);
    if (!bag || !item) return false;
    // A placed thing with another standing on it stays, so nothing is left in the air.
    if (sys.placeables && carriesAnother(sys.placeables, placed)) return false;
    if (bag.add(item.id, 1, { x: placed.x + 0.5, y: placed.y + 0.5, z: placed.z + 0.5 }) > 0) {
      events.emit('toast', { text: BAG_FULL_TOAST });
      return false;
    }
    sys.placeables?.remove(placed.id);
    // Into the hand: its quick slot when it has one, or it changes places with what is held.
    const at = bag.slots.findIndex((slot) => slot?.id === item.id);
    if (at >= 0 && at < QUICK_SLOTS) bag.selected = at;
    else if (at >= 0) bag.move(at, bag.selected);
    pointer.placed = null;
    return true;
  }

  const api: BuildApi = {
    get active() { return active; },
    setActive(on) {
      const next = on && !player.busy;
      if (next === active) return;
      active = next;
      stroke.on = false;
      pointer.on = false;
      chosenTurns = -1;
      events.emit('build.mode', { active });
    },

    point(at: BuildPoint | null) {
      if (!at) {
        pointer.on = false;
        pointer.placed = null;
        return;
      }
      const placed = sys.placeables?.at(at.x, at.y, at.z) ?? null;
      let x = at.x, y = at.y, z = at.z;
      if (placed) {
        y = placed.y - 1;
      } else if (at.ny < 0) {
        // The underside of a block is nowhere to build.
        pointer.on = false;
        pointer.placed = null;
        return;
      } else if (at.ny === 0) {
        x += at.nx;
        z += at.nz;
        y -= 1;
        for (let i = 0; i < DROP && !SOLID[world.getBlock(x, y, z)]; i++) y--;
      }
      pointer.on = true;
      pointer.x = x;
      pointer.y = y;
      pointer.z = z;
      pointer.placed = placed;
      if (stroke.on) {
        stroke.x1 = x;
        stroke.z1 = z;
      }
    },

    press() {
      if (!active || player.busy || stroke.on || !pointer.on) return false;
      if (pointer.placed) return lift(pointer.placed);
      const t = tool();
      if (t.kind === 'none') return false;
      stroke.on = true;
      stroke.x0 = stroke.x1 = pointer.x;
      stroke.z0 = stroke.z1 = pointer.z;
      stroke.y = pointer.y;
      stroke.item = t.item;
      return true;
    },

    release() {
      if (!stroke.on) return -1;
      // The step that cancels may not have run yet, so the release asks the same three questions.
      const fits = active && !player.busy && heldId() === stroke.item;
      const changed = fits ? commit() : 0;
      stroke.on = false;
      return changed;
    },

    cancel() {
      const was = stroke.on;
      stroke.on = false;
      return was;
    },

    get dragging() { return stroke.on; },
    plan: () => (compute() ? (plan as BuildPlan) : null),

    turn(direction) {
      if (!active || !compute() || plan.tool.kind !== 'place' || plan.tool.shape !== 'one') return;
      chosenTurns = (plan.turns + direction) & 3;
    },

    undo() {
      if (!active || player.busy || stroke.on || journal.length === 0) return false;
      const kind: StrokeKind = journal[0].kind;
      changes.length = 0;
      applying = true;
      for (let i = journal.length - 1; i >= 0; i--) if (revert(journal[i])) changes.push(journal[i]);
      applying = false;
      journal.length = 0;
      if (changes.length > 0) events.emit('build.applied', { kind, count: changes.length, undone: true });
      return changes.length > 0;
    },
    get canUndo() { return journal.length > 0; },
    last: () => changes,
    get applying() { return applying; },
  };

  // Nothing to save: build mode, a stroke in progress and the last stroke do not outlive a load.
  kernel.add('build', api, {
    step() {
      if (active && player.busy) api.setActive(false);
      if (stroke.on && (!active || heldId() !== stroke.item)) stroke.on = false;
    },
  });
}

