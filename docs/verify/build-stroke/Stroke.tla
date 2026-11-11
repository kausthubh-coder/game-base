------------------------------- MODULE Stroke -------------------------------
(* A stroke in build mode: one press, drag and release that tills or plants a
   set of ground cells. This is the design of src/game/build/index.sim.ts with
   the keys that drive it, small enough for a checker to walk every order of
   events. Each action below names the code it stands for.

   The model keeps two tools: the hoe, which is free, and seeds, which cost one
   from the bag for each cell. Blocks, fences and placeables spend the bag the
   way seeds do, so seeds stand for all of them.                              *)
EXTENDS Integers, FiniteSets

CONSTANTS
  Cells,       \* the ground cells a stroke can cover
  Tools,       \* the items the quick slots hold: a subset of {"hoe", "seeds"}
  StartSeeds,  \* seeds in the bag at the start
  BagCap,      \* the most seeds the bag holds
  EnvBudget,   \* how many times another system may give or take a seed
  WorldMoves   \* TRUE lets other systems change the cells between events

VARIABLES
  active,     \* build mode is on                          index.sim.ts `active`
  busy,       \* a panel or a conversation has the player   game.player.busy
  slot,       \* the quick slot that is picked              inventory.selected
  bag,        \* seeds in the bag                           inventory.count
  cell,       \* what each ground cell is
  primary,    \* the keys say the left button is down       keys.ts `primary`
  stroke,     \* the stroke in progress                     index.sim.ts `stroke`
  journal,    \* what the last stroke did to each cell      index.sim.ts `journal`
  gained,     \* seeds another system gave                  (bookkeeping for a rule)
  lost,       \* seeds another system took                  (bookkeeping for a rule)
  commits,    \* strokes applied since the button went down (bookkeeping for a rule)
  wrongHand   \* a stroke was applied that the rules drop   (bookkeeping for a rule)

vars == <<active, busy, slot, bag, cell, primary, stroke, journal, gained, lost, commits, wrongHand>>

Off == [on |-> FALSE, item |-> "none", cover |-> {}]
Min(a, b) == IF a < b THEN a ELSE b

\* inventory.held(): an empty slot holds nothing.
Held == IF slot = "seeds" /\ bag <= 0 THEN "none" ELSE slot

Crops == {c \in Cells : cell[c] \in {"crop", "grown"}}

Init ==
  /\ active = FALSE /\ busy = FALSE /\ primary = FALSE
  /\ slot \in Tools
  /\ bag = StartSeeds
  /\ cell = [c \in Cells |-> "grass"]
  /\ stroke = Off
  /\ journal = [c \in Cells |-> "none"]
  /\ gained = 0 /\ lost = 0 /\ commits = 0 /\ wrongHand = FALSE

-----------------------------------------------------------------------------
(* The button.  keys.ts sends `use primary` when the left button goes down and
   `letGo` once when it comes up or is lost. world-build.view.ts turns them
   into press(), release() and cancel().                                      *)

\* build.press(). It starts a stroke only in build mode, with the player free,
\* no stroke in progress and a tool in hand. The pointer may be on nothing.
ButtonDown ==
  /\ primary' = TRUE
  /\ commits' = 0
  /\ \/ /\ active /\ ~busy /\ ~stroke.on /\ Held # "none"
        /\ \E c \in Cells : stroke' = [on |-> TRUE, item |-> Held, cover |-> {c}]
     \/ stroke' = stroke
  /\ UNCHANGED <<active, busy, slot, bag, cell, journal, gained, lost, wrongHand>>

\* build.point() during a stroke moves its far end.
Drag ==
  /\ stroke.on
  /\ \E s \in (SUBSET Cells) \ {{}} : stroke' = [stroke EXCEPT !.cover = s]
  /\ UNCHANGED <<active, busy, slot, bag, cell, primary, journal, gained, lost, commits, wrongHand>>

\* What release() asks before it applies anything.
Fits == active /\ ~busy /\ Held = stroke.item

\* plan.sim.ts `judge`: the hoe changes grass, a seed changes bare tilled soil.
Ok(c) == IF stroke.item = "hoe" THEN cell[c] = "grass" ELSE cell[c] = "tilled"
Cand == {c \in stroke.cover : Ok(c)}
\* The bag pays for the cells nearest the press first. Which ones does not
\* matter to the rules, so the model takes any of them.
Applicable ==
  IF stroke.item = "seeds"
  THEN {s \in SUBSET Cand : Cardinality(s) = Min(bag, Cardinality(Cand))}
  ELSE {Cand}

