# World sound overlaps the opening film

The opening film paused simulation but left the world's sound engine playing. Its own soundtrack used a separate audio context, so the two mixes overlapped.

The user reported this in the Act 1 beta. This repair's initial reproduction is a focused audio-graph check, not a browser recording.

## Evidence

`story-opening.view.ts` called `setPaused('opening', true)`. The shell's pause stopped simulation steps, while `core-sound.view.ts` continued scheduling music, ambience beds and spot sounds on every frame. The opening soundtrack connected its separate context directly to its destination. Neither path transferred control of sound.

Run the focused regression:

```sh
bun test src/game/shell/sound.test.ts
```

Before the fix, all three tests failed. The first test started the real shell, audio engine and mixer, confirmed that world beds and effects had audible routes, then requested the opening's mute. Both routes remained nonzero. The optional call in that initial test allowed the missing mute operation to report the leaked output instead of failing on a missing method. The committed test calls the operation directly.

Evidence is local in `.artifacts/opening-audio-repair/baseline.log`. The recording Web Audio context settles gain targets immediately. It checks the real routing and lifecycle, not waveforms, fade duration or browser playback.

## Repair

The shell now owns temporary mute reasons. An active reason makes the engine's effective master volume zero without changing stored preferences. Engine preparation, later master-volume changes, gestures and tab visibility preserve the mute. Releasing the final reason restores the current preference.

The opening acquires its reason before fallible setup. Its shared end path keeps the mute through the soundtrack's stop tail and picture fade, then releases it even if resource cleanup throws. Natural completion, Skip, setup failure, soundtrack failure and renderer failure use that path. A failure loading later pictures also ends the film, rather than leaving its readiness wait held forever. Late loading cannot start playback after Skip and clears renderer resources added after cleanup.

The soundtrack also had a separate pre-existing lifetime defect. `stop()` stopped sources but left its owned audio context open. The new idempotent `dispose()` permanently stops playback and closes an owned context. It leaves a context supplied by an offline renderer open. This resource fix is separate from the world-mute regression evidence.

## Checks and remaining browser proof

```sh
bun test src/game/shell/sound.test.ts src/features/audio
```

The focused run passed all 67 tests. The new cases cover active beds and effects, suppression before preparation, gestures, tab return, current volume preferences, overlapping owners and repeated release.

The coordinator must verify the rebuilt game before accepting the repair:

- Start New Game through the title. Record world output silence and film output activity together, then watch the world resume after the film.
- Test natural completion and Skip, including Skip during delayed soundtrack decoding and renderer loading. Resolve delayed loads after cleanup and confirm no playback resumes.
- Skip while the first film's soundtrack or pictures are delayed, then start a second opening. Resolve or reject the first film's delayed work while the second plays. The second film must keep its renderer, soundtrack and world mute. Its end alone releases the mute. Each asynchronous continuation and cleanup timer is bound to its opening instance.
- Inject first-load, later-art and draw failures. Confirm the film ends, simulation resumes and the world mute releases.
- During the film, press keys, click, hide and restore the tab, and change the master preference. Confirm the world stays silent and restores the current preference afterward. Continue must not acquire the opening mute.
- On the real soundtrack, call `dispose()` twice, then `play()`. Confirm zero live sources, a closed owned context and no new context or playback. Dispose a soundtrack made with a supplied offline context and confirm that context stays open.

No browser, build or full verification ran in the helper because the coordinator reserved those resources. Existing saves, preview processes and earlier evidence were left untouched.

## Immediate output gate

The stricter browser probe found a short audible world tail at the first film sample: setting the mixer target to zero still allowed its volume fade. A final output gain now closes immediately while any mute owner is active. A regression checks silence before another update; it failed before this change and passes afterward. The focused suite passes 68 tests. Fresh strict browser verification passed Skip, natural completion, initial loading failure and delayed Skip on runtime9b0c2ff9. The first audible film sample and subsequent samples have no world overlap; preferences restore and film contexts close. Evidence: `.artifacts/opening-audio-browser/immediate-gate-final`.
