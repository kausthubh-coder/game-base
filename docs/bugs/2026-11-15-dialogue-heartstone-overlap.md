# Heartstone HUD overlaps a speaker on phone

The Gallery chapter preflight reproduced this in scene 25 at 390 by 844, high quality. The first line places the Heartstone HUD over Calla's hair and forehead. The actor framing and body checks pass because they do not check HUD overlap.

Before image: `.artifacts/gallery-chapter/attempt-02/phone-high/scene-25.png`. The coordinator inspected it at full size. The final line is clear. Both the accepted uphill save and preserved Gallery start already have `scene.25`, so this diagnostic is not a repeated earned conversation.

The HUD already hides quick slots and the quest tracker while the root has `ui-talking`. The Heartstone widget was omitted. The fix hides that widget and disables its pointer events during the same state. Its layout space and level state remain intact, and it returns when dialogue ends.

Verification must inspect first and last lines of scenes 25 and 28 on phone and desktop at high and low. Assert the Heartstone is invisible and cannot receive pointer hits during dialogue, then returns after cleanup when `heart.seen` is set. Keep the failed image and check the existing approved scenes unchanged. Fresh browser verification is pending with the Gallery preflight owner.

Fresh verification passed in `.artifacts/gallery-chapter/attempt-03` on the build from `0e753410`, including the fix `a87969fe`. Scenes 25 and 28 pass at desktop 1366×768 and phone 390×844, high and low, on the Metal renderer. Every dialogue line records the widget as invisible, pointer events `none`, and absent from pointer hits. Cleanup records the earned widget visible again. First and last images of both scenes in all four views were inspected at full size; Calla's head is clear and the memory actor stays visible. The retained attempt-02 image shows the earlier failure. This closes the focused HUD regression; the final default verifier also passes all nine parts and six unchanged approved comparisons in `.artifacts/gallery-chapter/final-verifier-02/verify.log`.
