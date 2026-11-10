# Voice experiments

Two ways to give Greenhollow's people a voice, built on the playable act 1 (`play/greenhollow` at 374ba16).

- **A. Voiced dialogue, made ahead of time.** 25 real act 1 lines, voiced with ElevenLabs, played in the game's dialogue box. The words type in time with the voice.
- **B. A live conversation with Tamsin.** You talk (or type), and she answers in character, out loud. Two pipelines:
  - **B1**: ChatGPT's realtime voice, started through `codex app-server` on the machine's ChatGPT login (the `~/dev/live-tutor` approach).
  - **B2**: speech to text, a fast Codex text model, then ElevenLabs speaking each sentence as soon as it is written.

Nobody has listened to any of this audio. The Mac mini has no speakers. Every clip was checked by decoding it (length, loudness, pitch) and by transcribing it back with ElevenLabs Scribe.

## Into the game (2026-11-10)

Kausthubh listened and decided: Gus is `gus-3`, every line is made with **eleven_v4_turbo** (its take of `square-4` was the best of the four models by ear), Tamsin's designed voice is out, and voiced dialogue ships in the game itself. That work lives outside this folder now:

- `src/game/content/cast.ts`: the game's cast, model, and the few audio tags (v4 Turbo performs `[sighs]` and `[whispers]` and does not read them out; checked by transcribing).
- `tools/voice.ts`: makes a clip for every line the cast says in `src/game/content/dialogue.ts`, into `public/assets/voice/`. `tools/voice/` holds the ElevenLabs calls and the audio checks this experiment started with.
- `gus-3` (`VXQGRSJ6Cm10Pt4GSFeG`) was only a preview. It is saved on the account now as "Greenhollow Gus 3", under the same id.

### Six new Tamsins

`tools/tamsin-auditions.ts` made `audio/auditions/tamsin-4.mp3` to `tamsin-9.mp3`. Each reads the same four of her lines in eleven_v4_turbo: "Twelve people have asked me for this plot. You are the first who looked at the ground before the view. Festival tonight. I am told to wear the good coat. I own one coat. You fed it first. I would have set a snare and priced the tail. Good harvest. Small, and good."

| Audition | Voice | Source | Words a second | Pitch | Heard back |
|---|---|---|---|---|---|
| tamsin-4 | Beatrice, `kkPJzQOWz2Oz9cUaEaQd` | library: British, old, warm and steady, made for stories | 2.64 | 193 Hz | 98% ("You were the first") |
| tamsin-5 | Jane, `RILOU7YmBhvwJGDGjNmP` | library: British audiobook reader in her fifties, the most used older British voice | 2.80 | 205 Hz | 100% |
| tamsin-6 | Evelyn, `XEoBW4iDmiawQP72xnAF` | library: British, middle aged, "a dry sense of humour", "London irony and grit" | 2.83 | 188 Hz | 100% |
| **tamsin-7** | **Charmion, `lUCNYQh2kqW2wiie85Qk`** | **library: British, middle aged, soft and husky, a character voice. The game's default** | **2.59** | **198 Hz** | **100%** |
| tamsin-8 | "Greenhollow Tamsin (Yorkshire)", `mXgcP5FHXZ0rX2h5Lfa6` | Voice Design: seventy, gravelly and smoky, broad Northern accent | 2.38 | 162 Hz | 98% ("You were the first") |
| tamsin-9 | "Greenhollow Tamsin (Highland)", `FJRYGJ6zLt6PQOCfd6yn` | Voice Design: late sixties, a raspy mezzo with a twinkle, soft Highland Scottish | 2.49 | 172 Hz | 100% |

