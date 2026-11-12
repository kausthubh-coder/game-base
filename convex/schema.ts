// What Convex owns: who a player is in the game, and the cloud copy of their save, so a game started on one
// device goes on on another. The game itself runs in the browser.
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  /** One per player. `tokenIdentifier` is who Clerk says they are, and nothing else is ever used to find them. */
  profiles: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),

  /**
   * The cloud copy of a save. The save itself is a file in Convex storage, because a save grows with every
   * block the player changes and passes a document's 1 MiB at about 140,000 of them (convex/README.md).
   */
  saves: defineTable({
    ownerId: v.id('profiles'),
    /** Which save of the browser this is: the game's `localStorage` key. */
    slot: v.string(),
    storageId: v.id('_storage'),
    bytes: v.number(),
    /** When the browser wrote the save, and when it reached Convex. Milliseconds since 1970. */
    savedAt: v.number(),
    uploadedAt: v.number(),
    /** The day of the game's clock, for the Account panel. */
    day: v.number(),
  })
    .index('by_ownerId_and_slot', ['ownerId', 'slot'])
    .index('by_storageId', ['storageId']),
});
