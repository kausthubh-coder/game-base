# Beta startup diagnosis

Preparation PASS, measurement ISSUES. The source trace is complete enough to scope a small patch. No startup improvement or speedup has been measured. Browser verification remains for the coordinator's later measurement slot.

This report inspects branch `act1` at `4d85ec78e2a0d50ed1d966cbd970821e670ea57d`, on 2026-11-16. Source files may change after that checkpoint. The only executed computation was a pure manifest inventory using the game's parser. No browser, build, simulation, server, install, cloud operation, cleanup or full check ran. The protected `dist-mobile-6685bcf3` and `dist-gallery-resume-hud` preview, PID 92343 on port 5796, were not touched.

## What startup actually waits for

| Order | Work and dependency | Source |
|---|---|---|
| Page | Inline loading status appears; cache and main module scripts start. Production packaging inserts preloads for all startup images, painted textures and two fonts. | `index.html:13`, `index.html:19`, `tools/asset-build.mjs:99` |
| Script | Boot eagerly imports every `views/*.view.ts` module. A conditional install does not defer the module's own import graph. | `src/game/boot.ts:11` |
| Shell | Creates the WebGL renderer, reads settings, then awaits `loadArt`. Clean settings use sprite characters; auto quality starts high. | `src/game/shell/game.ts:100`, `src/game/shell/game.ts:120`, `src/game/shell/game.ts:138`, `src/game/shell/game.ts:150` |
| Manifest images | Fetch and parse manifest, collect unique image filenames, then fetch/decode/read pixels for all of them concurrently. Validate sheets and build typed results afterward. | `src/features/assets/assets.view.ts:170`, `src/features/assets/assets.view.ts:271`, `src/features/assets/assets.view.ts:286`, `src/features/assets/assets.view.ts:307` |
| Block art | Load the block atlas again as an Image and decode it, then decode the materials image and paint the replacement tiles. Reusing a URL may avoid transfer but does not eliminate this second image/decode path. | `src/game/shell/art.ts:30`, `src/game/shell/art.ts:39`, `src/features/world/atlas.view.ts:302` |
| Shell construction | Creates world, systems, scene objects, sprite drawing and interface roots. This occurs after the image progress callback has reached its final count. | `src/game/shell/game.ts:150`, `src/game/shell/game.ts:198` |
| View installation | Awaits each install in alphabetical filename order. An install error is logged and skipped, so successful boot does not prove every required view installed. | `src/game/boot.ts:30` |
| Conditional models | `core-actors` awaits the full cast only with model characters. Cast model files load sequentially through a loop. Default sprites avoid that path. Block-world trees await their model list; default painted mode skips it. | `src/game/views/core-actors.view.ts:54`, `src/game/shell/art.ts:162`, `src/game/shell/art.ts:186`, `src/game/views/world-trees.view.ts:89` |
| Painted world | Fetches the discovery manifest again, awaits all painted textures, then constructs its scene. Texture downloads start together; missing textures receive code-drawn stand-ins. | `src/game/views/world-painted.view.ts:57`, `src/features/painted/textures.ts:210`, `src/features/painted/textures.ts:258` |
| Title ready | Title holds game start. Boot exposes the debug door and schedules the first RAF. Only after boot resolves does main remove the loading node. Loading removal precedes the actual first render callback; it is not itself proof of a presented frame. | `src/game/views/ui-title.view.ts:26`, `src/game/boot.ts:42`, `src/game/shell/game.ts:807`, `src/main.ts:15` |
| Title background | Shader warming starts after three empty mesh-queue frames. Starting sooner synchronously finishes shader warming. Audio engine preparation is scheduled while held at the title. | `src/game/views/core-perf.view.ts:63`, `src/game/shell/game.ts:809` |
| Begin | The title's action marks a session-storage choice, then starts the game. The opening listener consumes that mark. Fresh plus chosen plus no opening flag is required to play the film. | `src/game/uiview/book.ts:98`, `src/game/uiview/opening.ts:132`, `src/game/views/story-opening.view.ts:213` |
| Film first frame | Pause the game, place hero at Saltgate, import film/renderer/sound modules, await soundtrack creation, create film, load first two shots, then play. Remaining shot art loads in the background. | `src/game/views/story-opening.view.ts:141` |
| Soundtrack barrier | Soundtrack creation fetches and decodes every clip in the selected voice take and every film sound effect with Promise.all. This completes before the first two visual shots are requested through renderer.load. | `demos/opening/sound/index.ts:64`, `src/game/views/story-opening.view.ts:162` |
| World control | Film end or skip sets story progress, unpauses, clears busy, settles the book, and fades/removes the overlay. Real control also requires nearby chunks before the shell steps the hero. | `src/game/views/story-opening.view.ts:185`, `src/game/shell/game.ts:554` |

