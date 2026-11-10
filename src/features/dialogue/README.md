# Dialogue

A conversation is data. A small interpreter runs it, and a box at the bottom of the screen shows it with a portrait and a name. The line types out a letter at a time.

## Wiring

```ts
import { createDialogue } from './features/dialogue/index.ts';
import { bakerTalk, sampleVoices } from './content/dialogue-samples.ts';

const dialogue = createDialogue(ctx, {
  flags,                                               // the game's flags. Conversations read and change them.
  onCharacter: (letter, voiceId) => audio.emit({ type: 'talk', voice: sampleVoices[voiceId], char: letter }),
  portrait: (key) => portraitCanvas(key),              // or leave it out for a drawn initial
  advanceKeys: () => ['Enter', 'Space', ...input.bindings.interact],
  onEnd: (conversation, flags) => quests.refresh(flags),
});

// every frame
if (input.intents.interact && nearby) dialogue.start(nearby.talk);
dialogue.update(dt, ctx);                              // types the line
input.setMode(dialogue.isOpen ? 'talk' : 'play');
```

While it is open the box listens for its own keys, and a click anywhere advances it. Do not also call `advance()` when `interact` fires, or one press moves on twice.

## Exports

| Export | What it is |
|---|---|
| `createDialogue(ctx, options)` | Builds the box. Returns a `DialogueView`. |
| `DialogueView.start(conversation)` | Opens the box. False when the conversation has nothing to say with the flags as they are. |
| `DialogueView.advance()` | What a click does: show the whole line, then move on. On a line with choices it waits. |
| `DialogueView.choose(offered)` | Picks an offered choice, 0 first |
| `DialogueView.close()`, `isOpen`, `typing`, `current`, `flags`, `element` | |
| `Conversation`, `Line`, `Choice`, `Speaker`, `Condition`, `Effect`, `Flags` | The data |
| `Talk` | One run of a conversation, with no page in it: `current`, `advance()`, `choose(n)`, `done`, `said` |
| `checkConversation(conversation)` | What is wrong with a conversation as written, as sentences. Empty when it can run. |
| `passes(condition, flags)`, `applyEffects(effects, flags)`, `readFlag` | Conditions and effects |
| `Typewriter`, `isVoiced`, `MAX_CHOICES` | How a line types out. Three choices at most. |

Options: `parent`, `flags`, `onCharacter`, `onLine`, `onEnd`, `portrait`, `charsPerSecond` (32), `advanceKeys` (Enter, Space and F), `bus`.

## Writing a conversation

```ts
export const bakerTalk: Conversation = {
  id: 'odo-oven',
  start: 'hello',
  speakers: { odo: { name: 'Odo', voice: 'odo', speed: 26 } },
  lines: {
    hello: { who: 'odo', if: { not: { flag: 'met.odo' } }, else: 'ask', do: [{ set: 'met.odo' }], text: 'Morning!', to: 'ask' },
    ask: {
      who: 'odo', text: 'The oven went out in the night.',
      choices: [
        { text: 'I have wood right here.', if: { flag: 'wood', atLeast: 10 }, do: [{ add: 'wood', by: -10 }, { set: 'oven', to: 'lit' }], to: 'thanks' },
        { text: 'I will find you some wood.' },
      ],
    },
    thanks: { who: 'odo', text: 'Listen to that. She is roaring already!' },
  },
};
```

- A line whose `if` fails is skipped. The conversation goes on at its `else`, or at its `to`.
- A line's `do` runs when the line is said. A choice's `do` runs when the player picks it.
- A choice with an `if` is offered only when it passes. The first three that pass are offered.
- A line or a choice with no `to` ends the conversation.
- Conditions: `{ flag }` (set and truthy), `is`, `isNot`, `atLeast`, `below`, and `all`, `any`, `not` around other conditions. A flag that was never set reads as false, and as 0 where a number is asked for.
- Effects: `{ set, to? }` (true by default), `{ add, by? }` (1 by default), `{ clear }`.

The two samples are in `src/content/dialogue-samples.ts`: Odo the baker and Juniper, a child. The test file runs `checkConversation` on both.

## Notes

- Keys while the box is open: the advance keys, 1 to 3 to pick, the arrow keys to move between choices. A held key does not repeat.
- A gamepad while the box is open: A or X moves on or picks the focused choice, and the D-pad moves between choices. The box asks the gamepad itself, because the input feature passes nothing in `'talk'` mode.
- `onCharacter` is called for letters and digits, once each, as they appear. Letters skipped by a click are not reported.
- A comma pauses the typing for 0.12 seconds and the end of a sentence for 0.3.
- The whole line is laid out from the start with the untyped part hidden, so words do not jump to the next row as they appear.
- A speaker's `speed` is letters a second. It matches the `speed` of the sound engine's voice.
- Tests: `bun test src/features/dialogue`.
