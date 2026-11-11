// A player's profile: the name others see. One per signed-in player, found by who Clerk says they are.
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { findPlayer, refusal, requireIdentity, requirePlayer } from './model/auth';
import { MAX_PLAYER_NAME, cleanName } from './model/limits';

/** What a player's own profile looks like to their browser. The token identifier never leaves Convex. */
const profile = v.object({ _id: v.id('profiles'), name: v.string() });

/**
 * Makes the caller's profile on their first sign-in and returns it. `name` is only what to call a new
 * player: Clerk's session token carries no name, so the browser passes the one Clerk shows.
 */
export const ensure = mutation({
  args: { name: v.optional(v.string()) },
  returns: profile,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await findPlayer(ctx);
    if (existing) return { _id: existing._id, name: existing.name };
    const name = cleanName(args.name ?? identity.name ?? identity.nickname ?? identity.givenName ?? '', MAX_PLAYER_NAME) || 'Player';
    const _id = await ctx.db.insert('profiles', { tokenIdentifier: identity.tokenIdentifier, name });
    return { _id, name };
  },
});

/** The caller's profile, or null before `ensure` has run. */
export const me = query({
  args: {},
  returns: v.union(profile, v.null()),
  handler: async (ctx) => {
    const player = await findPlayer(ctx);
    return player ? { _id: player._id, name: player.name } : null;
  },
});

/** Changes the caller's name. Returns the name as it was stored. */
export const rename = mutation({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const name = cleanName(args.name, MAX_PLAYER_NAME);
    if (!name) throw refusal('badName', 'A name needs at least one letter.');
    await ctx.db.patch('profiles', player._id, { name });
    return name;
  },
});
