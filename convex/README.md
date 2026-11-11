# convex

The database's tables and functions. Convex owns a player's profile, the world list, who may enter each
world, invites, and the backup of a solo save. It does not carry movement or anything else that changes 20
times a second (`docs/architecture.md`).

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
(`VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`). The deployment itself holds two variables, set with
`bunx convex env set`:

| Variable | What it is |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | The Clerk instance's Frontend API URL. `auth.config.ts` trusts tokens from it. |
| `WORLD_SERVER_SECRET` | The secret the world server sends with every card. With none set, the card endpoint refuses everyone. |

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
| `worlds` | A world's card: name, owner, `solo` or `online`, last played, who is in it now | owner |
| `members` | One player who may enter one world. The owner has no row: `worlds.ownerId` says who owns it. | player, or world and player |
| `invites` | A code that lets one player into one world, for a week | code, or world |
| `saves` | The backup of a solo save: which file, its size, when it was saved | owner and slot, world, file |

A solo world lives in its owner's browser. Its card is written when the save is backed up. An online world's
card is written by the world server.

`model/limits.ts` caps every list: 20 worlds owned, 7 members a world, 20 open invites a world, 8 saves a
player, 8 MiB a save.

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

The browser backs up in three steps: `saves.uploadUrl`, a POST of the file to that address, then
`saves.commit` with the file's id. `commit` deletes the file it replaces. A file that is uploaded and never
committed stays in storage. Nothing sweeps those yet.

## Functions

| Function | Kind | Who may call it | What it does |
|---|---|---|---|
| `profiles.ensure({ name? })` | mutation | signed in | Makes the caller's profile on the first sign-in and returns `{ _id, name }` |
| `profiles.me()` | query | signed in | The caller's profile, or null |
| `profiles.rename({ name })` | mutation | has a profile | Changes the caller's name |
| `worlds.list()` | query | signed in | The caller's worlds, owned and joined, last played first |
| `worlds.create({ name })` | mutation | has a profile | Makes an online world the caller owns |
| `worlds.mayEnter({ worldId })` | query | anyone | See below |
| `worlds.members({ worldId })` | query | owner or member | Who may enter the world |
| `worlds.removeMember({ worldId, playerId })` | mutation | owner | Takes a member out |
| `worlds.leave({ worldId })` | mutation | member | The caller leaves |
| `worlds.remove({ worldId })` | mutation | owner | Deletes the world, its members, invites and backup |
| `invites.create({ worldId })` | mutation | owner, online world | Returns `{ inviteId, code, expiresAt }` |
| `invites.forWorld({ worldId })` | query | owner | The world's invites |
| `invites.revoke({ inviteId })` | mutation | owner | Deletes an invite |
| `invites.accept({ code })` | mutation | has a profile | The caller becomes a member |
| `saves.uploadUrl()` | mutation | has a profile | An address to POST one file to |
| `saves.commit({ storageId, slot, name, savedAt, day })` | mutation | has a profile | Makes the file the caller's backup for `slot` |
| `saves.mine({ slot })` | query | has a profile | The caller's backup for `slot`, or null |
| `saves.downloadUrl({ worldId })` | query | owner | An address to fetch the backup from |
| `worlds.writeCard` | internal mutation | `http.ts` only | Writes an online world's card |

## For the world server

The world server calls Convex twice. Both shapes are tested in `worlds.test.ts` and `http.test.ts`, and were
called on the dev deployment with `curl`.

### 1. May this player enter? `worlds.mayEnter`

A public query. Call it with the player's own Clerk session token, the one the browser showed when it
opened the connection. The answer is about the player who holds that token.

With the Convex client:

```ts
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const convex = new ConvexHttpClient(env.CONVEX_URL);   // https://valiant-spider-493.convex.cloud
convex.setAuth(playerToken);
const answer = await convex.query(api.worlds.mayEnter, { worldId });
```

Or over HTTP, with no package:

```
POST {CONVEX_URL}/api/query
Authorization: Bearer <the player's Clerk session token>
Content-Type: application/json

{ "path": "worlds:mayEnter", "args": { "worldId": "<world id>" }, "format": "json" }
```

The answer is `{ "status": "success", "value": <answer> }`, where the answer is one of:

```ts
{ allowed: true, role: 'owner' | 'member', playerId: string, playerName: string, worldName: string, kind: 'solo' | 'online' }
{ allowed: false, reason: 'signedOut' | 'notAllowed' }
```

- `worldId` is a plain string. A string that is no world's id is answered `notAllowed`. It does not throw.
- `notAllowed` covers three cases with one answer: no such world, a player who is neither owner nor member,
  and a player who has signed in but has no profile yet.
- `signedOut` means the request carried no token.
- A token Convex cannot read or does not trust is not answered at all. The HTTP call returns a non-200
  status with `{ "code": "InvalidAuthHeader", ... }` and the client throws. Treat both as a refusal.
- `playerId` is the player's `profiles` id. Use it in `playersNow` below.
- The owner of a `solo` world is allowed. The world server decides what to do with a solo world.

### 2. Post a world's card: `POST /world-server/card`

An HTTP action on the deployment's site address, `VITE_CONVEX_SITE_URL` in `.env.local`
(`https://valiant-spider-493.convex.site`).

```
POST {CONVEX_SITE_URL}/world-server/card
Authorization: Bearer <WORLD_SERVER_SECRET>
Content-Type: application/json

{
  "worldId": "<world id>",
  "lastPlayedAt": 1794398400000,
  "playersNow": ["<playerId>", "<playerId>"],
  "name": "Hollow Oak"
}
```

| Field | Needed | What it is |
|---|---|---|
| `worldId` | yes | The world's id, a string |
| `lastPlayedAt` | yes | Milliseconds since 1970. Convex keeps the later of this and what it has. |
| `playersNow` | yes | The `playerId` of everyone in the world now, at most 64. Send `[]` when the world goes to sleep. A repeat is dropped. |
| `name` | no | A new name for the card. Left out, the name stays. |

Each post replaces `playersNow` whole. The world list in every member's menu updates by itself.

| Status | Body | When |
|---|---|---|
| 200 | `{ "ok": true }` | The card was written |
| 400 | `{ "error": "badJson" }` | The body is not JSON |
| 400 | `{ "error": "badCard" }` | A field is missing or of the wrong kind |
| 400 | `{ "error": "badPlayer" }` | An entry of `playersNow` is not a profile's id |
| 400 | `{ "error": "badName" }` | `name` is empty once trimmed |
| 401 | `{ "error": "unauthorized" }` | The secret is missing or wrong |
| 404 | `{ "error": "noWorld" }` | No world has that id |
| 409 | `{ "error": "soloWorld" }` | The world is a solo world, whose card its owner's browser writes |
| 503 | `{ "error": "notConfigured" }` | `WORLD_SERVER_SECRET` is not set on the deployment |

The secret is in `.env.local` as `WORLD_SERVER_SECRET` and on the Convex deployment under the same name. The
world server needs the same value in its own settings.

## Not built yet

- A picture on the card. `docs/architecture.md` lists one.
- Friends. Invites are codes for now, so they need no friend list.
- Turning a solo world into an online one. The backup is where the world server would read the save from.
- A limit on how often one player may upload, and a sweep for files that were uploaded and never committed.
