# Net

The browser's connection to a world server: connect, say hello, send numbered inputs, hand out snaps,
and connect again after a drop. It draws nothing and predicts nothing. `server/README.md` describes the
messages and the server.

## Wiring

Nothing in the game uses it yet. This is how the shell would:

```ts
import { createNet } from './features/net/index.ts';

const net = createNet(ctx, {
  url: `wss://${location.host}/world/${worldId}`,
  token: () => freshToken(),                           // the token the browser shows Convex, asked again on every try
});
net.onSnap((snap) => { /* lay snap.chunks and snap.blocks over the world, read snap.you and snap.ack */ });
net.onState((state) => { if (state === 'refused' && net.refusal?.why === 'reload') location.reload(); });
net.connect();

// every frame
net.update(dt, ctx);                                   // counts the wait before a reconnect

// every kernel step, 20 a second, also while the player stands still
const n = net.send({ mx, mz, jump, acts });            // 0 when the connection is not open
```

`net.near` holds the other players, the creatures and the placed things in range, added up from the snaps.

## States

| State | Meaning |
|---|---|
| `idle` | Before `connect()` |
| `connecting` | From opening the socket to the server's welcome |
| `open` | Inputs go up and snaps come down |
| `waiting` | Between a drop and the next try. `retryIn` counts down: 0.5 seconds, then 1, 2, 4, 8 |
| `refused` | The server said no. `refusal.why` is `reload`, `token`, `closed`, `full` or `hello`. It does not try again by itself |
| `closed` | After `close()`, or when the same player connected from another tab |

It keeps no timers. `update(dt)` counts the wait before a reconnect, and drops an open connection that
has been silent for 5 seconds, which is how a dead wifi line looks.

## Options

| Option | What it is |
|---|---|
| `url` | The world's address, `wss://<host>/world/<id>` |
| `token` | Returns the player's token, or a promise of it |
| `build` | The build to say hello with. `BUILD` from `src/engine/net/version.ts` when left out |
| `codec` | How messages become bytes. JSON when left out |
| `socket` | Opens a socket. The page's `WebSocket` when left out. A test passes a plain object |
| `retryFirst`, `retryMax`, `quietFor` | Seconds: 0.5, 8 and 5 when left out |
