// The build's version. The browser sends it in its hello, and a world server refuses any browser whose
// build is not its own: the two must run the same rules, or what the browser predicts and what the server
// decides drift apart. The game's files and the world server go up as one deploy, so a browser with
// another build is one that has not reloaded yet.
//
// A build sets `__BUILD__` to the commit it was made from: Vite with `define` in vite.config.ts, the world
// server with `wrangler deploy --define`. With nothing set, as in `bun test` and plain `wrangler dev`, both
// sides are `dev`.

declare const __BUILD__: string | undefined;

export const BUILD: string = typeof __BUILD__ === 'string' && __BUILD__ !== '' ? __BUILD__ : 'dev';
