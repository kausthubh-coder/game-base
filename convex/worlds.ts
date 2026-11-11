// The world list: each world's card, who owns it and who may enter it. The world server asks `mayEnter`
// before it lets a player in, and writes the card of an online world through convex/http.ts.
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server';
import { findPlayer, refusal, requireOwner, requirePlayer, roleIn } from './model/auth';
import { MAX_INVITES_KEPT, MAX_MEMBERS, MAX_PLAYERS_NOW, MAX_WORLDS_JOINED, MAX_WORLDS_OWNED, MAX_WORLD_NAME, cleanName } from './model/limits';

const worldKind = v.union(v.literal('solo'), v.literal('online'));
const worldRole = v.union(v.literal('owner'), v.literal('member'));

const card = v.object({
  _id: v.id('worlds'),
  name: v.string(),
  kind: worldKind,
  role: worldRole,
  ownerName: v.string(),
  lastPlayedAt: v.number(),
  playersNow: v.array(v.object({ playerId: v.id('profiles'), name: v.string() })),
  /** The owner's backup of a solo world. Null for a member, and for a world with no backup. */
  backup: v.union(v.null(), v.object({ slot: v.string(), bytes: v.number(), savedAt: v.number(), uploadedAt: v.number(), day: v.number() })),
});

async function nameOf(ctx: QueryCtx, playerId: Id<'profiles'>): Promise<string> {
  return (await ctx.db.get('profiles', playerId))?.name ?? 'Someone';
}

/** The caller's worlds, the ones they own and the ones they were let into, last played first. */
export const list = query({
  args: {},
  returns: v.array(card),
  handler: async (ctx) => {
    const player = await findPlayer(ctx);
    if (player === null) return [];
    const owned = await ctx.db.query('worlds').withIndex('by_ownerId', (q) => q.eq('ownerId', player._id)).take(MAX_WORLDS_OWNED);
    const joined = await ctx.db.query('members').withIndex('by_playerId', (q) => q.eq('playerId', player._id)).take(MAX_WORLDS_JOINED);
    const worlds: { world: Doc<'worlds'>; role: 'owner' | 'member' }[] = owned.map((world) => ({ world, role: 'owner' }));
    for (const row of joined) {
      const world = await ctx.db.get('worlds', row.worldId);
      if (world) worlds.push({ world, role: 'member' });
    }
    worlds.sort((a, b) => b.world.lastPlayedAt - a.world.lastPlayedAt);

    const cards = [];
    for (const { world, role } of worlds) {
      const save = role === 'owner' ? await ctx.db.query('saves').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).unique() : null;
      const playersNow = [];
      for (const playerId of world.playersNow) playersNow.push({ playerId, name: await nameOf(ctx, playerId) });
      cards.push({
        _id: world._id,
        name: world.name,
        kind: world.kind,
        role,
        ownerName: role === 'owner' ? player.name : await nameOf(ctx, world.ownerId),
        lastPlayedAt: world.lastPlayedAt,
        playersNow,
        backup: save ? { slot: save.slot, bytes: save.bytes, savedAt: save.savedAt, uploadedAt: save.uploadedAt, day: save.day } : null,
      });
    }
    return cards;
  },
});

/** Makes an online world the caller owns. It has no players until a world server runs it. */
export const create = mutation({
  args: { name: v.string() },
  returns: v.id('worlds'),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const name = cleanName(args.name, MAX_WORLD_NAME);
    if (!name) throw refusal('badName', 'A world needs a name.');
    const owned = await ctx.db.query('worlds').withIndex('by_ownerId', (q) => q.eq('ownerId', player._id)).take(MAX_WORLDS_OWNED);
    if (owned.length >= MAX_WORLDS_OWNED) throw refusal('tooMany', `One player owns at most ${MAX_WORLDS_OWNED} worlds.`);
    return await ctx.db.insert('worlds', { ownerId: player._id, name, kind: 'online', lastPlayedAt: Date.now(), playersNow: [] });
  },
});

/**
 * The world server's question: may the signed-in player enter this world? It is asked with the player's own
 * Clerk token, so the answer is about them and nobody else. `worldId` is a plain string because it comes
 * from an address: one that is no world's id is answered `notAllowed`, not thrown. See convex/README.md.
 */
export const mayEnter = query({
  args: { worldId: v.string() },
  returns: v.union(
    v.object({
      allowed: v.literal(true),
      role: worldRole,
      playerId: v.id('profiles'),
      playerName: v.string(),
      worldName: v.string(),
      kind: worldKind,
    }),
    v.object({ allowed: v.literal(false), reason: v.union(v.literal('signedOut'), v.literal('notAllowed')) }),
  ),
  handler: async (ctx, args) => {
    if ((await ctx.auth.getUserIdentity()) === null) return { allowed: false as const, reason: 'signedOut' as const };
    const refused = { allowed: false as const, reason: 'notAllowed' as const };
    const player = await findPlayer(ctx);
    const worldId = ctx.db.normalizeId('worlds', args.worldId);
    if (player === null || worldId === null) return refused;
    const world = await ctx.db.get('worlds', worldId);
    if (world === null) return refused;
    const role = await roleIn(ctx, player, world);
    if (role === null) return refused;
    return { allowed: true as const, role, playerId: player._id, playerName: player.name, worldName: world.name, kind: world.kind };
  },
});

