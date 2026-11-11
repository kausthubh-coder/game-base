// The backup of a solo save. The browser asks for an upload address, sends the save there as one file, then
// calls `commit` with the file's id. `commit` writes the solo world's card and points it at the file.
// A player reads and replaces only their own.
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { refusal, requireOwner, requirePlayer } from './model/auth';
import { MAX_SAVES, MAX_SAVE_BYTES, MAX_WORLDS_OWNED, MAX_WORLD_NAME, cleanName, isSlot } from './model/limits';

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
 * Makes the uploaded file the backup of the caller's save in `slot`, in place of the one before it.
 * A file over the size limit is deleted and reported, not thrown, so the delete is kept.
 */
export const commit = mutation({
  args: {
    storageId: v.id('_storage'),
    slot: v.string(),
    /** The name on the solo world's card. */
    name: v.string(),
    /** When the browser wrote the save, in milliseconds since 1970. */
    savedAt: v.number(),
    /** The day on the game's clock. */
    day: v.number(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), worldId: v.id('worlds'), bytes: v.number() }),
    v.object({ ok: v.literal(false), reason: v.literal('tooBig'), bytes: v.number(), limit: v.number() }),
  ),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (!isSlot(args.slot)) throw refusal('badSlot', 'That is not a save slot.');
    const name = cleanName(args.name, MAX_WORLD_NAME);
    if (!name) throw refusal('badName', 'A world needs a name.');
    const file = await ctx.db.system.get('_storage', args.storageId);
    if (file === null) throw refusal('noFile', 'The save did not arrive.');
    // A file that is already somebody's backup cannot be claimed again, by them or by anyone else.
    const taken = await ctx.db.query('saves').withIndex('by_storageId', (q) => q.eq('storageId', args.storageId)).unique();
    if (taken) throw refusal('forbidden', 'That file is already a backup.');
    if (file.size > MAX_SAVE_BYTES) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, reason: 'tooBig' as const, bytes: file.size, limit: MAX_SAVE_BYTES };
    }

    const now = Date.now();
    const savedAt = Math.min(args.savedAt, now);
    const fields = { storageId: args.storageId, bytes: file.size, savedAt, uploadedAt: now, day: args.day };
    const before = await ctx.db
      .query('saves')
      .withIndex('by_ownerId_and_slot', (q) => q.eq('ownerId', player._id).eq('slot', args.slot))
      .unique();
    if (before) {
      await ctx.storage.delete(before.storageId);
      await ctx.db.patch('saves', before._id, fields);
      await ctx.db.patch('worlds', before.worldId, { name, lastPlayedAt: savedAt });
      return { ok: true as const, worldId: before.worldId, bytes: file.size };
    }

    const saves = await ctx.db.query('saves').withIndex('by_ownerId_and_slot', (q) => q.eq('ownerId', player._id)).take(MAX_SAVES);
    const owned = await ctx.db.query('worlds').withIndex('by_ownerId', (q) => q.eq('ownerId', player._id)).take(MAX_WORLDS_OWNED);
    if (saves.length >= MAX_SAVES || owned.length >= MAX_WORLDS_OWNED) throw refusal('tooMany', 'You have too many worlds. Delete one first.');
    const worldId = await ctx.db.insert('worlds', { ownerId: player._id, name, kind: 'solo', lastPlayedAt: savedAt, playersNow: [] });
    await ctx.db.insert('saves', { worldId, ownerId: player._id, slot: args.slot, ...fields });
    return { ok: true as const, worldId, bytes: file.size };
  },
});

/** The caller's backup of the save in `slot`, or null when there is none. */
export const mine = query({
  args: { slot: v.string() },
  returns: v.union(
    v.null(),
    v.object({ worldId: v.id('worlds'), name: v.string(), bytes: v.number(), savedAt: v.number(), uploadedAt: v.number(), day: v.number() }),
  ),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const save = await ctx.db
      .query('saves')
      .withIndex('by_ownerId_and_slot', (q) => q.eq('ownerId', player._id).eq('slot', args.slot))
      .unique();
    if (save === null) return null;
    const world = await ctx.db.get('worlds', save.worldId);
    return { worldId: save.worldId, name: world?.name ?? '', bytes: save.bytes, savedAt: save.savedAt, uploadedAt: save.uploadedAt, day: save.day };
  },
});

/** An address the owner's browser can fetch the backup of their world from. */
export const downloadUrl = query({
  args: { worldId: v.id('worlds') },
  returns: v.string(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const world = requireOwner(player, await ctx.db.get('worlds', args.worldId));
    const save = await ctx.db.query('saves').withIndex('by_worldId', (q) => q.eq('worldId', world._id)).unique();
    const url = save ? await ctx.storage.getUrl(save.storageId) : null;
    if (url === null) throw refusal('notFound', 'This world has no backup.');
    return url;
  },
});