The default is Charmion because she is the one library voice inside every mark without adjusting: heard back word for word, unhurried (2.59 words a second, against 2.0 to 2.6), and husky. The two designed voices are lower and slower, but Voice Design is what sounded wrong last time. **Nobody has heard these. Pick by ear**: put another id from `TAMSIN_VOICES` in `CAST.tamsin.voiceId` (`src/game/content/cast.ts`) and run `bun --env-file=.env.local tools/voice.ts`. Only her lines are made again (about 1,400 credits). The design previews behind tamsin-8 and tamsin-9 are in `.artifacts/voice/design/` (not in git).

## Run it

```sh
# once: the ElevenLabs key, into .env.local at the repo root (*.local is git-ignored)
export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -a dabot -s op-agent-token -w)"
printf 'ELEVENLABS_API_KEY=%s\n' "$(op read 'op://agent/kwbngtfr4zophmzpkc3ks5gavy/credential')" > .env.local

bun --env-file=.env.local experiments/voice/server.ts 5381     # prints its pid; stop it with kill <pid>
```

| Page | What it is |
|---|---|
| http://localhost:5381/ | Links to both |
| http://localhost:5381/scene | Experiment A. Click "Play the scene". Space or a click skips, R replays the line, "Compare models" plays one line per person in four models. |
| http://localhost:5381/talk | Experiment B. Pick a moment of act 1 and a pipeline, click "Walk up to her", then press Talk or type. `?pipe=b1` opens on B1. |

The server keeps the ElevenLabs key. The browser talks only to the server. B1 also needs `codex` logged in to ChatGPT. The mic needs localhost or HTTPS.

Checks, with the server running:

```sh
bun experiments/voice/tools/check-scene.ts           # plays all 30 lines headless; every clip must play to its end
bun experiments/voice/tools/bench.ts b1 text         # 7 timed turns; also: b1 voice, b2 text, b2 voice [--model sol-fast] [--tts eleven_v4_turbo]
bun experiments/voice/tools/summarize-bench.ts       # pools .artifacts/voice/bench/*.json into the table below
bun tools/typecheck.mjs --paths experiments/voice
```

Making the audio again (costs credits; unchanged lines are skipped):

```sh
bun --env-file=.env.local experiments/voice/tools/design-voices.ts design tamsin    # three previews into audio/auditions/
bun --env-file=.env.local experiments/voice/tools/design-voices.ts save tamsin 2    # keep one, then put its id in cast.ts
bun --env-file=.env.local experiments/voice/tools/generate-lines.ts --check         # the scene lines, plus a transcription check
```

## Files

| Path | What |
|---|---|
| `cast.ts` | The four voices, their Voice Design descriptions and why each preview was kept |
| `scene/lines.ts` | The scene: five moments, each line word for word from `src/game/content/dialogue.ts`, with the eleven_v3 audio tags it is spoken with |
| `audio/` | The made clips (`scene/`, `compare/`, `auditions/`) and `lines.json`, the time each letter appears |
| `talk/tamsin.ts` | Tamsin's character prompt, and the three moments of act 1 the page can put her in |
| `talk/b1.server.ts`, `talk/b2.server.ts` | The two pipelines on the server side |
| `talk/talk.ts`, `scene/scene.ts` | The pages |
| `lib/codex.ts` | The `codex app-server` client. ElevenLabs over fetch and the audio checks moved to `tools/voice/` when voiced lines went into the game |
| `tools/` | Voice design, line generation, the scene check, the latency bench |

## A. Voiced dialogue

### The voices

Voice Design (`eleven_ttv_v3`) made three previews for each person from a written description. The account's own voices are narrators and presenters, and none is an old woman, a tired nineteen-year-old or a slow farmer.

