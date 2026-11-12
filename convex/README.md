# convex

The database's tables and functions. Convex owns a player's profile and the copy of their save that follows
them between devices (`src/features/account/README.md`). The game itself runs in the browser.

Before you change a file here, read `_generated/ai/guidelines.md`. It holds Convex's current rules, and they
differ from older Convex code.

## Commands

| Command | What it does |
|---|---|
| `bunx convex dev --once` | Type-checks the functions and pushes them to the dev deployment |
| `bunx convex dev` | The same, again on every change |
| `bunx vitest run --root convex` | The tests, in memory, with no deployment |
| `bunx convex env list` | The names of the deployment's environment variables |

The tests run in Vitest and not in `bun test`, because `convex-test` needs the edge runtime that Convex
functions run in. `bun run check` does not run them.

## Deployment

The Convex project is `game-base` in the team `kausthubh-nandimandalam`. The dev deployment is
`valiant-spider-493`. The production deployment is `rare-lion-700`: the live copy of the game uses it, and
GitHub deploys to it on every push to `main` (the `ship-game` skill).

`.env.local` at the repo root names the deployment (`CONVEX_DEPLOYMENT`) and gives the browser its address
(`VITE_CONVEX_URL`). The deployment itself holds one variable, set with `bunx convex env set`:

| Variable | What it is |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | The Clerk instance's Frontend API URL. `auth.config.ts` trusts tokens from it. |

## Signing in

Clerk signs the player in. The browser hands Convex Clerk's session token, and `auth.config.ts` accepts a
token whose issuer is `CLERK_JWT_ISSUER_DOMAIN` and whose `aud` claim is `convex`. Clerk's Convex integration
puts that claim on the session token. On the dev instance it was set from the command line, which does what
the dashboard's "Activate Convex integration" button does:

```
bunx clerk@latest config patch --json '{"session":{"claims":{"aud":"convex"}}}'
```

Every public function takes the player from `ctx.auth`, through `requireIdentity` or `requirePlayer` in
`model/auth.ts`. No function takes a player id as an argument to decide who is asking. A refused call throws
a `ConvexError` whose `data.code` says why: `signedOut`, `noProfile`, `notFound`, `forbidden`, and the others
listed in `model/auth.ts`.

## Tables

| Table | One row is | Found by |
|---|---|---|
| `profiles` | A player: their name, and who Clerk says they are | `tokenIdentifier` |
| `saves` | The account's copy of one save: which file, its size, when it was saved, the day | owner and slot, file |

`model/limits.ts` caps every list: 8 saves a player (the game's own and its test scenes'), 8 MiB a save.

## Why the save is a file

Measured on 2026-11-11. The headless harness (`src/game/play`) played the first part of the game, and the
save file was measured as `src/game/shell/save.ts` writes it.

| Save | Size |
|---|---|
| A new game | 5.3 KB |
| The end of the first part, 33 blocks changed | 9.4 KB |
| 5,000 blocks changed | 41 KB |
| 50,000 blocks changed | 376 KB |
| 200,000 blocks changed | 1.47 MB |

A changed block costs about 7.3 bytes. A Convex document holds 1 MiB, which a save passes at about 140,000
changed blocks. A Convex array holds 8,192 values, which one chunk's list passes at 4,096 changed blocks. So
the save goes to Convex file storage as one JSON file, and the `saves` row holds only its id and size.

The browser sends a save in three steps: `saves.uploadUrl`, a POST of the file to that address, then
`saves.commit` with the file's id. `commit` deletes the file it replaces. A file that is uploaded and never
committed stays in storage. Nothing sweeps those yet.

## Functions

| Function | Kind | Who may call it | What it does |
|---|---|---|---|
| `profiles.ensure({ name? })` | mutation | signed in | Makes the caller's profile on the first sign-in and returns `{ _id, name }` |
| `profiles.me()` | query | signed in | The caller's profile, or null |
| `profiles.rename({ name })` | mutation | has a profile | Changes the caller's name |
| `saves.uploadUrl()` | mutation | has a profile | An address to POST one file to |
| `saves.commit({ storageId, slot, savedAt, day, over })` | mutation | has a profile | Makes the file the caller's save for `slot`. `over` is the `savedAt` of the copy it replaces, or null; when the copy there is another one, the file is deleted and the answer is `{ ok: false, reason: 'stale', savedAt }`. |
| `saves.mine({ slot })` | query | has a profile | The caller's save for `slot`: bytes, `savedAt`, `uploadedAt`, day. Null when there is none. The browser watches it. |
| `saves.downloadUrl({ slot })` | query | has a profile | An address to fetch the caller's save for `slot` from |

## Not built yet

- Deleting a save from the account. A new game replaces it.
- A limit on how often one player may upload, and a sweep for files that were uploaded and never committed.