Town models load on proximity with stand-ins, rather than an awaited install barrier (`src/game/views/world-town.view.ts:237`, `src/game/views/world-town.view.ts:317`). Recorded game audio waits for afterGameFrame, then fetches/decode samples with four workers (`src/game/views/core-sound.view.ts:25`). Those requests may overlap the real opening film once the game is started. Account imports are lazy (`src/game/views/ui-account.view.ts:32`). None of those should be counted as image progress.

The architecture document is explicitly a proposal. Regional starter packs and streaming described there must not be presented as the current startup implementation. The current loader waits for all wanted images, not a Saltgate-only pack. The older byte figures in `docs/fast-everywhere.md` are historical, not measurements of this checkpoint.

## What the percentage means

The denominator is `wantedFiles(parseManifest(manifest)).size + 1`. The manifest contributes one completed file. Each unique wanted image contributes one completed file after fetch, image decode and canvas pixel extraction. Failed image attempts also increment the count before the final aggregated rejection. See `src/features/assets/assets.view.ts:288` through `:304`.

The pure source inventory at this checkpoint returned 95 unique images and a denominator of 96. This is a file count, not bytes or elapsed work. `wantedFiles` includes all listed sprites, blocks, icon sheets, other tile sheets and simple image groups. It excludes the special uikit and model/audio/painted-texture records (`src/features/assets/manifest.ts:229`, `:259`). Atlas validation, second block-image decode, world construction, model loads, painted textures, view installation and first rendering are outside that denominator.

`loadArt` forwards loaded/total directly to main (`src/game/shell/art.ts:32`). Main rounds it into `Loading N%` (`src/main.ts:12`). It can display 100% while later work continues, or just before a file failure is reported. No phase or byte denominator reaches main today.

Reproduce the source inventory without starting anything:

```sh
cd /Users/dabot/.t3/worktrees/game-base/act1
bun -e 'import {parseManifest,wantedFiles} from "./src/features/assets/manifest.ts"; const m=await Bun.file("public/assets/manifest.json").json(); const f=[...wantedFiles(parseManifest(m)).keys()]; console.log(JSON.stringify({images:f.length,total:f.length+1,files:f},null,2));'
```

## Failure and retry behavior

| Path | Current behavior | Small patch |
|---|---|---|
| Manifest or required image failure | Manifest throws immediately; images finish all attempts and aggregate failures. No explicit timeout, cancellation or retry. Main logs the error and puts raw exception text into the loading status. | Show a short recoverable message and keyboard-accessible Reload button. Keep full diagnostic details in console. Reload the document rather than invoking boot again over partially created systems and listeners. Preserve saves. |
| View installation failure | Boot logs console.error and continues. Loading disappears even if a required scene failed. | Audit must count console errors as failures. Decide explicitly which beta views are required before changing runtime fatality rules. |
| Painted texture failure | Uses a code-drawn stand-in after decode rejection. An indefinitely pending request still has no app deadline. | Record stand-ins separately. Do not label fallback success as a full-art baseline. |
| Film load failure | Catch logs error and calls end, allowing grant day to continue. Later art errors only warn; film waits at unavailable next shots. | Test first-shot failure and later-shot failure separately. Do not count skipped/failed film as fast film-ready. A later-shot retry/skip policy needs browser validation. |
| SW registration failure | Logs a warning; normal network loading remains. | Treat cache-unavailable as a separate run condition. Keep startup usable. |

