// Who is asking, and whether they may. Every public function starts here: the player comes from `ctx.auth`,
// never from an argument.
import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** Why a call was refused. The browser reads `error.data.code`. */
export type RefusalCode =
  | 'signedOut'
  | 'noProfile'
  | 'notFound'
  | 'forbidden'
  | 'badName'
  | 'badSlot'
  | 'tooMany'
  | 'noFile';

export const refusal = (code: RefusalCode, message: string): ConvexError<{ code: RefusalCode; message: string }> =>
  new ConvexError({ code, message });

type Ctx = QueryCtx | MutationCtx;

/** The signed-in caller, or a `signedOut` refusal. */
export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw refusal('signedOut', 'Sign in first.');
  return identity;
}

/** The caller's profile, or null when they have signed in and `profiles.ensure` has not run yet. */
export async function findPlayer(ctx: Ctx): Promise<Doc<'profiles'> | null> {
  const identity = await requireIdentity(ctx);
  return await ctx.db
    .query('profiles')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();
}

/** The caller's profile, or a refusal. */
export async function requirePlayer(ctx: Ctx): Promise<Doc<'profiles'>> {
  const player = await findPlayer(ctx);
  if (player === null) throw refusal('noProfile', 'This account has no profile yet.');
  return player;
}
