// What Convex owns: who a player is in the game, the world list, who may enter each world, invites, and the
// backup of a solo save. Movement, creatures and placed blocks never come here: the world server owns those
// (docs/architecture.md, "The one rule that keeps things in sync").
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  /** One per player. `tokenIdentifier` is who Clerk says they are, and nothing else is ever used to find them. */
  profiles: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),

  /**
   * A world's card, as the world list shows it. A `solo` world lives in its owner's browser and its card is
   * written when the save is backed up. An `online` world's card is written by the world server.
   */
  worlds: defineTable({
    ownerId: v.id('profiles'),
    name: v.string(),
    kind: v.union(v.literal('solo'), v.literal('online')),
    /** Milliseconds since 1970. */
    lastPlayedAt: v.number(),
    /** Who is in it now. Only the world server writes this, and a world holds a handful of players. */
    playersNow: v.array(v.id('profiles')),
    /** When the world server made the card that `playersNow` came from. A card made before it is dropped. */
    cardAt: v.optional(v.number()),
  }).index('by_ownerId', ['ownerId']),

  /** Who may enter a world beside its owner. The owner is `worlds.ownerId` and has no row here. */
  members: defineTable({
    worldId: v.id('worlds'),
    playerId: v.id('profiles'),
  })
    .index('by_playerId', ['playerId'])
    .index('by_worldId_and_playerId', ['worldId', 'playerId']),

  /** One invite lets one player into one world. The code is the secret the owner hands over. */
  invites: defineTable({
    worldId: v.id('worlds'),
    createdBy: v.id('profiles'),
    code: v.string(),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.id('profiles')),
  })
    .index('by_code', ['code'])
    .index('by_worldId', ['worldId']),

  /**
   * The backup of a solo save. The save itself is a file in Convex storage, because a save grows with every
   * block the player changes and passes a document's 1 MiB at about 140,000 of them (convex/README.md).
   */
  saves: defineTable({
    worldId: v.id('worlds'),
    ownerId: v.id('profiles'),
    /** Which save of the browser this is: the game's `localStorage` key. */
    slot: v.string(),
    storageId: v.id('_storage'),
    bytes: v.number(),
    /** When the browser wrote the save, and when it reached Convex. Milliseconds since 1970. */
    savedAt: v.number(),
    uploadedAt: v.number(),
    /** The day of the game's clock, for the card. */
    day: v.number(),
  })
    .index('by_ownerId_and_slot', ['ownerId', 'slot'])
    .index('by_worldId', ['worldId'])
    .index('by_storageId', ['storageId']),
});
