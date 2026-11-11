// Invites: the owner of an online world makes a code, hands it to a friend, and the friend's account is let
// into the world when they enter it. One code lets one player in, and it stops working after a week.
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { refusal, requireOwner, requirePlayer, roleIn } from './model/auth';
import { INVITE_LIFE_MS, MAX_INVITES_KEPT, MAX_MEMBERS, MAX_OPEN_INVITES, MAX_WORLDS_JOINED } from './model/limits';

/** Letters and digits that are not mistaken for each other when read aloud or typed. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 16;

/** 16 characters of 32, so 80 bits: nobody finds a code by guessing. */
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

/** A code as it was typed or pasted: any case, with or without spaces and dashes. */
const readCode = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The owner makes an invite to their online world. */
export const create = mutation({
  args: { worldId: v.id('worlds') },
  returns: v.object({ inviteId: v.id('invites'), code: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = requireOwner(player, await ctx.db.get('worlds', args.worldId));
    if (world.kind !== 'online') throw refusal('soloWorld', 'A solo world has no visitors. Put it online first.');
    const now = Date.now();
    const kept = await ctx.db.query('invites').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).take(MAX_INVITES_KEPT);
    // Invites that ran out unused make room for new ones.
    const ranOut = kept.filter((invite) => !invite.acceptedBy && invite.expiresAt <= now);
    for (const invite of ranOut) await ctx.db.delete('invites', invite._id);
    const open = kept.filter((invite) => !invite.acceptedBy && invite.expiresAt > now);
    if (open.length >= MAX_OPEN_INVITES || kept.length - ranOut.length >= MAX_INVITES_KEPT) throw refusal('tooMany', 'This world has too many invites. Take one back first.');
    const code = newCode();
    const expiresAt = now + INVITE_LIFE_MS;
    const inviteId = await ctx.db.insert('invites', { worldId: world._id, createdBy: player._id, code, expiresAt });
    return { inviteId, code, expiresAt };
  },
});

/** The invites of a world, for its owner. `acceptedBy` is the name of the player who used one, or null. */
export const forWorld = query({
  args: { worldId: v.id('worlds') },
  returns: v.array(v.object({ _id: v.id('invites'), code: v.string(), expiresAt: v.number(), acceptedBy: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = requireOwner(player, await ctx.db.get('worlds', args.worldId));
    const invites = await ctx.db.query('invites').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).order('desc').take(MAX_INVITES_KEPT);
    const list = [];
    for (const invite of invites) {
      const taker = invite.acceptedBy ? await ctx.db.get('profiles', invite.acceptedBy) : null;
      list.push({ _id: invite._id, code: invite.code, expiresAt: invite.expiresAt, acceptedBy: invite.acceptedBy ? (taker?.name ?? 'Someone') : null });
    }
    return list;
  },
});

/** The owner takes an invite back. Whoever already used it stays a member: `worlds.removeMember` takes them out. */
export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const invite = await ctx.db.get('invites', args.inviteId);
    if (invite === null) throw refusal('notFound', 'No such invite.');
    requireOwner(player, await ctx.db.get('worlds', invite.worldId));
    await ctx.db.delete('invites', invite._id);
    return null;
  },
});

/** The caller enters a world with a code. Using your own code again, or one for a world you are already in, changes nothing. */
export const accept = mutation({
  args: { code: v.string() },
  returns: v.object({ worldId: v.id('worlds'), name: v.string() }),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const code = readCode(args.code);
    const invite = code.length === CODE_LENGTH ? await ctx.db.query('invites').withIndex('by_code', (q) => q.eq('code', code)).unique() : null;
    const world = invite ? await ctx.db.get('worlds', invite.worldId) : null;
    if (invite === null || world === null) throw refusal('notFound', 'That code is not an invite.');
    const joined = { worldId: world._id, name: world.name };
    if ((await roleIn(ctx, player, world)) !== null) return joined;
    if (invite.acceptedBy) throw refusal('inviteUsed', 'That invite was already used.');
    if (invite.expiresAt <= Date.now()) throw refusal('inviteExpired', 'That invite ran out.');
    const members = await ctx.db.query('members').withIndex('by_worldId_and_playerId', (q) => q.eq('worldId', world._id)).take(MAX_MEMBERS);
    if (members.length >= MAX_MEMBERS) throw refusal('worldFull', 'That world is full.');
    const mine = await ctx.db.query('members').withIndex('by_playerId', (q) => q.eq('playerId', player._id)).take(MAX_WORLDS_JOINED);
    if (mine.length >= MAX_WORLDS_JOINED) throw refusal('tooMany', 'You are in too many worlds. Leave one first.');
    await ctx.db.insert('members', { worldId: world._id, playerId: player._id });
    await ctx.db.patch('invites', invite._id, { acceptedBy: player._id });
    return joined;
  },
});