\* build.release(): the stroke is judged against the world as it is now.
Release ==
  IF ~stroke.on
  THEN UNCHANGED <<stroke, cell, bag, journal, commits, wrongHand>>
  ELSE
    /\ stroke' = Off
    /\ IF Fits
       THEN \E applied \in Applicable :
              /\ cell' = [c \in Cells |-> IF c \in applied
                                          THEN (IF stroke.item = "hoe" THEN "tilled" ELSE "crop")
                                          ELSE cell[c]]
              /\ bag' = IF stroke.item = "seeds" THEN bag - Cardinality(applied) ELSE bag
              /\ journal' = [c \in Cells |-> IF c \in applied
                                             THEN (IF stroke.item = "hoe" THEN "till" ELSE "plant")
                                             ELSE "none"]
              /\ commits' = IF applied # {} THEN commits + 1 ELSE commits
              \* The rule, written out a second time so that a weaker `Fits` shows.
              /\ wrongHand' = (wrongHand \/ (applied # {} /\ ~(active /\ ~busy /\ Held = stroke.item)))
       ELSE UNCHANGED <<cell, bag, journal, commits, wrongHand>>

ButtonUp ==
  /\ primary /\ primary' = FALSE
  /\ Release
  /\ UNCHANGED <<active, busy, slot, gained, lost>>

\* release() called with the button already up, or twice for one press.
ExtraRelease ==
  /\ Release
  /\ UNCHANGED <<active, busy, slot, primary, gained, lost>>

\* The window lost focus, the pointer was cancelled, a pause took the keys: build.cancel().
ButtonLost ==
  /\ primary /\ primary' = FALSE
  /\ stroke' = Off
  /\ UNCHANGED <<active, busy, slot, bag, cell, journal, gained, lost, commits, wrongHand>>

\* The right button during a stroke: build.cancel(), with the left button still down.
RightPress ==
  /\ stroke.on
  /\ stroke' = Off
  /\ UNCHANGED <<active, busy, slot, bag, cell, primary, journal, gained, lost, commits, wrongHand>>

-----------------------------------------------------------------------------
(* Everything else a player can do while the button is down.                 *)

\* A digit key or Shift and the wheel: inventory.selected.
SwitchHand ==
  /\ \E t \in Tools \ {slot} : slot' = t
  /\ UNCHANGED <<active, busy, bag, cell, primary, stroke, journal, gained, lost, commits, wrongHand>>

\* G: build.setActive(!active). It stays off while the player is busy.
ToggleMode ==
  /\ LET next == ~active /\ ~busy IN
       IF next = active
       THEN UNCHANGED <<active, stroke>>
       ELSE active' = next /\ stroke' = Off
  /\ UNCHANGED <<busy, slot, bag, cell, primary, journal, gained, lost, commits, wrongHand>>

\* A panel opens or a conversation starts, and ends.
BusyOn ==
  /\ ~busy /\ busy' = TRUE
  /\ UNCHANGED <<active, slot, bag, cell, primary, stroke, journal, gained, lost, commits, wrongHand>>
BusyOff ==
  /\ busy /\ busy' = FALSE
  /\ UNCHANGED <<active, slot, bag, cell, primary, stroke, journal, gained, lost, commits, wrongHand>>

\* The build system's step(), 20 times a second.
Step ==
  /\ active' = (active /\ ~busy)
  /\ stroke' = IF stroke.on /\ (~active' \/ Held # stroke.item) THEN Off ELSE stroke
  /\ UNCHANGED <<busy, slot, bag, cell, primary, journal, gained, lost, commits, wrongHand>>

\* Z: build.undo(). A cell goes back only when it is still as the stroke left
\* it, and a planted cell only when its seed fits in the bag.
Undo ==
  /\ active /\ ~busy /\ ~stroke.on
  /\ \E c \in Cells : journal[c] # "none"
  /\ LET tills  == {c \in Cells : journal[c] = "till" /\ cell[c] = "tilled"}
         plants == {c \in Cells : journal[c] = "plant" /\ cell[c] = "crop"}
     IN \E back \in {s \in SUBSET plants : Cardinality(s) = Min(BagCap - bag, Cardinality(plants))} :
          /\ cell' = [c \in Cells |-> IF c \in tills THEN "grass"
                                      ELSE IF c \in back THEN "tilled" ELSE cell[c]]
          /\ bag' = bag + Cardinality(back)
  /\ journal' = [c \in Cells |-> "none"]
  /\ UNCHANGED <<active, busy, slot, primary, stroke, gained, lost, commits, wrongHand>>