| Person | Voice | Why |
|---|---|---|
| Tamsin | Designed: "Greenhollow Tamsin" (`30hqoTJF3dS5trqljOct`). Mid sixties, low and slightly husky, warm but dry, unhurried, soft rural English. | Preview 2 of 3: the lowest (143 Hz median) and unhurried (2.35 words a second). Preview 3 was slower still with long gaps. |
| Maren | Designed: "Greenhollow Maren" (`XwYcwSl7JeQ9PUQCBnqY`). Nineteen, quick and clipped, tired, a little hoarse, light English. | Preview 2 of 3: the quickest (2.61 words a second), at 208 Hz. |
| Gus | Designed: "Greenhollow Gus" (`VAmop9jKbd3fw7i7BY4S`). Fifties, slow, flat and low, West Country. | Preview 2 of 3: the lowest (87 Hz) and slow (1.34 words a second). |
| Juniper | Shared library: "Flicker - Cheerful Fairy & Sparkly Sweet" (`piI8Kku0DcvcL6TTSeQt`), a young British character voice. | Voice Design refuses any child's voice (403, "safety guidelines"), even described as an actress playing a kid. Flicker (British, 410 Hz) beat Lulu Lolipop (American, 400 Hz) to keep the cast English. Lulu's take is in `audio/auditions/juniper-lulu.mp3`. |

I picked by measurement because I could not listen: pitch for age and weight, words a second for pace. **Please listen to the three previews of each in `audio/auditions/` and swap any you like better.** That is a taste call.

### The lines

25 voiced lines (plus 3 narrated and 2 player choices) across five moments: Tamsin at the grant stone (8), Maren in the granary (5), Gus in his field (5), Juniper in the square (4), and Tamsin on the river bank at the festival (3). The voice reads a tagged copy: the game's stage cue "(waking)" becomes `[sleepily]`, and tags like `[warmly]`, `[wryly]`, `[sighs]`, `[whispers]` and `[giggles]` were added where the line wants them. The box shows the game's own words.

All 25 were transcribed back. 24 came back at 90% or more of the words. Gus's "Rain'd do it better" came back as "Rain do it better" (89%). Scribe marked `[sighs]`, `[gasps]` and `[laughs]` as sounds in the clips that asked for them, so the tags are performed, not read out.

The typing follows ElevenLabs' character timings (`with-timestamps`), so each letter appears when it is said. A tag's sound (a sigh, a gasp) plays before the first letter. The headless check played all 30 lines to the end with auto-advance.

### Four models, one line each

"Compare models" on the scene page plays one line per person in each model. Clip lengths:

| Line | v3 + tags | v4 + tags | v4 Turbo | Flash v2.5 |
|---|---|---|---|---|
| Tamsin: "You are the first who looked at the ground before the view." | 3.8 s | 3.7 s | 3.8 s | 3.5 s |
| Maren: "(waking) Forty sacks. I counted twice..." | 5.4 s | 8.0 s | 7.0 s | 5.4 s |
| Gus: "Soil's tired. Not lazy. Tired. You'd be too." | 4.2 s | 6.2 s | 5.4 s | 3.7 s |
| Juniper: "Secret. Tamsin's sword is under the lodge floor. She grew beans on top." | 7.8 s | 6.7 s | 5.6 s | 5.2 s |

v4 also performed the `[giggles]` tag (Scribe heard a laugh), so v4 reads tags too. Flash and v4 Turbo were given plain words. Which sounds best is for your ears.

### Rule 4

`AGENTS.md` rule 4 says "no sound files". The clips live in `experiments/voice/audio/` (5.8 MB of mp3), not `public/assets`. Shipping voiced lines would mean changing that rule. That is your call.

## B. Talking to Tamsin

### Her prompt

`talk/tamsin.ts` says who she is (a retired delver in her sixties who keeps the lodge, priced everything for forty years, replants every hole), how she talks (one to three short sentences, plain, dry, few contractions, no stage directions, never states the moral), what she knows (Greenhollow, Hollowmere and its people, the plot, the mosslings, the festival, and the leaftail only once the player has it) and what she does not (anything outside the world, anything after the festival, why the harvests shrink). Her past comes out as one short line if pressed. The page passes the moment: quest, place, time of day, weather, the pet, and what the player has done.

