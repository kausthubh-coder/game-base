# Opening audio browser proof

The browser check observes the real title Begin path and the live Web Audio output. It does not start a game through the debug door.

Run it against an existing immutable build. It never builds, installs packages or changes a saved game from another browser.

```sh
bun tools/play-opening-audio.mjs --dist <runtime> --port <own-port> --source <runtime-source-sha> --out <new-evidence-directory> --cases skip,natural,initial-failure,late-skip
```

The coordinator must know the machine-wide heavy-job count before launch. Supply `--active-heavy-jobs 1` if another heavy job is running. The default means no other heavy jobs are running. The check samples resources and uses the corresponding admission rule before starting its server or browser. It records another sample every 30 seconds.

The output directory must be new. Each case uses a separate browser context with its own saved volume preference. The process closes its browser and its own server PID in `finally`.

## What the probe measures

Before the game loads, the check wraps `AudioNode.connect`. A connection to a live audio context's destination gets a transparent analyser in its path. The connection keeps its original return value. The check does not change gains, audio scheduling, playback methods or the simulation clock.

`window.__game.view.audio.context` identifies the world mix. The opening's separate live context identifies the film mix. Each sample records peak amplitude, RMS amplitude, context state, the saved preference and the engine's effective master volume. This measures the browser's digital output before the operating system audio device. It does not record room sound.

The film must produce nonzero output while every observed world output stays below the silence threshold. After the film ends, the world must produce nonzero output with the current saved volume. A read of `getVolume()` alone cannot satisfy either waveform assertion.

During an ordinary opening the check presses Shift, clicks the picture and changes the master preference through the public saved-settings API. The natural case lets the production film clock reach its end. The Skip case clicks the actual Skip button.

The failure cases intercept only the opening's fingerprinted `wall-*.mp3` voice asset. One aborts the real request. The other holds the request, clicks Skip, waits until cleanup hides the film, then releases the old request. The game must resume without a late soundtrack starting. Every film context that reached playback must be closed after cleanup.

## Initial regression evidence

The immutable old runtime was built from `72ac28d458957f31f0e7048765d167c0cf2fc040`. It was served separately on port 5833 from `.artifacts/beta-preview-verification/sprite-only-01/new-output/dist`.

```sh
bun tools/play-opening-audio.mjs --dist .artifacts/beta-preview-verification/sprite-only-01/new-output/dist --port 5833 --source 72ac28d4 --out .artifacts/opening-audio-browser/baseline-01 --cases skip
```

The command exited 1. While the film produced RMS 0.003296, the world simultaneously produced RMS 0.062821. Its peak was 0.134901 and its effective master was 0.65. The same run also caught the saved-volume change leaving the world audible. The later silence wait timed out, so this red run did not reach Skip.

The full samples, source and runtime paths, index hash, tool hash, launch resource sample and errors are in `.artifacts/opening-audio-browser/baseline-01/result.json`. `skip-playing.png` was inspected and shows the actual opening parchment picture.

## Initial repair review

The first immutable repair runtime is `dist-audio-017cf653`, built from `017cf653ef0e2adbf05af49ae42f20d81ab0afa8`. The coordinator's runtime manifest is `.artifacts/opening-audio-build/runtime-manifest.json`, SHA256 `86ccf5af9bfc563aba2e31cb4148230ddd6ae924a50818769d58b4cd31524638`.

The first browser run reported four passes in `.artifacts/opening-audio-browser/fixed-01`. Skip, natural completion, an aborted initial voice request and a delayed voice request released after Skip all restored actual world output. Current saved master volume was restored, and the played film's context closed. The natural case reached the production ending without changing its clock. Its final state entered Hobb's bunk-room conversation.

Review found a gap in that first check. It took a screenshot between detecting the first audible film sample and asserting world silence. The first detected sample still contained a small world tail. The later asserted samples were zero. Those initial passes therefore do not prove silence at the start of the film.

Tool commit `c5b8928f` asserts the first audible sample and uses a smaller 256-sample analyser window. This command then exited 1 against the same repair runtime:

```sh
bun tools/play-opening-audio.mjs --dist dist-audio-017cf653 --port 5834 --source 017cf653ef0e2adbf05af49ae42f20d81ab0afa8 --out .artifacts/opening-audio-browser/fixed-initial-strict-01 --cases skip --active-heavy-jobs 0
```

The only failed assertion was `World output overlapped the audible film`. The first sample contained world RMS 0.0000369674 and peak 0.0000708103 while film RMS was 0.00261049. The effective master was already zero. Later silence, real Skip, saved master restoration to 0.35 and owned-context closure passed. The engine's master volume uses a 0.05-second exponential glide, so setting its target to zero does not immediately silence its output.

The strict run and its screenshots remain in `.artifacts/opening-audio-browser/fixed-initial-strict-01`. This residual was reported to the implementation owner before acceptance. All resumed screenshots in the first run were inspected and show the bunk-room conversation, with the film gone.

## Coverage limits

This check uses real pointer and key gestures. It does not perform a genuine operating-system tab hide and return. The focused shell tests cover that handler separately.

The overlap observation checks the first detected audible sample, the state after gestures and a volume change, and samples every 100 milliseconds until natural completion on the production clock. Each analyser reads a 256-sample waveform window. This check does not claim continuous waveform coverage between observations.

A late result after Skip is covered. Starting a second opening while the first request remains pending needs an explicit browser seam beyond this normal new-game route. That interleaving is not claimed here. Later-art failure, renderer failure, repeated explicit `dispose()` and `play()` after disposal are also outside this bounded browser check.