Source: `src/features/assets/assets.view.ts:170`, `:280`, `:294`; `src/main.ts:17`; `src/game/boot.ts:36`; `src/features/painted/textures.ts:210`; `src/game/views/story-opening.view.ts:178`, `:274`; `src/features/assets/cache.ts:28`.

The lean loading presentation should use the existing visual language and require no new art download. Keep the existing `role="status"`, add an explicit atomic status, and announce phase changes rather than every image completion. Suggested truthful labels are "Loading game files", "Preparing the world", then title. If an image counter remains, label it "Game images X of Y" and switch to an indeterminate preparation state when images complete. Do not reserve arbitrary percentage bands for unknown work. Show "Preparing the opening" after Begin, with a working skip action, until the film can draw. Keep visible focus, legible contrast and reduced-motion support. Error action should have an accessible name and receive deliberate focus when failure replaces loading. `index.html:19` already has role=status, so adding a status role alone fixes nothing.

## Cache facts

Production packaging fingerprints assets, losslessly converts eligible PNGs to WebP only after exact pixel equality, writes one stable discovery manifest, and emits no-cache default headers plus immutable fingerprint headers (`tools/asset-build.mjs:46`, `:65`, `:79`). Fonts have separate URLs and preloads. Do not infer their header treatment from the fingerprint rule.

SW registration starts after loading removal and another RAF, only in production. Automation disables it unless `?sw` is supplied. `?nosw` unregisters matching asset workers and deletes game-assets caches asynchronously (`src/features/assets/cache.ts:19`). That deletion is not awaited by main, so use fresh contexts for cache-disabled runs rather than toggling a warm page and calling it cold.

The worker uses shared `game-assets-v1`, immediately activates, enables navigation preload, claims clients, and caches only same-origin fingerprinted GET requests. Navigation is network/preload and stable manifest is outside its cache-first path. Cache-write quota failures leave network responses usable. Remember messages copy already requested resources into the cache. Keeping the same cache across content versions permits reuse but also retains obsolete hashed entries; activation only deletes differently named game-assets caches. There is no per-entry eviction here. See `tools/asset-worker.js:1` through `:45`. This is a follow-up storage concern, not evidence that cache pruning will accelerate a cold start.

## Why the existing measurement is insufficient

`tools/load-measure.mjs` is useful for a narrow diagnostic of debug movement and local response-body volume. It cannot support a claim about real new-player startup:

- It hardcodes Mac Chrome and forced SwiftShader, 1280 by 800, automatic autoplay and no network throttling (`:30`, `:34`, `:75`). This does not test the documented 10 Mbps target or a Chromebook.
- It navigates with hold/sw, waits for loading removal and calls the debug door's newGame/key directly (`:51` through `:55`). A fresh context has no title choice marker. The film therefore does not play. This is a bypass, not a film-induced movement timeout.
- Its movement callback proves a rendered RAF after a coordinate change. It does not establish a real keyboard event reached the game, no blocking overlay remained, or a frame was presented on the display (`:36` through `:42`).
- It starts timing at navigation and mixes script/title preparation with synthetic new-game startup. It records no separate Begin timestamp or film-ready timestamp.
- It sums the eventual whole response body for requests whose server start precedes the endpoint (`:18`, `:26`, `:62`). ResourceTiming also filters by request start (`:60`). Those are requests begun by the endpoint, not exact bytes received by the endpoint. An in-flight response may finish later.
- It catches pageerror and HTTP errors but not console.error/warn or requestfailed (`:46` through `:50`). Swallowed install/film errors can produce a successful-looking row.
- It writes all output only after all pairs (`:74`), so a timeout loses partial results. Zero runs can write an empty successful report because there is no argument validation.
- Server listen and browser launch happen before try/finally (`:29` through `:32`). A Chrome launch failure leaves the listening server without that cleanup path. Listen errors lack a rejection handler. Context cleanup occurs only on the successful per-run path; browser cleanup is in finally once launch succeeds. Browser.close throwing also prevents the following server.close. There is no explicit SIGTERM/SIGINT cleanup.
- Waiting for serviceWorker.ready (`:69`) does not prove every remember copy finished. Second visits mix HTTP and service-worker caches and must be named that way. The settled/network-idle tail also warms content beyond the endpoint.

