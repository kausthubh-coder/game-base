# Action sheets counted as separate portrait identities

Fixed in f14013e8. Registering the Braid base candidate made the unchanged
Ilara glad portrait fail the rank limit. The checker counted each boar action
and variant as another character, consuming four places for the same identity.

Reproduction: `bun test tools/art/portrait.test.mjs`. Before the fix, the first
test fails using real frozen Ilara/boar assets and a rank limit of two. The
captured failure is `.artifacts/hero-braid-review/portrait-red.log`. With one
distinct competing character, the portrait should rank second regardless of
how many sheets that character owns.

The checker and contact-sheet report now group by the existing art contract,
retaining the strongest rival head for each character. Own likeness still
uses the base sheet. Numeric limits and ledger exceptions are unchanged.
Negative controls retain failures for distinct competitors and poor own
likeness, including an own action sheet that would otherwise flatter the match.

Braid's separate animation anchoring defect remains unresolved. The two
candidates remain outside the shipped manifest with FAIL visual reviews.
