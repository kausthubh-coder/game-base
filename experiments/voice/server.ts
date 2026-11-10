// The voice experiments' local server: the pages, their audio, and the two live pipelines.
//   bun --env-file=.env.local experiments/voice/server.ts [port]      (5381 by default; it prints its pid)
// The ElevenLabs key stays in this process. The browser only talks to this server.
//
//   /            links to both pages
//   /scene       experiment A: the voiced scene
//   /talk        experiment B: talk to Tamsin (B1 realtime, B2 text model + ElevenLabs)
//   /audio/...   the made-ahead clips      /assets/...   the game's public assets
//   POST /api/stt          speech to text (ElevenLabs Scribe), the recorded words as the body
//   WS   /ws/b1            the realtime call bridge         WS /ws/b2   the text-and-voice pipeline
import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { ServerWebSocket } from 'bun';
import home from './index.html';
import scene from './scene/index.html';
import talk from './talk/index.html';
import { transcribe } from './lib/eleven.ts';
import { RealtimeBridge } from './talk/b1.server.ts';
import { TextVoice } from './talk/b2.server.ts';
import { MOMENTS, type GameState } from './talk/tamsin.ts';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5381);
const HERE = import.meta.dir;
const PUBLIC = join(HERE, '../../public');

/** A file under `root`, or null when the path leaves it or does not exist. */
function fileUnder(root: string, path: string): Response | null {
  const full = normalize(join(root, decodeURIComponent(path)));
  if (!full.startsWith(root) || !existsSync(full)) return null;
  return new Response(Bun.file(full), { headers: { 'cache-control': 'no-store' } });
}

interface Socket {
  kind: 'b1' | 'b2';
  b1?: RealtimeBridge;
  b2?: TextVoice;
  /** Turns are run one at a time. */
  queue: Promise<void>;
}

const stateOf = (moment: unknown): GameState => (MOMENTS[String(moment)] ?? MOMENTS.stone).state;

const server = Bun.serve<Socket>({
  port: PORT,
  hostname: '127.0.0.1',
  development: { hmr: false, console: false },
  idleTimeout: 120,
  routes: {
    '/': home,
    '/scene': scene,
    '/talk': talk,
    '/audio/*': (req: Request) => fileUnder(join(HERE, 'audio'), new URL(req.url).pathname.slice('/audio/'.length)) ?? new Response('not found', { status: 404 }),
    '/backdrops/*': (req: Request) => fileUnder(join(HERE, 'scene/backdrops'), new URL(req.url).pathname.slice('/backdrops/'.length)) ?? new Response('not found', { status: 404 }),
    '/assets/*': (req: Request) => fileUnder(join(PUBLIC, 'assets'), new URL(req.url).pathname.slice('/assets/'.length)) ?? new Response('not found', { status: 404 }),
    '/api/stt': {
      async POST(req: Request) {
        const t0 = performance.now();
        try {
          const { text } = await transcribe(await req.blob(), 'scribe_v2');
          return Response.json({ text, ms: Math.round(performance.now() - t0) });
        } catch (e) {
          return Response.json({ error: String((e as Error).message) }, { status: 502 });
        }
      },
    },
  },
  fetch(req, srv) {
    const { pathname } = new URL(req.url);
    if (pathname === '/ws/b1' || pathname === '/ws/b2') {
      if (srv.upgrade(req, { data: { kind: pathname.endsWith('b1') ? 'b1' : 'b2', queue: Promise.resolve() } })) return;
      return new Response('upgrade failed', { status: 400 });
    }
    return new Response('not found', { status: 404 });
  },
  websocket: {
    open(ws) {
      if (ws.data.kind === 'b1') {
        const b1 = new RealtimeBridge((m) => ws.send(JSON.stringify(m)));
        ws.data.b1 = b1;
        b1.start().catch((e) => ws.send(JSON.stringify({ type: 'status', status: 'error', message: String(e.message) })));
      }
    },
    message(ws, raw) {
      const msg = JSON.parse(String(raw));
      if (ws.data.kind === 'b1') return onB1(ws, msg);
      onB2(ws, msg);
    },
    close(ws) {
      ws.data.b1?.stop();
      ws.data.b2?.close();
    },
  },
});

function onB1(ws: ServerWebSocket<Socket>, msg: any): void {
  const b1 = ws.data.b1!;
  const fail = (e: Error) => ws.send(JSON.stringify({ type: 'status', status: 'error', message: e.message }));
  if (msg.type === 'offer') b1.offer(msg.sdp, stateOf(msg.moment), msg.voice).catch(fail);
  else if (msg.type === 'say') b1.say(msg.text).catch(fail);
}

function onB2(ws: ServerWebSocket<Socket>, msg: any): void {
  const send = (m: object) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  if (msg.type === 'start') {
    ws.data.b2?.close();
    const b2 = new TextVoice(msg.model, msg.tts);
    ws.data.b2 = b2;
    const t0 = performance.now();
    ws.data.queue = b2
      .start(stateOf(msg.moment))
      .then(() => void send({ type: 'ready', ms: Math.round(performance.now() - t0), model: b2.textModel.model, tts: b2.ttsModel }))
      .catch((e) => void send({ type: 'error', message: String(e.message) }));
    return;
  }
  if (msg.type === 'say') {
    const b2 = ws.data.b2;
    if (!b2) return void send({ type: 'error', message: 'not started' });
    ws.data.queue = ws.data.queue.then(() =>
      b2.turn(
        String(msg.text).slice(0, 600),
        (e) => {
          if (e.type === 'audio') {
            // Binary frame: 1 byte of turn id, 1 byte of sentence index, then 16-bit PCM at 24 kHz.
            const frame = new Uint8Array(2 + e.pcm.length);
            frame[0] = msg.turn & 0xff;
            frame[1] = e.index & 0xff;
            frame.set(e.pcm, 2);
            if (ws.readyState === 1) ws.sendBinary(frame);
          } else void send({ ...e, turn: msg.turn });
        },
        msg.voice !== false,
      ),
    );
  }
}

console.log(`voice experiments on http://localhost:${server.port}/  pid ${process.pid}`);
