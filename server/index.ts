// The Worker: it serves the built game and routes a world's address to that world's Durable Object.
//
//   /                     the game's files, from dist/ (wrangler.jsonc sends only /world/* here first)
//   /world/<id>           a WebSocket to the world: hello, then inputs up and snaps down
//   /world/<id>/stats     what the world is doing, as JSON. Only with DEV_TOOLS=1.
//   /world/<id>/dev       test tools, by POST. Only with DEV_TOOLS=1.
export { WorldServer } from './world.ts';

const WORLD = /^\/world\/([A-Za-z0-9_-]{1,64})(\/stats|\/dev)?$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const match = WORLD.exec(url.pathname);
    // Not a world: the game's files answer, with their own 404 for a file that is not there.
    if (!match) return env.ASSETS.fetch(request);
    const world = env.WORLD.getByName(match[1]);

    if (!match[2]) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('A world is reached over a WebSocket.', { status: 426 });
      return world.fetch(request);
    }

    if (env.DEV_TOOLS !== '1') return new Response('Not found', { status: 404 });
    if (match[2] === '/stats') return Response.json(await world.stats(url.searchParams.has('reset')));
    if (request.method !== 'POST') return new Response('POST a command.', { status: 405 });
    return Response.json(await world.dev(await request.json()));
  },
} satisfies ExportedHandler<Env>;
