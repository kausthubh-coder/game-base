# Moving vault parts ignored graphics changes

Fixed on act1-rooms-models. With the Pump House loaded at high, changing the graphics setting to low changed the context but retained the Harvester arm's high geometry. The same installation creates the gears, shaft, sluice gates and Gallery bars once. The prop kit updated itself, but these meshes never rebuilt.

The room view now replaces moving geometry when the quality table's prop detail changes. Mesh transforms and visibility stay intact. Shared geometry is replaced in every instance and disposed once. Medium and high share the same detail setting.

Regression check: `bun test src/game/ruins/vault-detail.test.ts`. Disabling replacement makes it fail; restoring it passes. Browser evidence and the low/medium/high geometry readings are in `.artifacts/rooms-gameplay/quality.json`. This is a geometry check, with no frame rate claim.
