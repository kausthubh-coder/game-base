// The cloud copy of a player's save. The browser asks for an upload address, sends the save there as one
// file, then calls `commit` with the file's id. A player reads and replaces only their own.
//
// `commit` takes the `savedAt` of the copy the browser last saw here (`over`). When another device has put a
// newer one here since, the upload is refused as `stale` and the browser decides again (src/features/account).
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { refusal, requirePlayer } from './model/auth';
import { MAX_SAVES, MAX_SAVE_BYTES, isSlot } from './model/limits';

const facts = v.object({ bytes: v.number(), savedAt: v.number(), uploadedAt: v.number(), day: v.number() });

async function findSave(ctx: QueryCtx, ownerId: Doc<'profiles'>['_id'], slot: string): Promise<Doc<'saves'> | null> {
  return await ctx.db
    .query('saves')
    .withIndex('by_ownerId_and_slot', (q) => q.eq('ownerId', ownerId).eq('slot', slot))
    .unique();
}

/** An address the browser may POST one file to. It works once, for about an hour. */
export const uploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requirePlayer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Makes the uploaded file the caller's save in `slot`, in place of the one before it. A file over the size
 * limit, or one that would replace a copy the browser has not seen, is deleted and reported, not thrown, so
 * the delete is kept.
 */
export const commit = mutation({
  args: {
    storageId: v.id('_storage'),
    slot: v.string(),
    /** When the browser wrote the save, in milliseconds since 1970. */
    savedAt: v.number(),
    /** The day on the game's clock. */
    day: v.number(),
    /** The `savedAt` of the copy here that this one replaces, or null when the browser saw none. */
    over: v.union(v.number(), v.null()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), bytes: v.number(), savedAt: v.number() }),
    v.object({ ok: v.literal(false), reason: v.literal('tooBig'), bytes: v.number(), limit: v.number() }),
    v.object({ ok: v.literal(false), reason: v.literal('stale'), savedAt: v.number() }),
  ),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (!isSlot(args.slot)) throw refusal('badSlot', 'That is not a save slot.');
    const file = await ctx.db.system.get('_storage', args.storageId);
    if (file === null) throw refusal('noFile', 'The save did not arrive.');
    // A file that is already somebody's save cannot be claimed again, by them or by anyone else.
    const taken = await ctx.db.query('saves').withIndex('by_storageId', (q) => q.eq('storageId', args.storageId)).unique();
    if (taken) throw refusal('forbidden', 'That file is already a save.');
    if (file.size > MAX_SAVE_BYTES) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, reason: 'tooBig' as const, bytes: file.size, limit: MAX_SAVE_BYTES };
    }

    const before = await findSave(ctx, player._id, args.slot);
    if (before && before.savedAt !== args.over) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, reason: 'stale' as const, savedAt: before.savedAt };
    }
    const now = Date.now();
    const savedAt = Math.min(args.savedAt, now);
    const fields = { storageId: args.storageId, bytes: file.size, savedAt, uploadedAt: now, day: args.day };
    if (before) {
      await ctx.storage.delete(before.storageId);
      await ctx.db.patch('saves', before._id, fields);
      return { ok: true as const, bytes: file.size, savedAt };
    }

    const saves = await ctx.db.query('saves').withIndex('by_ownerId_and_slot', (q) => q.eq('ownerId', player._id)).take(MAX_SAVES);
    if (saves.length >= MAX_SAVES) throw refusal('tooMany', 'You have too many saves.');
    await ctx.db.insert('saves', { ownerId: player._id, slot: args.slot, ...fields });
    return { ok: true as const, bytes: file.size, savedAt };
  },
});

/** The caller's save in `slot`, or null when there is none. The browser watches it, so it hears another device's upload. */
export const mine = query({
  args: { slot: v.string() },
  returns: v.union(v.null(), facts),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const save = await findSave(ctx, player._id, args.slot);
    return save ? { bytes: save.bytes, savedAt: save.savedAt, uploadedAt: save.uploadedAt, day: save.day } : null;
  },
});

/** An address the caller's browser can fetch their save in `slot` from. */
export const downloadUrl = query({
  args: { slot: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const save = await findSave(ctx, player._id, args.slot);
    const url = save ? await ctx.storage.getUrl(save.storageId) : null;
    if (url === null) throw refusal('notFound', 'There is no save in your account.');
    return url;
  },
});
