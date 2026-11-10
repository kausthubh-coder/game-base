# talk

Conversations. It implements `TalkApi`. The words are data in `src/game/content/dialogue.ts`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.talk` |
| `createTalk(game, conversations?)` | The same system without a kernel, for tests with other words. It returns `{ api, system }`. |

## How a conversation runs

- `talkTo(npc)` starts the first conversation in `CONVERSATIONS` for that person whose `when` holds. Each person's list runs from the most specific to `<npc>.fallback`, which has no condition.
- Someone with no conversations of their own (`villager-1` to `villager-6`) says one line from `VILLAGER_LINES`, a pool of twelve. The line is picked by their id and the day, so it is the same all day. During the festival, in rain and after the delivery they say a line for that moment.
- `start(id, npc?)` starts a conversation by its id, whatever its condition.
- `current()` is the line on screen: `npc`, `name`, `portrait`, `voice`, `text` and up to three `choices`. It returns the same object until the line changes. A narrator line has `npc: null` and empty strings.
- `advance()` goes to the next line and ends the conversation after the last. On a line with choices it does nothing, so call `choose(index)` there.
- `game.player.busy` is true from the first line until the end. `talkTo` and `start` do nothing while a conversation is open.
- A stage cue is part of the text, in brackets at the front: `(waking) Forty sacks.`
- Effects (gifts, flags, quest starts, Almanac facts) run when the conversation ends, just before `talk.ended`. A conversation is all or nothing.
- A gift that does not fit in the bag is counted in the flag `owed.<item>`. The director hands it over when there is room.
- A conversation marked `once` sets the flag `said.<id>` and is not picked again.

## Events it sends

| Event | When |
|---|---|
| `talk.started { npc, conversation }` | The first line shows. `npc` is who the player talks to, or `''`. |
| `talk.ended { npc, conversation }` | After the last line, with the effects done and `busy` false |

Effects send what they cause: `item.gained` and `item.lost` from the bag, `flag.changed`, `quest.started`, `fact.learned`.

## Flags the words set

`met.<npc>`, `has.almanac` (Tamsin handed the book over, so show the Almanac from here on), `plot.met`, `plot.told`, `leaftail.shown`, `bread.asked`, `bread.seeds`, `bread.delivered`, `festival.wait` (the player chose to wait with Maren for evening), `festival.lamp.given`, `festival.ended`, `juniper.secrets`, `said.<conversation>`.

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