Do not run `tools/load-cache-proof.mjs` for this task. It mutates the hero sprite and rebuilds output (`:20` through `:38`), outside this brief.

No second browser runner was added. The smaller next step is for the coordinator to repair the existing runner once the measurement slot is authorized. A parallel runner would duplicate its gzip server/cache accounting while still requiring real browser validation. This source-only report does not certify any browser tool as ready.

## Smallest next patch

1. Make loading truthful and recoverable in main/index plus a minimal boot phase callback. Keep loaded/total as image counts, then explicitly enter world preparation. Retain console diagnostics and add document reload retry. Do not re-enter boot.
2. Repair the audit before claiming improvement. Add separate real-title and real-Begin modes, marks for the endpoints below, console/network failure capture, incremental result writes and cleanup covering launch failure, context failure and termination. Validate runs/port/folder before starting a server. Record renderer and Chrome version. Use existing launcher conventions rather than hardcoding SwiftShader.
3. Profile one unreported real-Begin run. The all-voice/all-effects decode barrier is the clearest source-backed candidate. If it dominates, prepare only first-shot needs before film playback and load later clips ahead, retaining duration metadata for film timing and an explicit late-clip policy. This requires an intentional change to soundtrack readiness; deleting the await without changing that contract risks missing dialogue. Keep the opening intact.
4. Only after the trace, consider avoiding repeated block/material image decodes or reducing wantedFiles to actual startup consumers. Do not delete apparently unused sprites without tracing synchronous sprite/icon lookups and fallback needs. Default model deferral is already in place for characters, so changing it cannot explain a default-sprite improvement.

Regional packs, alternate loading artwork, redesigning the title, global asset streaming, and cache eviction experiments stay deferred. None is needed to correct misleading progress or measure the first opening frame.

## Pre/post measurement recipe for the later slot

Use production builds from frozen source checkpoints, same Chrome version, renderer, viewport, quality, character mode, seed, origin policy and network settings. Save build/source hashes and the actual settings with every result. Keep the immutable mobile runtime as a historical input; do not rebuild over it. Use fresh dedicated before/after build directories and a coordinator-reserved port, never 5796.

The future repaired runner should record these endpoints independently:

| Endpoint | Required evidence |
|---|---|
| Title ready | Loading removed, title Begin/New game action visible and enabled, then a completed game render callback. Keep the title screenshot. |
| Opening ready | Real title action sets the choice marker; visible film overlay, first shot canvas actually drawn, wait indicator cleared. Store both navigation-relative and action-relative time. Audio fetch alone or hidden canvas is insufficient. |
| World control | Explicitly record whether film played fully or was skipped. Wait for overlay removal, started=true, paused=false and busy=false, then send actual keyboard events and show horizontal displacement plus the next game render. Store state and screenshot. Separate planned film duration from loading delay. |
| Resume | Separate Continue path with an identified local-save fixture. Never combine it with fresh-game samples or cloud saves. |

Start with one smoke pair and a bounded endpoint deadline. If real Begin fails or needed scene/audio falls back, retain the failure and stop tuning. Do not silently discard failed rows. Capture requestfailed, pageerror, HTTP status failures and console errors, plus warnings/fallbacks. Enforce no-film-bypass with a visible opening assertion and a completed first-shot draw before accepting opening-ready. A full proof run must also exercise keyboard skip and pointer skip, failed asset/reload retry, and reduced motion.

For each side, collect at least five cold/warm pairs, alternating A then B then A then B. Each cold visit uses a fresh context with no save, settings, session mark, HTTP cache or SW cache. The warm visit reuses that context on the same origin only after worker control and pending cache-copy work have completed; label it combined HTTP/SW warm. If cache-copy completion cannot be observed, report the warm case as unsettled rather than treating serviceWorker.ready as sufficient. Reset the gameplay save and film-seen state intentionally when the warm case is a second fresh Begin; record those resets. Test real Continue separately.

Collect network data for navigation-to-title, action-to-opening and action-to-control. Report response bodies for requests started in each interval separately from completed response bytes. True transferred bytes by endpoint need Network.dataReceived/loadingFinished event accounting, correlated across worker requests, not eventual server body sizes. Include resource timing, decoded sizes, cache source and failures. Keep profiler/tracing runs separate from reported latency runs.

