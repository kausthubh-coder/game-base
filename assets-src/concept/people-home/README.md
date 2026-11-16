# People at home

Repaint proposals, 2026-11-12, on `act1-concept-cast`. These are concept sheets awaiting approval. They do not change the shipped sprites, portraits or manifest.

The returned sheets repeated chestnut curls, youthful faces and brown clothes. The replacements give each person a separate head shape, hair silhouette, complexion, build and clothing key. All keep the approved cast's painted anime rendering, warm upper-left light, cream highlights, brown outlines and violet-brown shadows. Large turnarounds use natural proportions; small pixel mocks propose readability and are not animation-ready sprites.

| Person | Repaint direction and story continuity |
|---|---|
| Hero | Sixteen, brass key, canvas jacket, tool and left glove after the first night. A: very fair freckled heart face, straight strawberry-blond wedge, lean small build, blue jacket. B: deep complexion, round face, black buzz cut, stocky build, plum. C: golden tan oval face, straight black blunt-fringed shoulder hair, lanky build, terracotta. D: olive square face, ash-brown high plait and clipped sides, athletic build, pale sage. Four bodies and four small mocks replace the earlier nearly identical busts. |
| Hobb | Short, very round, strong arms; deep brown skin, broad face, black coiled bun and silver temples under cream cloth. Kitchen crimson and wine-red scorched apron replace brown. About fifty, belt ladle, food parcel and kitchen equipment retained. |
| Dax | Pale rosy skin, square face, straight flax-blond crew cut, tall broad adolescent build. Slate-blue guild jacket and charcoal trousers. Sixteen, a head taller than the hero, with a reclaimed crate-lid shield on his left arm. |
| Mina | Petite wiry build, golden-brown skin, long oval face, straight black fringe and long braid. Violet waistcoat and lilac overskirt replace olive and ochre. Sixteen, round glasses, inked fingers and rigid map tube as tall as she is. |
| Wren | Tall wiry woman in her early twenties; olive complexion, angular face, straight dark-auburn low ponytail. Forest-green pocket coat, bow, quiver and sleeping yellow pocket bird. Her quiet manner and grief for Bramble stay. |
| Tansy | Short stout pear-shaped adult, pale flushed freckled round face, straight copper hair in two low plaits. Honey-yellow work apron; straw hat, pushed-back veil, framed hive and sleeve bees retained. |
| Gus | Approved sheet unchanged: sun-worn farmer, heavy moustache, straw hat, ochre shirt and indigo overalls. |
| Holt | Approved sheet unchanged: older stooped lamplighter, grey moustache, flat cap, soot shoulder and hooked pole. |

## Lineup and defaults

`lineup.webp` compares the chapter's eighteen named cast members: sixteen humans, the Custodian and Cernwyn. Hero A represents the customizable player. The unnamed townsfolk remain on their approved sheet and are not extra named cast members.

Hair, complexion, exact heights and builds where the chapter is silent are art proposals, not added lore. Tansy defaults to her late thirties; the glove and Ilara's Mark default to the left hand. Generated height labels are not canon. Dax must remain one head taller than the selected hero in final sprite work. Hero B through D need later direction and expression sheets if selected; this brief retains one main turnaround and three expressions, plus four mirror looks.

The giant Stag and small Custodian require physical-scale comparison rather than equal-height thumbnails. The lineup's scale convention and crop coordinates are recorded with its assembly data. Equipment may exceed a standard sprite cell; final sprites must preserve body scale.

## Production and verification

Read the handbook's `design/28-the-people.md` and `playthrough/content.js` (`people`), all three concept READMEs, `docs/assets.md`, `docs/style-sheet.md` and the make-sprite skill's one-cast-style guidance. Opened every original sheet, including the approved reference sheets. Built-in `image_gen.imagegen` repaints each returned sheet using that same original as an edit reference. `prompts.json` records the repaint direction; the prior prompt set is superseded. Compression and lineup assembly only crop, scale, clean background and encode generated paintings; they do not draw replacement character pixels.

The verify-game skill was read. Verification here is scoped to unreferenced concept sources: decode and open every final WebP, compare identity and equipment with chapter 28, inspect the lineup at reduced size, enforce the strict 600,000-byte sheet limit, preserve approved sheets byte-for-byte and check Git scope. Runtime build and play checks cannot exercise these concept proposals. Final results are recorded in `verification.json`.

Final review: eighteen named figures are distinct in the reduced lineup. All twelve replacement sheets were opened after encoding. Seven approved reference sheets remain byte-identical. Exact story-symbol review receives ISSUES: Ilara still has eight Mark points after three attempts, and Aldric's half-sun has extra lower rays. See the old-cast and world-cast READMEs. The lineup uses the Stag's approved chained front, at the same physical scale as everyone else; no scale inset was needed. Rebuild it with `bun assets-src/concept/people-home/lineup.mjs`.
