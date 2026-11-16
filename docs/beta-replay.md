# First-half beta replay

`tools/play-beta.mjs` checks the released story from a fresh Begin through Lamp Gallery. Every chapter receives the preceding chapter's newly earned, unedited save. Light that works, Seed Vault, Rootworks and the rest of Act 1 remain unfinished. Keep the separate full Act 1 runner and its unfinished verification entry.

Reserve the heavy-browser slot before starting. The adapter launches one existing runner at a time and checks resource admission before each launch. It never builds, changes the game state, supplies rewards or substitutes historical chapter checkpoints. The existing chapter runners keep their keyboard/mouse actions, Continue checks and disclosed idle waits. Firstnight, Homestead, Copper and Gold have bounded noninteractive simulation waits. Echo and the later chapters use ordinary elapsed time.

## Prepare current evidence

Use a completed, immutable production output built from the current product. Write its provenance immediately after that trusted build:

```js
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { runtimeHashes } from './tools/lib/beta-chain.mjs';
writeFileSync('<runtime-manifest.json>', JSON.stringify({
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  build: runtimeHashes('<immutable-dist>'),
}, null, 2));
```

The adapter compares every runtime file with that manifest and checks the current source against its recorded revision for `src`, `public`, `index.html`, `vite.config.ts`, `package.json` and `bun.lock`. Do not stamp an old output with the current revision. Every stage receives the supplied immutable directory through `--dist`. Existing native outputs and runtime aliases are left untouched. Build a new directory when the product changes, especially while a private preview serves an older output.

Complete and inspect chapter preflight before the long replay. Supply a JSON report with this shape. Each evidence entry contains an absolute `path` and the SHA256 of the actual file, as returned by `fileEvidence` in `tools/lib/beta-chain.mjs`:

```json
{
  "status": "PASS",
  "runtimeSha256": "SHA256 of runtime-manifest.json",
  "checks": {
    "rules": { "pass": true, "evidence": [{ "path": "/absolute/rules.log", "sha256": "..." }] },
    "presentation": { "pass": true, "evidence": [{ "path": "/absolute/presentation.json", "sha256": "..." }] },
    "budgets": { "pass": true, "evidence": [{ "path": "/absolute/budgets.json", "sha256": "..." }] }
  },
  "imageReview": {
    "pass": true,
    "images": [{ "path": "/absolute/reviewed.png", "sha256": "..." }]
  }
}
```

The coordinator must judge the actual checks and images. Evidence hashes preserve that review; a `PASS` label alone does not establish image quality or budget compliance. Reuse prior preflight only when its product source, runtime and measured inputs still match. Otherwise collect fresh evidence. Follow the verify-chapter skill for scene coverage, phone/desktop, high/low and actual quality budgets.

## Run the chain

```sh
PLAY_PORT=5838 bun tools/play-beta.mjs \
  --out .artifacts/beta-final/attempt-01/chain \
  --runtime dist-grantday \
  --runtime-manifest .artifacts/beta-final/attempt-01/runtime-manifest.json \
  --preflight .artifacts/beta-final/attempt-01/preflight.json \
  --active-heavy-jobs 0
```

An already completed fresh Begin may be adopted by adding `--grant-output .artifacts/beta-final/attempt-01/01-grant`. The adapter checks its actual passing replay, raw landing hash, original Grantday runner bytes and unchanged product source. This option adopts only the first stage; later historical saves cannot enter the chain. Its recorded source identity remains in the replay.

| Stage | Existing runner | New output passed onward | Legacy default |
|---|---|---|---|
| 01-grant | `tools/play-grantday.mjs` | `earned-landing.save.json` | `dist-grantday` |
| 02-night | `tools/play-firstnight.mjs` | `earned-morning.save.json` | `dist-firstnight` |
| 03-home | `tools/play-homestead.mjs` | `earned-homestead.save.json` | `dist-homestead` |
| 04-greywood | `tools/play-greywood.mjs` | `earned-greywood.save.json` | `dist-greywood` |
| 05-copper | `tools/play-bench-copper.mjs` | `earned-copper.save.json` | `dist-bench-copper` |
| 06-gold | `tools/play-gold-arches.mjs` | `earned-gold.save.json` | `dist-bench-copper` |
| 07-echo | `tools/play-echo.mjs` | `earned-echo.save.json` | `dist-bench-copper` |
| 08-pump | `tools/play-pump.mjs` | `earned-pump.save.json` | `dist-pump-beta` |
| 09-uphill | `tools/play-uphill.mjs` | `earned-uphill.save.json` | `dist-uphill-input` |
| 10-gallery | `tools/play-gallery.mjs` | `earned-gallery.save.json` | `dist-gallery-resume-beta` |

All receive `--no-build --out <stage-directory> --dist <supplied-immutable-runtime>`. Stages after Grant receive `--save <preceding-new-output>`. Pump, uphill and Gallery also receive `--active-heavy-jobs 0`. No recovery or resume flags are used. The original rootsnare/fight checkpoint Gallery adapter remains available for its historical chapter proof.

Each completed stage has a hashed passing record with its actual replay, runner, transitive tools helper imports, output and audit results. Later gates recursively verify these records back to Begin. Missing, modified, mixed-attempt or failed evidence stops the chain. Existing historical hash gates remain active outside this mode. The adapter runs the existing Copper, Gold, Echo, Pump, uphill and Gallery audits without changing their reward or preservation assertions.

The final report remains failed unless all ten stages and their audits pass. Its ending must have exactly keystones 1 and 2, Gallery complete, later farm/vault quests incomplete and Rootworks untouched. A failure keeps its report and stage evidence and starts no later stage.

## Resume a failed attempt

Keep the failed report and partial stage output. Use a new empty output directory and add `--resume-report <failed-chain/report.json>` to the same runtime/preflight invocation. Do not combine this option with `--grant-output`.

The adapter rechecks the contiguous passing stage prefix back to Begin, all actual evidence and helper hashes, current product source and the identical runtime manifest. It retains the original attempt id, links the old stage records unchanged and starts at the first unfinished stage. An incomplete stage restarts from the preceding accepted raw output. No intermediate checkpoint from the failed stage is substituted. A running attempt can resume only after its recorded owner has exited.

For example, after a failed Greywood stage:

```sh
PLAY_PORT=5838 bun tools/play-beta.mjs \
  --out .artifacts/beta-final/attempt-01/retry-01 \
  --resume-report .artifacts/beta-final/attempt-01/chain/report.json \
  --runtime dist-grantday \
  --runtime-manifest .artifacts/beta-final/attempt-01/runtime-manifest.json \
  --preflight .artifacts/beta-final/attempt-01/preflight.json \
  --active-heavy-jobs 0
```

## Verify retained proof

```sh
bun tools/play-beta.mjs --verify-report .artifacts/beta-final/attempt-01/chain/report.json
```

This verifies all ten stage records, the exact input/output chain, audit evidence, preflight review, runtime bytes and current product source. It fails if the actual source or any hashed evidence changed. The verifier can consume this result without repeating the long replay. A passing beta report establishes the stated first-half scope only. Retain a final end-to-end full Act 1 replay for the later full release.
