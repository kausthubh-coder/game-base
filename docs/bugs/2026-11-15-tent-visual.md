# Tent still fails the approved camp look

Freshly rendered source ea4243a2 with controller repair adec0587 passes the collision checks but fails make-3d-asset visual acceptance. The exact combined build was 1ae4519a; no runtime source changed before the final input checks.

Inspect `.artifacts/camp-tent-repair/nov15-sol/native-day/beside-tent-0.png` and the corresponding night picture. Against assets-src/concept/settlement/camp.webp, the canvas is too straight and uniform, its patches/seams read as flat rectangles and lines, and the entrance has a large plain grey inner triangle. The cushioned bedding and chest are hard to see. At night the lantern reads as a bright block while the entrance remains sparse. The rigid face persists in native-day/game-tent-0.png and placed quality captures.

Astra should revise the cloth silhouette and gathered entrance folds, give the canvas the sheet's material variation, and expose the bedroll/chest from the ordinary camera. Rerender both native angles and placed day/night at all qualities; do not approve from geometry tests. The footprint, frame and clearance are already readable.

Both unchanged earned copper and Gold saves passed keyboard perimeter approaches, natural-evening E sleep, wake and Continue. Separate fixtures passed sustained W+D sliding, eight side/corner pressures, jumps and walking away; no-camp browser coverage used a disclosed region stand-in. This visual issue remains open. The full source, commands, limits and raw-save hashes are in `.artifacts/camp-tent-repair/nov15-sol/report.md`.