/** Who may enter a world, for anyone who may enter it themselves. The owner comes first. */
export const members = query({
  args: { worldId: v.id('worlds') },
  returns: v.array(v.object({ playerId: v.id('profiles'), name: v.string(), role: worldRole })),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = await ctx.db.get('worlds', args.worldId);
    if (world === null) throw refusal('notFound', 'No such world.');
    if ((await roleIn(ctx, player, world)) === null) throw refusal('forbidden', 'You are not in this world.');
    const rows = await ctx.db.query('members').withIndex('by_worldId_and_playerId', (q) => q.eq('worldId', world._id)).take(MAX_MEMBERS);
    const list: { playerId: Id<'profiles'>; name: string; role: 'owner' | 'member' }[] = [{ playerId: world.ownerId, name: await nameOf(ctx, world.ownerId), role: 'owner' }];
    for (const row of rows) list.push({ playerId: row.playerId, name: await nameOf(ctx, row.playerId), role: 'member' });
    return list;
  },
});

/** The owner takes a member out of their world. */
export const removeMember = mutation({
  args: { worldId: v.id('worlds'), playerId: v.id('profiles') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = requireOwner(player, await ctx.db.get('worlds', args.worldId));
    const row = await ctx.db
      .query('members')
      .withIndex('by_worldId_and_playerId', (q) => q.eq('worldId', world._id).eq('playerId', args.playerId))
      .unique();
    if (row) await ctx.db.delete('members', row._id);
    return null;
  },
});

/** A member leaves a world they were let into. */
export const leave = mutation({
  args: { worldId: v.id('worlds') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const row = await ctx.db
      .query('members')
      .withIndex('by_worldId_and_playerId', (q) => q.eq('worldId', args.worldId).eq('playerId', player._id))
      .unique();
    if (row) await ctx.db.delete('members', row._id);
    return null;
  },
});

/** The owner deletes a world: its card, its members, its invites and its backup. */
export const remove = mutation({
  args: { worldId: v.id('worlds') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = requireOwner(player, await ctx.db.get('worlds', args.worldId));
    const rows = await ctx.db.query('members').withIndex('by_worldId_and_playerId', (q) => q.eq('worldId', world._id)).take(MAX_MEMBERS);
    for (const row of rows) await ctx.db.delete('members', row._id);
    const invites = await ctx.db.query('invites').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).take(MAX_INVITES_KEPT);
    for (const invite of invites) await ctx.db.delete('invites', invite._id);
    const save = await ctx.db.query('saves').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).unique();
    if (save) {
      await ctx.storage.delete(save.storageId);
      await ctx.db.delete('saves', save._id);
    }
    await ctx.db.delete('worlds', world._id);
    return null;
  },
});

/**
 * Writes an online world's card. Only convex/http.ts calls it, after it has checked the world server's
 * secret. The ids arrive as plain strings, so each is checked here.
 */
export const writeCard = internalMutation({
  args: {
    worldId: v.string(),
    lastPlayedAt: v.number(),
    playersNow: v.array(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.union(v.literal('ok'), v.literal('noWorld'), v.literal('soloWorld'), v.literal('badPlayer'), v.literal('badName')),
  handler: async (ctx, args) => {
    const worldId = ctx.db.normalizeId('worlds', args.worldId);
    const world = worldId ? await ctx.db.get('worlds', worldId) : null;
    if (world === null) return 'noWorld';
    // A solo world's card is written from its owner's browser, when the save is backed up.
    if (world.kind !== 'online') return 'soloWorld';
    if (args.playersNow.length > MAX_PLAYERS_NOW) return 'badPlayer';
    const playersNow: Id<'profiles'>[] = [];
    for (const text of args.playersNow) {
      const playerId = ctx.db.normalizeId('profiles', text);
      if (playerId === null || (await ctx.db.get('profiles', playerId)) === null) return 'badPlayer';
      if (!playersNow.includes(playerId)) playersNow.push(playerId);
    }
    const name = args.name === undefined ? world.name : cleanName(args.name, MAX_WORLD_NAME);
    if (!name) return 'badName';
    // Two posts can cross on the way here, so the later time of the two stands.
    await ctx.db.patch('worlds', world._id, { name, playersNow, lastPlayedAt: Math.max(world.lastPlayedAt, args.lastPlayedAt) });
    return 'ok';
  },
});