From the bench runs, in her words: "I do not know that word. Is it something on your plot, or in Hollowmere?" (asked about a smartphone), "My old sword. Beans grow on top. That is where it belongs." (the lodge floor), "I looked to price, not to see." (the blank book).

### B1: ChatGPT realtime voice

The page holds a WebRTC call to OpenAI. `codex app-server` starts it with Tamsin's prompt (`thread/realtime/start`, version v3), exactly as live-tutor does. It uses the ChatGPT login, so there is no API key and no per-call bill. The websocket transport, which would route the audio through the server, answers "realtime conversation requires API key auth" on a ChatGPT login.

- **Voice:** `sol` by default. It can be changed per call: v3 takes 25 voices (`juniper`, `maple`, `spruce`, `ember`, `vale`, `breeze`, `arbor`, `sol`, `cove` and 16 more; the page has a picker). None is a designed or cloned voice, so B1 cannot sound like the Tamsin of experiment A.
- The realtime model detects the end of speech itself and can be interrupted.

### B2: Codex text model plus ElevenLabs

1. **Hearing.** The page detects speech by level (-45 dBFS, 600 ms of quiet ends a turn), records it and sends it to ElevenLabs Scribe (`scribe_v2`). A "Browser speech" option uses the Web Speech API in Chrome instead (not measured: headless Chrome does not have it).
2. **Thinking.** One `codex app-server` thread per tab, with Tamsin's prompt as `baseInstructions` (so none of Codex's coding prompt), no tools, `gpt-5.6-luna` at low effort on the Fast tier (the page can switch to Terra or Sol). Tokens stream back.
3. **Speaking.** Each finished sentence (or the first clause, once it is 40 letters long) goes to ElevenLabs' streaming endpoint at once (`eleven_flash_v2_5`, 24 kHz PCM, `previous_text` for continuity), in Tamsin's designed voice. The page plays the audio in order as it arrives.

A new Codex thread's first reply is slow (4 to 50 s in probes), so the page sends a greeting when you walk up, and she speaks first. That turn is not counted below.

Codex 0.167 lists `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`, `gpt-5.6-luna`, `gpt-6-sol` and `gpt-6-astra` on this login. "Fast" is a service tier (`priority`), not a model. There is no "GPT Luna fast" model by that name.

### Latency

Time from the end of the player's words to the first sound of her reply, 2026-11-10. Seven questions a session, the greeting not counted.

| Pipeline | Input | Sessions | Turns | Median | Worst | Session medians |
|---|---|---|---|---|---|---|
| B1 realtime (voice `sol`) | typed | 2 | 14 | **0.92 s** | 1.06 s | 0.91, 1.02 |
| B1 realtime (voice `sol`) | spoken | 2 | 14 | **1.30 s** | 1.73 s | 1.19, 1.42 |
| B2 GPT-5.6-Luna + Flash v2.5 | typed | 3 | 21 | **1.33 s** | 2.06 s | 1.32, 1.33, 1.37 |
| B2 GPT-5.6-Luna + Flash v2.5 | spoken | 1 | 7 | **2.44 s** | 4.63 s | 2.44 |
| B2 GPT-6.1-Terra + Flash v2.5 | typed | 2 | 14 | 1.65 s | 3.80 s | 1.64, 1.66 |
| B2 GPT-6.1-Sol + Flash v2.5 | typed | 3 | 21 | 1.95 s | 2.93 s | 1.83, 1.84, 2.02 |
| B2 GPT-6.1-Sol + v4 Turbo | typed | 1 | 7 | 2.19 s | 3.87 s | 2.19 |
| B2 GPT-6.1-Sol + Flash v2.5 | spoken | 2 | 14 | 3.17 s | 4.17 s | 2.77, 3.23 |

Where B2's time goes, medians in ms from the moment the server had the words:

