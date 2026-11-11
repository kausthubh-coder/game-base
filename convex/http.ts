// What the world server posts to Convex. It is not a player, so it has no Clerk token: it proves itself with
// the secret both sides hold, `WORLD_SERVER_SECRET`. The exact shape is in convex/README.md.
import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { MAX_PLAYERS_NOW } from './model/limits';

/** The deployment's environment variables. Declared here because the Convex runtime is not Node and has no types for it. */
declare const process: { env: Record<string, string | undefined> };

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Compares every character whatever the first difference is, so the time taken says nothing about the secret. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

interface Card {
  worldId: string;
  lastPlayedAt: number;
  playersNow: string[];
  name?: string;
  sentAt?: number;
}

/** The body as a card, or null when a field is missing or of the wrong kind. */
function readCard(body: unknown): Card | null {
  if (typeof body !== 'object' || body === null) return null;
  const { worldId, lastPlayedAt, playersNow, name, sentAt } = body as Record<string, unknown>;
  if (typeof worldId !== 'string' || worldId.length === 0 || worldId.length > 64) return null;
  if (typeof lastPlayedAt !== 'number' || !Number.isFinite(lastPlayedAt) || lastPlayedAt < 0) return null;
  if (!Array.isArray(playersNow) || playersNow.length > MAX_PLAYERS_NOW) return null;
  const players: string[] = [];
  for (const player of playersNow) {
    if (typeof player !== 'string' || player.length === 0 || player.length > 64) return null;
    players.push(player);
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 200)) return null;
  if (sentAt !== undefined && (typeof sentAt !== 'number' || !Number.isFinite(sentAt) || sentAt < 0)) return null;
  const card: Card = { worldId, lastPlayedAt, playersNow: players };
  if (name !== undefined) card.name = name;
  if (sentAt !== undefined) card.sentAt = sentAt;
  return card;
}

const http = httpRouter();

http.route({
  path: '/world-server/card',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WORLD_SERVER_SECRET;
    // With no secret set nobody is the world server, so nobody may write.
    if (!secret) return json(503, { error: 'notConfigured' });
    const sent = request.headers.get('Authorization') ?? '';
    if (!sent.startsWith('Bearer ') || !sameText(sent.slice('Bearer '.length), secret)) return json(401, { error: 'unauthorized' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'badJson' });
    }
    const card = readCard(body);
    if (card === null) return json(400, { error: 'badCard' });

    const result = await ctx.runMutation(internal.worlds.writeCard, card);
    if (result === 'ok') return json(200, { ok: true });
    if (result === 'noWorld') return json(404, { error: 'noWorld' });
    if (result === 'soloWorld') return json(409, { error: 'soloWorld' });
    return json(400, { error: result });
  }),
});

export default http;