Run the 10 Mbps condition with explicitly recorded latency, throttling mechanism and CPU/device settings. Local unthrottled Mac data can compare implementation paths but cannot establish target-device readiness. Check host load and active work first. If busy work cannot pause, interleave sides and report that noise. Report medians and ranges plus failures per endpoint. A gap inside run variation is no measurable difference. A speedup claim also needs a trace that identifies the limiter.

These commands are for the coordinator after authorization, not commands executed in this task:

```sh
cd /Users/dabot/.t3/worktrees/game-base/act1
uptime
sysctl -n hw.logicalcpu
git rev-parse HEAD
git status --short
```

The existing runner can only provide its narrow legacy diagnostic. On an independently prepared, immutable production directory, with a separately reserved unused port, the exact command is:

```sh
LOAD_BUILD=/absolute/path/to/dedicated-production-build
LOAD_AUDIT_PORT=5889 # replace with the coordinator's confirmed reserved port
bun tools/slot.mjs --look -- bun tools/load-measure.mjs --folder "$LOAD_BUILD" --port "$LOAD_AUDIT_PORT" --runs 1 --out .artifacts/beta-loading/legacy-diagnostic.json
```

Do not call that a pre/post benchmark or run the five-run version before fixing cleanup and endpoint semantics. There is no existing command that measures the real three endpoints correctly. New runner flags should be documented only when implemented and smoke-tested, not invented in this recipe.

## Safe source snapshot inputs

Tracked `.artifacts` entries exist in this checkout. Git ignore rules do not exclude tracked files from `git archive HEAD`. The reported accidental historical-evidence duplication is a reason to whitelist input paths, not to archive the whole repository and delete evidence afterward. This task did not measure that archive's size.

For a production Vite build only, the bounded dependency whitelist is:

```text
index.html
package.json
bun.lock
tsconfig.json
vite.config.ts
src/
public/
demos/opening/
convex/_generated/
tools/asset-build.mjs
tools/asset-worker.js
```

`src` contains worker entrypoints, CSS and imported art. Include `convex/_generated/`: `src/features/account/session.ts:11` imports its runtime `api.js`, and line 12 imports its data-model type. The mobile snapshot previously failed when this dependency was omitted. `public` contains manifest, models, textures, fonts and other shipped files. `demos/opening` is required even though its name says demo: the game imports its title/mural art, film, renderer and soundtrack. Vite config imports asset-build, which reads asset-worker; its parser import is within src. Evidence includes `src/game/views/story-opening.view.ts:14`, `:156`, `src/game/openingview/saltgate.ts:7`, `vite.config.ts:2`, `tools/asset-build.mjs:6`, `:73`. Build-time dependency modules come from the pinned Bun lock/install, not an archive of node_modules.

Preview the whitelist without writing an archive:

```sh
git ls-tree -r --name-only HEAD -- index.html package.json bun.lock tsconfig.json vite.config.ts src public demos/opening convex/_generated tools/asset-build.mjs tools/asset-worker.js
```

Later, after choosing a frozen checkpoint and unique destination, use that same explicit path list with `git archive <checkpoint> -- ...`. A committed snapshot excludes uncommitted patches, so first commit the exact product input under review. Exclude `.artifacts`, `.git`, every dist directory, node_modules, env files, credentials, assets-src and unrelated demos/tools. Do not regenerate audio, models or source art for a load comparison. This whitelist covers the production build, not the full regression suite: for example, `src/game/fights/gallery-route.test.ts:5` reads a historical artifact fixture. Supply any required test fixture individually when running that suite instead of expanding the build snapshot to all evidence.

## Verification handoff

The requested worktree, diagnosis, benchmark, correction, module-design and project verification instructions were read. The explicit source-only brief overrides worktree setup/install and verify-game's runtime steps for this preparation task. No product bug is claimed fixed. No new tool or implementation-mirroring test was needed for the documentation-only change. The coordinator must run the applicable verify-game checks and real flow after product/audit changes, including before/after regression checks and a failure/retry play. Baseline preservation, browser proof and target-device performance are still open.