-----------------------------------------------------------------------------
(* The rest of the game, which may change a cell or the bag between any two
   events: a click outside build mode, a crop that grows, a pet that finds a
   seed, a quest that takes some.                                            *)

Quiet == UNCHANGED <<active, busy, slot, primary, stroke, journal, commits, wrongHand>>

WorldTills(c) == WorldMoves /\ cell[c] = "grass" /\ cell' = [cell EXCEPT ![c] = "tilled"]
                 /\ UNCHANGED <<bag, gained, lost>> /\ Quiet
WorldPlants(c) == WorldMoves /\ cell[c] = "tilled" /\ bag > 0 /\ cell' = [cell EXCEPT ![c] = "crop"]
                  /\ bag' = bag - 1 /\ UNCHANGED <<gained, lost>> /\ Quiet
WorldGrows(c) == WorldMoves /\ cell[c] = "crop" /\ cell' = [cell EXCEPT ![c] = "grown"]
                 /\ UNCHANGED <<bag, gained, lost>> /\ Quiet
\* The soil is broken and the seed goes back to the bag. crops `uproot` loses it when the bag is full.
WorldUproots(c) == /\ WorldMoves /\ cell[c] \in {"crop", "grown"}
                   /\ bag < BagCap \/ gained + lost < EnvBudget
                   /\ cell' = [cell EXCEPT ![c] = "grass"]
                   /\ IF bag < BagCap THEN bag' = bag + 1 /\ lost' = lost ELSE bag' = bag /\ lost' = lost + 1
                   /\ UNCHANGED gained /\ Quiet
WorldBuilds(c) == WorldMoves /\ cell[c] \in {"grass", "tilled"} /\ cell' = [cell EXCEPT ![c] = "rock"]
                  /\ UNCHANGED <<bag, gained, lost>> /\ Quiet
BagGains == gained + lost < EnvBudget /\ bag < BagCap /\ bag' = bag + 1 /\ gained' = gained + 1
            /\ UNCHANGED <<cell, lost>> /\ Quiet
BagLoses == gained + lost < EnvBudget /\ bag > 0 /\ bag' = bag - 1 /\ lost' = lost + 1
            /\ UNCHANGED <<cell, gained>> /\ Quiet

World == \E c \in Cells : WorldTills(c) \/ WorldPlants(c) \/ WorldGrows(c) \/ WorldUproots(c) \/ WorldBuilds(c)

Next ==
  \/ ButtonDown \/ Drag \/ ButtonUp \/ ExtraRelease \/ ButtonLost \/ RightPress
  \/ SwitchHand \/ ToggleMode \/ BusyOn \/ BusyOff \/ Step \/ Undo
  \/ World \/ BagGains \/ BagLoses

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* The rules.                                                                *)

TypeOK ==
  /\ active \in BOOLEAN /\ busy \in BOOLEAN /\ primary \in BOOLEAN /\ wrongHand \in BOOLEAN
  /\ slot \in Tools
  /\ bag \in Int
  /\ cell \in [Cells -> {"grass", "tilled", "crop", "grown", "rock"}]
  /\ stroke.on \in BOOLEAN /\ stroke.cover \subseteq Cells
  /\ journal \in [Cells -> {"none", "till", "plant"}]

\* A stroke exists only while the button is held: none is left hanging when the hand lets go.
NoStuckStroke == stroke.on => primary

\* One press of the button applies at most one stroke.
OneStrokePerPress == commits <= 1

\* A stroke is applied only in build mode, with the player free, with the item it was pressed with.
AppliedWithTheSameHand == ~wrongHand

\* The bag never goes below nothing and never over what it holds.
BagInBounds == bag >= 0 /\ bag <= BagCap

\* Every seed is in the bag or in the ground: a stroke takes one for each cell it
\* plants, and an undo gives one back for each crop it pulls.
SeedsConserved == bag + Cardinality(Crops) = StartSeeds + gained - lost

=============================================================================
