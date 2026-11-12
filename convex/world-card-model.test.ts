// Holds the world's card in Convex to its model. docs/verify/world-join/WorldJoin.tla writes Convex's side of
// the card as one action, `Land`: the card a post carries is taken, and every post made before it changes
// nothing when it lands later. server/test/world-model.test.ts plays that rule as a stand-in. This test holds
// the real rule to it: random cards, made in order and posted in any order, some never arriving, through the
// same address the world server posts to, and after each one the world list is compared with the model.
//   `.agents/skills/verify-world-join` has the steps.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, player } from './test.setup';

const SECRET = 'a-secret-only-the-world-server-holds';

beforeEach(() => {
  vi.stubEnv('WORLD_SERVER_SECRET', SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The same small random numbers on every run. */
function randomFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the world card and WorldJoin.tla', () => {
  test('Convex takes a card as Land says, in every order the posts arrive', async () => {
    let crossed = 0, taken = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const random = randomFrom(seed);
      const t = newBackend();
      const ada = await player(t, 'user_ada');
      const bo = await player(t, 'user_bo');
      const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
      const everyone: Id<'profiles'>[] = [ada.id, bo.id];

      // The cards a world makes, in the order it makes them, each stamped later than the last.
      const made = Array.from({ length: 6 }, (_, n) => ({ sentAt: 1_000 + n, players: everyone.filter(() => random() < 0.5) }));
      // WorldJoin.tla: the posts Convex would still take, oldest first, and the card it holds.
      let fresh = [...made];
      let card: Id<'profiles'>[] = [];
      // They arrive in any order, and one in six never arrives.
      const arriving = made.filter(() => random() > 1 / 6).sort(() => random() - 0.5);
      for (const post of arriving) {
        const at = fresh.indexOf(post);
        if (at >= 0) { card = post.players; fresh = fresh.slice(at + 1); taken++; } else crossed++;
        const response = await t.fetch('/world-server/card', {
          method: 'POST',
          headers: { Authorization: `Bearer ${SECRET}` },
          body: JSON.stringify({ worldId, lastPlayedAt: post.sentAt, playersNow: post.players, sentAt: post.sentAt }),
        });
        expect(response.status).toBe(200);
        const list = (await ada.session.query(api.worlds.list, {}))[0];
        expect(list.playersNow.map((p) => p.playerId), `seed ${seed}, the card made at ${post.sentAt}`).toEqual(card);
      }
    }
    // Runs where no old card arrives after a newer one would pass and prove nothing.
    expect(crossed).toBeGreaterThanOrEqual(25);
    expect(taken).toBeGreaterThanOrEqual(50);
  }, 30_000);
});
