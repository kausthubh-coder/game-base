# talk

Conversations. It implements `TalkApi`. The words are data in `src/game/content/dialogue.ts`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.talk` |
| `createTalk(game, conversations?)` | The same system without a kernel, for tests with other words. It returns `{ api, system }`. |

## How a conversation runs

- `talkTo(npc)` starts the first conversation in `CONVERSATIONS` for that person whose `when` holds. Each person's list runs from the most specific to `<npc>.fallback`, which has no condition: an unmet need (`need.<who>.<bed|meal|lamp>`, set by the settlement), the day their wish is granted (`wish.<who>`, once), a moment, then the chapter (the condition `{ chapter: n }`, the chapter of the latest quest that has started). These are chapter 22's walk-up lines, one line each.
- A conversation marked `pool` says one of its lines, the same all day and another the next (the Green Mother, Ren, the Stag).
- Someone with no conversations of their own (`villager-1` to `villager-10`) says one line from `VILLAGER_LINES`, picked by their id and the day. A line for the moment (the pumps, the lit road, the green wood) comes first while it holds; then a job bark from `JOB_BARKS` in `content/people.ts`.
- `start(id, npc?)` starts a conversation by its id, whatever its condition. The story director starts the scenes this way (`src/game/story/scenes.sim.ts`), and the hall the first night's.
- `current()` is the line on screen: `npc`, `name`, `portrait`, `face` (the portrait with the line's `mood`, `hobb-glad`), `voice`, `text`, up to three `choices`, the `kind` it is shown as (`talk`, `staged` or `film`, from `content/scenes.ts` or the conversation's own `kind`) and its `scene` (0 for none). It returns the same object until the line changes. A narrator line has `npc: null` and empty strings.
- `advance()` goes to the next line and ends the conversation after the last. On a line with choices it does nothing, so call `choose(index)` there.
- `skip()` runs the rest of the conversation at once, with its effects, taking the first choice offered: Esc in a film.
- `log()` is what was said, oldest first, up to 80 lines, with the choice taken on a line that had them.
- `game.player.busy` is true from the first line until the end. `talkTo` and `start` do nothing while a conversation is open.
- A stage cue is part of the text, in brackets: `(waking, not getting up) Forty sacks.` The voice tool never speaks it.
- Effects (gifts, flags, quest starts, Almanac facts) run when the conversation ends, just before `talk.ended`. A conversation is all or nothing.
- A conversation with a `scene` sets `scene.<n>` as it ends and sends `scene.played`, once. The lines before a fight (`scene.<n>.before`) do not.
- A gift that does not fit in the bag is counted in the flag `owed.<item>`. The director hands it over when there is room.
- A conversation marked `once` sets the flag `said.<id>` and is not picked again.

## Events it sends

| Event | When |
|---|---|
| `talk.started { npc, conversation }` | The first line shows. `npc` is who the player talks to, or `''`. |
| `talk.ended { npc, conversation }` | After the last line, with the effects done and `busy` false |
| `scene.played { scene }` | A scene's conversation ended, after `scene.<n>` is set |

Effects send what they cause: `item.gained` and `item.lost` from the bag, `flag.changed`, `quest.started`, `fact.learned`.

## Flags the words set

`scene.<n>`, `choice.<id>` (the story's choices: the weapon, the pump, the burrowers, Calla, the gearlings, Gus's
field; the settlement sets the rooms and the dinner), `has.almanac` (the Custodian hands over the field book in
scene 14), `glove`, `custodian.pack`, `vaults.marked`, `burrow.dug`, `road.dark`, `said.<conversation>`, and the
first night's flags the hall acts on (`door.open`, `mark`, `custodian.awake`, `fox.calmed`, `heart.seen`,
`night.told`).

## Voices

`tools/voice.ts` makes a clip for each line a person in `CAST` (`content/cast.ts`) says, named by speaker and words,
so a line keeps its clip as long as its words stay the same. Everyone who speaks in act 1 has a voice, each with
why it was picked; `tools/voice/audition.ts` made the auditions behind them. A speaker not in `CAST` types with a
blip (`uiview/voices.ts`).

## Wiring

```ts
import { install as installTalk } from './talk/index.sim.ts';

installTalk(kernel);                       // any order: it reads other systems only when a talk runs
const talk = kernel.game.systems.talk;
talk.talkTo('tamsin');                     // the people system calls this from "E: Talk to Tamsin"
const line = talk.current();               // draw line.name, line.portrait, line.text, line.choices
if (line && line.choices.length) talk.choose(0);
else talk.advance();                       // on a click or E. The debug door's talkThrough() loops these two.
kernel.game.events.on('talk.ended', () => { /* close the box */ });
```

It reads `people` (names, portraits, voices), `inventory`, `quests`, `almanac`, `pets`, `placeables`, `crops` and `region` while a conversation runs. A missing one reads as empty.

Nothing is saved. A load closes an open conversation, and it starts again from its first line.
