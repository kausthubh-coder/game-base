// Conversations. The words are data in content/dialogue.ts and this file is the small interpreter that
// walks them: it picks the conversation for a person, shows one line at a time, branches on a choice,
// and runs the effects when the conversation ends.
//
// Effects wait for the end so a conversation is all or nothing. A save taken in the middle of one holds
// none of its gifts, and a load starts it again from the first line.
//
// A conversation that plays a scene of chapter 22 sets `scene.<n>` as it ends and sends `scene.played`. Its
// lines carry the scene's kind (content/scenes.ts), so the box knows whether to frame the people or play it as a
// film. What was said is kept in a short log for the box to show.

import type { Game, NpcId, SimSystem, TalkApi, TalkLine, TalkLogEntry } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import {
  CONVERSATIONS, SCENE, SPEAKERS, VILLAGER_LINES, type Choice, type Conversation, type Line,
} from '../content/dialogue.ts';
import { FLAG } from '../content/flags.ts';
import { JOB_BARKS } from '../content/people.ts';
import type { Effect } from '../content/quests.ts';
import { sceneOf, type SceneKind } from '../content/scenes.ts';
import { apply, holds } from '../quests/rules.sim.ts';

export interface Talk {
  api: TalkApi;
  system: SimSystem;
}

interface Frame {
  lines: readonly (string | Line)[];
  index: number;
}

const NARRATOR = 'narrator';
/** Lines the log keeps. */
const LOG_SIZE = 80;

/** A small steady number from a name, so each villager keeps a line of their own. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return h;
}

/** The scene a conversation plays, by its own `scene` or by its id (`scene.21.before` is part of scene 21). */
export function sceneNumber(conversation: Conversation): number {
  if (conversation.scene) return conversation.scene;
  // The repeat is a glimpse of the same past, with the same cast and hidden present-day hero.
  if (conversation.id === 'memory.pumphouse.again') return 26;
  const match = /^scene\.(\d+)\b/.exec(conversation.id);
  return match ? Number(match[1]) : 0;
}

/** How a conversation is shown: its own kind, else its scene's, else talk. */
export function kindOf(conversation: Conversation): SceneKind {
  return conversation.kind ?? sceneOf(sceneNumber(conversation))?.kind ?? 'talk';
}

