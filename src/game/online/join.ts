// Which online world this page opens, read from its address.
//
//   /?world=<id>                  the world with that id, as the signed-in player
//   /?world=<id>&dev=<name>       the same with a dev token, for a world server that takes them (wrangler dev)
//   &server=<host:port>           a world server other than the one that served the page, as when the game
//                                 runs on Vite and the world server on wrangler dev
//
// Without `world` the page is solo play, as it always was.

/** A world's id on the world server: 1 to 64 letters, digits, `_` or `-`, as server/index.ts takes it. */
const WORLD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DEV_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

export interface Join {
  world: string;
  /** The dev name, when the address gave one. */
  dev: string | null;
  /** The world's WebSocket address. */
  url: string;
}

export function readJoin(search: string, location: { protocol: string; host: string }): Join | null {
  const params = new URLSearchParams(search);
  const world = params.get('world');
  if (!world || !WORLD_ID.test(world)) return null;
  const dev = params.get('dev');
  const server = params.get('server');
  const host = server && HOST.test(server) ? server : location.host;
  const secure = server ? !/^(localhost|127\.|\[::1\])/.test(server) && location.protocol === 'https:' : location.protocol === 'https:';
  return { world, dev: dev && DEV_NAME.test(dev) ? dev : null, url: `${secure ? 'wss' : 'ws'}://${host}/world/${world}` };
}

/** A dev token for a name: `dev:<id>:<Name>`, so the others see the name with a capital. */
export function devToken(name: string): string {
  return `dev:${name.toLowerCase()}:${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The address of this page with the online world taken out: the same game, solo. */
export function soloAddress(href: string): string {
  const url = new URL(href);
  for (const key of ['world', 'dev', 'server']) url.searchParams.delete(key);
  return url.toString();
}

/** The address that opens an online world, for a link to copy. */
export function worldAddress(origin: string, world: string): string {
  return `${origin}/?world=${encodeURIComponent(world)}`;
}
