// Conversations. The words are data in content/dialogue.ts and this file is the small interpreter that
// walks them: it picks the conversation for a person, shows one line at a time, branches on a choice,
// and runs the effects when the conversation ends.
//
// Effects wait for the end so a conversation is all or nothing. A save taken in the middle of one holds
// none of its gifts, and a load starts it again from the first line.

import type { Game, NpcId, SimSystem, TalkApi, TalkLine } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { CONVERSATIONS, SPEAKERS, VILLAGER_LINES, type Choice, type Conversation, type Line } from '../content/dialogue.ts';
import { JOB_BARKS } from '../content/people.ts';
import type { Effect } from '../content/quests.ts';
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

/** A small steady number from a name, so each villager keeps a line of their own. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return h;
}

export function createTalk(game: Game, conversations: readonly Conversation[] = CONVERSATIONS): Talk {
  const { events, flags, player } = game;
  const byId = new Map(conversations.map((c) => [c.id, c]));
  const byNpc = new Map<NpcId, Conversation[]>();
  for (const c of conversations) {
    const list = byNpc.get(c.npc) ?? [];
    list.push(c);
    byNpc.set(c.npc, list);
  }

  let open: Conversation | null = null;
  /** Who the player is talking to, or '' for a conversation with nobody in the world. */
  let partner: NpcId = '';
  let stack: Frame[] = [];
  /** Effects of the lines shown and the choices taken, in order, run when the conversation ends. */
  let pending: Effect[] = [];
  let line: TalkLine | null = null;
  /** The choices on screen, which are the ones whose condition holds. */
  let offered: Choice[] = [];

  /** A background villager's line for today: one that fits the moment if any does, else an everyday one. */
  function villagerLine(npc: NpcId): Conversation {
    const fitting = VILLAGER_LINES.filter((v) => v.when && holds(game, v.when));
    const pool = fitting.length ? fitting : VILLAGER_LINES.filter((v) => !v.when);
    const job = JOB_BARKS[game.systems.people?.get(npc)?.sprite ?? ''];
    const pick = !fitting.length && job
      ? { id: 'job.' + npc, text: job }
      : pool[(hash(npc) + game.clock.day) % pool.length];
    return { id: pick.id, npc, lines: [pick.text] };
  }

  function pick(npc: NpcId): Conversation {
    const list = byNpc.get(npc);
    if (!list) return villagerLine(npc);
    return list.find((c) => !(c.once && flags.is(`said.${c.id}`)) && holds(game, c.when)) ?? villagerLine(npc);
  }

  function begin(conversation: Conversation, npc: NpcId): void {
    open = conversation;
    partner = npc;
    stack = [{ lines: conversation.lines, index: -1 }];
    pending = [];
    player.busy = true;
    events.emit('talk.started', { npc, conversation: conversation.id });
    next();
  }

  function show(entry: Line): void {
    if (entry.effects) pending.push(...entry.effects);
    offered = (entry.choices ?? []).filter((choice) => holds(game, choice.when)).slice(0, 3);
    const by = entry.by ?? (partner || NARRATOR);
    if (by === NARRATOR) {
      line = { npc: null, name: '', portrait: '', voice: '', text: entry.text, choices: offered.map((c) => c.text) };
      return;
    }
    const person = game.systems.people?.get(by);
    line = {
      npc: by,
      name: person?.name ?? SPEAKERS[by] ?? by,
      portrait: person?.portrait ?? by,
      voice: person?.voice ?? by,
      text: entry.text,
      choices: offered.map((c) => c.text),
    };
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
    events.emit('talk.ended', { npc, conversation: ended.id });
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
      if (found) begin(found, npc ?? found.npc);
      else if (villager) begin({ id: villager.id, npc: npc ?? '', lines: [villager.text] }, npc ?? '');
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
    choose(index) {
      const choice = open ? offered[index] : undefined;
      if (!choice) return;
      if (choice.effects) pending.push(...choice.effects);
      if (choice.then?.length) stack.push({ lines: choice.then, index: -1 });
      next();
    },
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