export function createTalk(game: Game, conversations: readonly Conversation[] = CONVERSATIONS): Talk {
  const { clock, events, flags, player } = game;
  const byId = new Map(conversations.map((c) => [c.id, c]));
  const byNpc = new Map<NpcId, Conversation[]>();
  for (const c of conversations) {
    const list = byNpc.get(c.npc) ?? [];
    list.push(c);
    byNpc.set(c.npc, list);
  }

  let open: Conversation | null = null;
  /** Who the player is talking to, or '' for a conversation with nobody in the world. */
  let partner: NpcId | '' = '';
  let stack: Frame[] = [];
  /** Effects of the lines shown and the choices taken, in order, run when the conversation ends. */
  let pending: Effect[] = [];
  let line: TalkLine | null = null;
  /** The choices on screen, which are the ones whose condition holds. */
  let offered: Choice[] = [];
  let kind: SceneKind = 'talk';
  let scene = 0;
  const log: TalkLogEntry[] = [];

  /** A background villager's line for today: one that fits the moment if any does, else an everyday one. */
  function villagerLine(npc: NpcId): Conversation {
    const fitting = VILLAGER_LINES.filter((v) => v.when && holds(game, v.when));
    const pool = fitting.length ? fitting : VILLAGER_LINES.filter((v) => !v.when);
    const job = JOB_BARKS[game.systems.people?.get(npc)?.sprite ?? ''];
    const pick = !fitting.length && job
      ? { id: 'job.' + npc, text: job }
      : pool[(hash(npc) + clock.day) % pool.length];
    return { id: pick.id, npc, lines: [pick.text] };
  }

  function pick(npc: NpcId): Conversation {
    const list = byNpc.get(npc);
    if (!list) return villagerLine(npc);
    return list.find((c) => !(c.once && flags.is(`said.${c.id}`)) && holds(game, c.when)) ?? villagerLine(npc);
  }

  function begin(conversation: Conversation, npc: NpcId | ''): void {
    // A pool says one of its lines: the same one all day, a different one the next.
    const said = conversation.pool && conversation.lines.length > 1
      ? { ...conversation, lines: [conversation.lines[(hash(conversation.id) + clock.day) % conversation.lines.length]] }
      : conversation;
    open = said;
    partner = npc;
    kind = kindOf(said);
    scene = sceneNumber(said);
    stack = [{ lines: said.lines, index: -1 }];
    pending = [];
    player.busy = true;
    events.emit('talk.started', { npc, conversation: said.id });
    next();
  }

  function show(entry: Line): void {
    if (entry.effects) pending.push(...entry.effects);
    offered = (entry.choices ?? []).filter((choice) => holds(game, choice.when)).slice(0, 3);
    const by = entry.by ?? (partner || open?.npc || NARRATOR);
    const choices = offered.map((c) => c.text);
    if (by === NARRATOR || by === SCENE) {
      line = { npc: null, name: '', portrait: '', face: '', voice: '', text: entry.text, choices, kind, scene };
    } else {
      const person = game.systems.people?.get(by);
      const portrait = person?.portrait ?? by;
      line = {
        npc: by,
        name: person?.name ?? SPEAKERS[by] ?? by,
        portrait,
        face: entry.mood ? `${portrait}-${entry.mood}` : portrait,
        voice: person?.voice ?? by,
        text: entry.text,
        choices,
        kind,
        scene,
      };
    }
    log.push({ name: line.name, text: line.text });
    if (log.length > LOG_SIZE) log.shift();
  }

  /** Moves to the next line whose condition holds, leaving finished branches, and ends after the last one. */
  function next(): void {
    while (stack.length) {
      const frame = stack[stack.length - 1];
      frame.index++;
      if (frame.index >= frame.lines.length) {
        stack.pop();
        continue;
      }
      const raw = frame.lines[frame.index];
      const entry: Line = typeof raw === 'string' ? { text: raw } : raw;
      if (!holds(game, entry.when)) continue;
      show(entry);
      return;
    }
    end();
  }

  function end(): void {
    const ended = open;
    if (!ended) return;
    const effects = pending;
    const npc = partner;
    open = null;
    line = null;
    offered = [];
    pending = [];
    stack = [];
    // Effects first, so whoever hears `talk.ended` sees the flags and the bag as the conversation left them.
    for (const effect of effects) {
      try {
        apply(game, effect);
      } catch (error) {
        console.warn(`talk: an effect of ${ended.id} failed`, effect, error);
      }
    }
    if (ended.once) flags.set(`said.${ended.id}`, true);
    player.busy = false;
    // Only the conversation of the scene itself finishes it: the lines before a fight are part of it.
    if (ended.scene && !flags.is(FLAG.scene(ended.scene))) {
      flags.set(FLAG.scene(ended.scene), true);
      events.emit('scene.played', { scene: ended.scene });
    }
    events.emit('talk.ended', { npc, conversation: ended.id });
  }

  function choose(index: number): void {
    const choice = open ? offered[index] : undefined;
    if (!choice) return;
    if (log.length) log[log.length - 1].chose = choice.text;
    if (choice.effects) pending.push(...choice.effects);
    if (choice.then?.length) stack.push({ lines: choice.then, index: -1 });
    next();
  }

  const api: TalkApi = {
    talkTo(npc) {
      if (open) return;
      begin(pick(npc), npc);
    },
    start(conversation, npc) {
      if (open) return;
      const found = byId.get(conversation);
      const villager = found ? undefined : VILLAGER_LINES.find((v) => v.id === conversation);
      if (found) begin(found, npc ?? (found.npc === SCENE ? '' : found.npc));
      else if (villager) begin({ id: villager.id, npc: npc ?? SCENE, lines: [villager.text] }, npc ?? '');
    },
    get active() {
      return open !== null;
    },
    current: () => line,
    advance() {
      // A line with choices waits for one of them.
      if (!open || offered.length) return;
      next();
    },
    choose,
    skip() {
      // Every line still to come is run through, so its effects are done; a choice takes the first that is offered.
      for (let guard = 0; open && guard < 500; guard++) {
        if (offered.length) choose(0);
        else next();
      }
    },
    log: () => log,
  };

  // Nothing to save: the place in an open conversation is not kept, so a load never starts in the middle of a line.
  const system: SimSystem = {
    load() {
      if (!open) return;
      open = null;
      line = null;
      offered = [];
      pending = [];
      stack = [];
      player.busy = false;
    },
    save: () => null,
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const talk = createTalk(kernel.game);
  kernel.add('talk', talk.api, talk.system);
}
