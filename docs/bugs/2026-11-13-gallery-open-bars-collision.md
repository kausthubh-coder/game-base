# Open Gallery bars blocked the keeper arena

Fixed on act1-rooms-models. Lighting the six eyes removes the bars from the land and lowers their drawn mesh. The keeper's separate collision callback still returned solid for every bars cell. This prevented retreat through a doorway that looked open during the fight.

The callback now reads the same eye count as the land. The regression exercises the real ruins system, lights the eyes, starts the keeper and checks the former bars cell. Before the fix it returns true; after it returns false.

Run `bun test src/game/ruins/ruins.test.ts`. Failing output is retained in `.artifacts/rooms-gameplay/gallery-collision-red.log`.