| B2 setup | Hearing (Scribe) | Model first token | First sentence ready | ElevenLabs first audio after that |
|---|---|---|---|---|
| Luna, spoken | 662 | 891 | 963 | 161 |
| Luna, typed | - | 1028 | 1127 | 165 |
| Terra, typed | - | 1384 | 1449 | 165 |
| Sol, typed | - | 1678 | 1785 | 158 |
| Sol + v4 Turbo, typed | - | 1713 | 1835 | 215 |

All 112 timed turns produced a reply and a first sound. After these runs, two rules were added to her prompt (do not give away what the current task asks the player to find out, and do not name the leaftail before the player has it), because she answered "What do mosslings need?" outright. The prompt grew by about 90 words; the timings were not run again. No session had an error. The raw turns are in `.artifacts/voice/bench/*.json` (not in git), and `tools/summarize-bench.ts` rebuilds the tables.

How it was measured: `tools/bench.ts` drives the real talk page in headless Chrome. The player is a fake mic playing macOS `say` (the Daniel voice) over a little room noise, with seven questions a session. Each turn is timed by the page from the end of the player's words to the first sound of her reply. For voice turns, the end of the words is the last loud 20 ms frame of the fake mic. For typed turns, it is the moment the text is sent. The first sound is when B2 schedules its first audio, or when sound first arrives on B1's call (an analyser on the WebRTC track). Neither includes the speakers' own output delay. Setups were interleaved (B1, B2, B1, B2) so drift favoured neither. The machine was heavily loaded the whole time (load average 105 to 150, other agents building). Both pipelines are bound by remote services, not by this machine, so the numbers will move on another day.

For spoken turns B2 also waits 600 ms for the level detector to be sure you stopped, then Scribe takes about 0.6 s. The text model is the largest part after that, and the choice of model moved the median more than anything else: Luna's median was 0.6 s lower than Sol's, and their session medians do not overlap (1.32 to 1.37 s against 1.83 to 2.02 s). ElevenLabs Flash adds only about 0.16 s after a sentence is ready. B1 does hearing, thinking and speaking inside one remote model and detects the end of speech itself, which is why it is about a second faster on spoken input.

**Verdict.** B1 is the faster live pipeline: about 1.3 s from the end of your words to her voice, against 2.4 s for B2 at its best. B2's gain is the voice: it speaks in the designed Tamsin voice from experiment A, and B1 cannot. To close the gap, B2 needs faster hearing: the 600 ms wait plus a batch upload to Scribe is about 1.2 s of its 2.4 s. Speech to text that streams while you talk, or the API's `scribe_v2_turbo` model, could cut most of that. Neither was tried. B2's default model is now GPT-5.6-Luna, the fastest of the three, and its replies stayed in character ("I watched things only to price them. That fills a purse, not a book.").

## Cost

| What | Cost |
|---|---|
| A: designing the voices, the auditions, 25 scene lines in v3 and 12 comparison clips, and transcribing them back | about 2,060 ElevenLabs credits (one time) |
| B2: a reply of one to three sentences in Flash v2.5, plus Scribe for a spoken turn | about 20 credits a reply (1,931 credits over 96 replies in the measured sessions) |
| B1 and B2's text model | no bill: both run on the ChatGPT login through Codex and count against that plan's limits |
| This whole experiment | 4,267 credits of the account's 158,499 this period (7,270 used before, 11,537 after) |

Voiced dialogue made ahead of time costs once per line and then nothing. A live B2 conversation costs credits on every reply.

## Not checked

- Nobody listened to any clip or call. Quality, warmth, accent and whether the voices fit are unverified by ear.
- The real mic, speakers and echo: tested only with a fake mic. B2 ignores the mic while she speaks, so it cannot be interrupted. B1 relies on the browser's echo cancellation.
- Browser speech recognition (B2's "Browser speech" option) was not measured.
- Frame rate: these pages draw no 3D, and this Mac draws WebGL in software anyway.
