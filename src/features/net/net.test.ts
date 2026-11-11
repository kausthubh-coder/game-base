// The client against a socket that is a plain object: what it says, what it hands out, and when it tries again.
import { describe, expect, test } from 'bun:test';
import { CLOSE, type ServerMessage, type Snap } from '../../engine/net/messages.ts';
import { createNet, type SocketLike } from './net.ts';

interface FakeSocket extends SocketLike {
  sent: unknown[];
  closed: boolean;
  /** The server speaks. */
  say(message: ServerMessage): void;
  /** The server, or the line, closes it. */
  end(code?: number): void;
}

function fakeSockets(): { open: (url: string) => SocketLike; all: FakeSocket[]; last(): FakeSocket } {
  const all: FakeSocket[] = [];
  return {
    all,
    last: () => all[all.length - 1],
    open() {
      const socket: FakeSocket = {
        onopen: null, onmessage: null, onclose: null, onerror: null,
        sent: [], closed: false,
        send(data) { this.sent.push(JSON.parse(data as string)); },
        close() { this.closed = true; },
        say(message) { this.onmessage?.({ data: JSON.stringify(message) }); },
        end(code = 1006) { this.onclose?.({ code, reason: '' }); },
      };
      all.push(socket);
      return socket;
    },
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const snap = (step: number, more: Partial<Snap> = {}): Snap => ({
  t: 'snap', step, ack: 0, day: 1, time: 0.3,
  you: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, facing: 0, ground: true, water: false },
  ...more,
});
const welcome: ServerMessage = { t: 'welcome', you: 'player:ann', build: 'b1', seed: 1, step: 100 };

async function opened() {
  const sockets = fakeSockets();
  const net = createNet(null, { url: 'ws://test/world/w', token: () => 'dev:ann', build: 'b1', socket: sockets.open });
  net.connect();
  await tick();
  sockets.last().onopen?.({});
  sockets.last().say(welcome);
  return { net, sockets };
}

describe('the net client', () => {
  test('it says hello with its build and its token, and is open after the welcome', async () => {
    const sockets = fakeSockets();
    const states: string[] = [];
    const net = createNet(null, { url: 'ws://test/world/w', token: async () => 'dev:ann', build: 'b1', socket: sockets.open });
    net.onState((state) => states.push(state));
    expect(net.state).toBe('idle');
    net.connect();
    await tick();
    sockets.last().onopen?.({});
    expect(sockets.last().sent).toEqual([{ t: 'hello', build: 'b1', token: 'dev:ann' }]);
    expect(net.send({ mx: 1, mz: 0, jump: false })).toBe(0);
    sockets.last().say(welcome);
    expect(states).toEqual(['connecting', 'open']);
    expect(net.welcome?.you).toBe('player:ann');
  });

  test('inputs are numbered from 1, one higher each', async () => {
    const { net, sockets } = await opened();
    expect(net.send({ mx: 1, mz: 0, jump: false })).toBe(1);
    expect(net.send({ mx: 0, mz: -1, jump: true, acts: [{ a: 'slot', slot: 2 }] })).toBe(2);
    expect(sockets.last().sent.slice(1)).toEqual([
      { t: 'input', n: 1, mx: 1, mz: 0, jump: false },
      { t: 'input', n: 2, mx: 0, mz: -1, jump: true, acts: [{ a: 'slot', slot: 2 }] },
    ]);
  });

  test('snaps are handed out and add up to what is near', async () => {
    const { net, sockets } = await opened();
    const heard: number[] = [];
    net.onSnap((s) => heard.push(s.step));
    sockets.last().say(snap(101, { ack: 3, actors: [{ id: 'player:bo', sprite: 'hero', x: 1, y: 2, z: 3, facing: 0, anim: 'idle' }] }));
    sockets.last().say(snap(102, { ack: 4, actors: [{ id: 'player:bo', sprite: 'hero', x: 2, y: 2, z: 3, facing: 0, anim: 'walk' }] }));
    expect(heard).toEqual([101, 102]);
    expect(net.near.ack).toBe(4);
    expect(net.near.actors.get('player:bo')?.x).toBe(2);
    sockets.last().say(snap(103, { gone: ['player:bo'] }));
    expect(net.near.actors.size).toBe(0);
  });

  test('a refusal is kept, and it does not try again by itself', async () => {
    const sockets = fakeSockets();
    const net = createNet(null, { url: 'ws://test/world/w', token: () => 'dev:ann', build: 'old', socket: sockets.open });
    net.connect();
    await tick();
    sockets.last().onopen?.({});
    sockets.last().say({ t: 'refuse', why: 'reload', text: 'Reload.' });
    sockets.last().end(CLOSE.refused);
    expect(net.state).toBe('refused');
    expect(net.refusal?.why).toBe('reload');
    net.update(60, null as never);
    await tick();
    expect(sockets.all.length).toBe(1);
  });

  test('after a drop it waits, connects again, and goes on numbering', async () => {
    const { net, sockets } = await opened();
    net.send({ mx: 1, mz: 0, jump: false });
    sockets.last().say(snap(101, { actors: [{ id: 'player:bo', sprite: 'hero', x: 1, y: 2, z: 3, facing: 0, anim: 'idle' }] }));
    sockets.last().end();
    expect(net.state).toBe('waiting');
    expect(net.retryIn).toBe(0.5);
    net.update(0.3, null as never);
    await tick();
    expect(sockets.all.length).toBe(1);
    net.update(0.3, null as never);
    await tick();
    expect(sockets.all.length).toBe(2);
    expect(net.state).toBe('connecting');
    sockets.last().onopen?.({});
    sockets.last().say(welcome);
    expect(net.state).toBe('open');
    // The new connection starts with nothing near: the server tells it everything again.
    expect(net.near.actors.size).toBe(0);
    expect(net.send({ mx: 1, mz: 0, jump: false })).toBe(2);
  });

  test('each failed try waits twice as long, up to the most', async () => {
    const sockets = fakeSockets();
    const net = createNet(null, { url: 'ws://test/world/w', token: () => 'dev:ann', socket: sockets.open, retryFirst: 1, retryMax: 3 });
    net.connect();
    await tick();
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      sockets.last().end();
      waits.push(net.retryIn);
      net.update(10, null as never);
      await tick();
    }
    expect(waits).toEqual([1, 2, 3, 3]);
  });

  test('an open connection that goes silent is dropped and tried again', async () => {
    const { net, sockets } = await opened();
    net.update(4, null as never);
    expect(net.state).toBe('open');
    sockets.last().say(snap(101));
    net.update(4, null as never);
    expect(net.state).toBe('open');
    net.update(2, null as never);
    expect(net.state).toBe('waiting');
    expect(sockets.last().closed).toBe(true);
  });

  test('taken over by another tab, it stops', async () => {
    const { net, sockets } = await opened();
    sockets.last().end(CLOSE.replaced);
    expect(net.state).toBe('closed');
    net.update(60, null as never);
    await tick();
    expect(sockets.all.length).toBe(1);
  });

  test('close() ends it, and a token that arrives late opens nothing', async () => {
    const sockets = fakeSockets();
    let give: (token: string) => void = () => undefined;
    const net = createNet(null, { url: 'ws://test/world/w', token: () => new Promise<string>((resolve) => { give = resolve; }), socket: sockets.open });
    net.connect();
    net.close();
    give('dev:ann');
    await tick();
    expect(sockets.all.length).toBe(0);
    expect(net.state).toBe('closed');
  });
});
