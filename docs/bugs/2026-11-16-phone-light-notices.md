# Phone instructions and arrival notices overlap or clip

Independent review of all 34 phone screenshots in `.artifacts/lights-chapter/chapter-1794808567530/presentation` found the same defects at high and low quality, at 390 by 844. `.artifacts/lights-phone-review/review.json` binds the inspected files to their original hashes and records an ISSUES verdict. The original images and preflight binding remain unchanged.

The build bar uses an unwrapped flex row wider than the phone. Its title starts outside the left edge in `build-mode.png`. Toast rows retain their intrinsic text width, so the Holt arrival notice and ledger-stocked notice end beyond the right edge. The settlement banner starts at 32 percent of screen height, which intersects the phone Heartstone display in `holt-arrival.png`.

The narrow-screen CSS repair wraps the build bar and toast text within bounded widths. During an arrival banner, the phone tracker and Heartstone are hidden and ignore pointer input; they restore automatically when the banner hides. Desktop rules remain unchanged. No game rules or save data change.

The final phone-low Hatch capture also needs its complete card scrolled into view. The ledger Deliver button needs its full hit target brought above the scroll viewport edge. Those are capture/interaction checks, not evidence of missing recipes or failed delivery.

Fresh runtime captures must prove text containment, no visible banner/HUD intersection, restored HUD after the banner, full Hatch card and Deliver button visibility, and unchanged desktop presentation. The Light owner is adding those browser assertions and owns the fresh preflight, earned route and final verifier. No visual PASS or chapter acceptance is claimed by this source patch.

## Additional evidence gap

The inspected phone root-open and build-mode views show supports and cutaway, but not the complete roof. The Light owner separately reports the same gap on desktop. Camera cutaway is a hypothesis. Add an outside shelter overview and actual roof-cell/bed-cover observations to the fresh diagnostic fixture, then capture the roof actually constructed during earned play. This is an evidence gap, not an established terrain or roof-rule defect. The existing phone and desktop matrix remains preserved and unapproved.
