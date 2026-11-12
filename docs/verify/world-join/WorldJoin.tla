------------------------------ MODULE WorldJoin ------------------------------
(* Joining and leaving one online world, and the world's card in Convex's world
   list. This is the design of server/world.ts with the browser's side from
   src/features/net/net.ts and Convex's side from convex/worlds.ts `writeCard`,
   small enough for a checker to walk every order of events. Each action below
   names the code it stands for.

   One handler of the Durable Object runs to its end, or to an await, before
   the next event is let in, so each server action is one step. The hello's
   two awaits (the token check, then Convex's mayEnter) are one wait here:
   nothing the server holds changes between them.                            *)
EXTENDS Integers, FiniteSets, Sequences

CONSTANTS
  Users,        \* the players
  Twins,        \* the players who also play from a second tab: a subset of Users
  Cap,          \* how many players the world holds: MAX_PLAYERS in room.ts, smaller here
  Tries,        \* how many sockets the tabs may open between them
  MaxRestarts,  \* how many times the world server may restart: a deploy, a crash
  PostsCanFail, \* TRUE lets a card post fail on its way to Convex
  Periodic      \* how many of the 5-minute cards may go

Tabs == (Users \X {1}) \cup (Twins \X {2})
\* A socket is a tab and the number of its try: <<tab, n>>.
Sockets == Tabs \X (1..Tries)
UserOf(s) == s[1][1]
TabOf(s) == s[1]

\* What a close from the server makes net.ts do: "stop" for 4000 refused and 4001 replaced,
\* "again" for 4002 restart and 4003 quiet, which connect again.
Codes == {"none", "stop", "again"}

VARIABLES
  page,      \* each tab: "shut" or "open"
  mode,      \* each tab as net.ts sees it: "idle", "connecting", "in" or "stopped"
  conn,      \* each tab: how many sockets it has opened. Its socket is <<t, conn[t]>>
  tries,     \* sockets opened by all the tabs
  up,        \* each socket: the browser's end is open
  told,      \* each socket: the close code the server sent that the browser has not read
  helloDue,  \* each socket: its hello is on the way to the server
  closeDue,  \* each socket: its close is on the way to the server
  sess,      \* each socket: world.ts `sessions`: "none", "waiting", "checking" or "in"
  asking,    \* each socket: the token check and mayEnter are awaited
  room,      \* the players in the world: room.ts `players`
  sockOf,    \* each player: world.ts `sockets`, the socket they play through, {} or {s}
  stepping,  \* world.ts `timer` is set
  restarts,  \* restarts so far
  periodic,  \* 5-minute cards so far
  posts,     \* card posts on their way to Convex that it would still take, oldest first
  card       \* the players Convex's world list shows: worlds.playersNow

browser == <<page, mode, conn, tries, up, told, helloDue, closeDue>>
server == <<sess, asking, room, sockOf, stepping, restarts, periodic>>
vars == <<browser, server, posts, card>>

\* The tab's socket now.
Cur(t) == <<t, conn[t]>>

Init ==
  /\ page = [t \in Tabs |-> "shut"]
  /\ mode = [t \in Tabs |-> "idle"]
  /\ conn = [t \in Tabs |-> 0] /\ tries = 0
  /\ up = [s \in Sockets |-> FALSE]
  /\ told = [s \in Sockets |-> "none"]
  /\ helloDue = [s \in Sockets |-> FALSE]
  /\ closeDue = [s \in Sockets |-> FALSE]
  /\ sess = [s \in Sockets |-> "none"]
  /\ asking = [s \in Sockets |-> FALSE]
  /\ room = {}
  /\ sockOf = [u \in Users |-> {}]
  /\ stepping = FALSE
  /\ restarts = 0 /\ periodic = 0
  /\ posts = <<>> /\ card = {}

-----------------------------------------------------------------------------
(* What the server does, written once.                                       *)

\* world.ts postCard(): the players in the room, stamped later than every card before it.
\* Only the order of the stamps matters, so the model keeps the posts in the order they
\* were made. The code stamps with Date.now(), or one more than its last stamp, and a
\* restart forgets its last stamp: the model takes the clock to have passed it by then.
Post(players) == posts' = Append(posts, players)

\* ws.close(code) from the server. A socket the browser has let go, or one the server
\* closed already, hears nothing more.
Told(s, code) == IF up[s] /\ told[s] = "none" THEN [told EXCEPT ![s] = code] ELSE told

\* world.ts gone(): the session is forgotten. A player who was in leaves, and the last
\* one out puts the world to sleep. Either way one card goes.
Gone(s) ==
  LET u == UserOf(s) IN
  IF sess[s] = "in" /\ sockOf[u] = {s}
  THEN /\ sess' = [sess EXCEPT ![s] = "none"]
       /\ room' = room \ {u}
       /\ sockOf' = [sockOf EXCEPT ![u] = {}]
       /\ stepping' = (stepping /\ room \ {u} # {})
       /\ Post(room \ {u})
  ELSE /\ sess' = [sess EXCEPT ![s] = "none"]
       /\ UNCHANGED <<room, sockOf, stepping, posts>>

\* world.ts end(): the server closes a socket and forgets it.
End(s, code) ==
  /\ told' = Told(s, code)
  /\ Gone(s)

-----------------------------------------------------------------------------
(* The browser. net.ts opens one socket at a time for a tab, says hello when
   it opens, sends an input every step once it is welcomed, and connects
   again after any close but `refused` and `replaced`.                      *)

\* A player opens the game in a tab.
OpenPage(t) ==
  /\ page[t] = "shut"
  /\ page' = [page EXCEPT ![t] = "open"]
  /\ mode' = [mode EXCEPT ![t] = "idle"]
  /\ UNCHANGED <<conn, tries, up, told, helloDue, closeDue, server, posts, card>>

\* net.ts start(), and world.ts fetch(): the socket is accepted, its session made and
\* its hello timer started. The hello leaves at once.
Connect(t) ==
  /\ page[t] = "open" /\ mode[t] = "idle" /\ tries < Tries
  /\ LET s == <<t, conn[t] + 1>> IN
       /\ conn' = [conn EXCEPT ![t] = @ + 1]
       /\ tries' = tries + 1
       /\ mode' = [mode EXCEPT ![t] = "connecting"]
       /\ up' = [up EXCEPT ![s] = TRUE]
       /\ helloDue' = [helloDue EXCEPT ![s] = TRUE]
       /\ sess' = [sess EXCEPT ![s] = "waiting"]
  /\ UNCHANGED <<page, told, closeDue, asking, room, sockOf, stepping, restarts, periodic, posts, card>>

\* The browser's end of its socket goes. `heard` says whether the server is told: a
\* closed tab or a line that drops cleanly tells it, a lid shut on a laptop does not.
LetGo(t, heard) ==
  LET s == Cur(t) IN
  /\ mode[t] \in {"connecting", "in"}
  /\ up' = [up EXCEPT ![s] = FALSE]
  /\ told' = [told EXCEPT ![s] = "none"]
  /\ closeDue' = [closeDue EXCEPT ![s] = heard]
  /\ mode' = [mode EXCEPT ![t] = "idle"]

\* The player closes the tab.
ClosePage(t) ==
  /\ page[t] = "open"
  /\ page' = [page EXCEPT ![t] = "shut"]
  /\ IF mode[t] \in {"connecting", "in"}
     THEN \E heard \in BOOLEAN : LetGo(t, heard)
     ELSE UNCHANGED <<mode, up, told, closeDue>>
  /\ UNCHANGED <<conn, tries, helloDue, server, posts, card>>

\* The line drops with the tab still open. net.ts connects again.
Drop(t) ==
  /\ page[t] = "open"
  /\ \E heard \in BOOLEAN : LetGo(t, heard)
  /\ UNCHANGED <<page, conn, tries, helloDue, server, posts, card>>

\* net.ts onclose for a close the server sent.
HearClose(t) ==
  LET s == Cur(t) IN
  /\ mode[t] \in {"connecting", "in"} /\ told[s] # "none"
  /\ up' = [up EXCEPT ![s] = FALSE]
  /\ told' = [told EXCEPT ![s] = "none"]
  /\ mode' = [mode EXCEPT ![t] = IF told[s] = "stop" THEN "stopped" ELSE "idle"]
  /\ UNCHANGED <<page, conn, tries, helloDue, closeDue, server, posts, card>>

\* A welcomed tab sends an input. Only one the server does not know changes anything:
\* world.ts webSocketMessage() with no session closes it with 4002.
Talk(t) ==
  LET s == Cur(t) IN
  /\ mode[t] = "in" /\ up[s] /\ told[s] = "none" /\ sess[s] = "none"
  /\ End(s, "again")
  /\ UNCHANGED <<page, mode, conn, tries, up, helloDue, closeDue, asking, restarts, periodic, card>>

-----------------------------------------------------------------------------
(* The server. Each action is one handler of world.ts, run to its end or to
   its await.                                                               *)

\* webSocketMessage() with the hello. A session that is waiting starts the check. A socket
\* with no session belongs to a world that restarted, or its hello timer ran out: 4002.
HelloArrives(s) ==
  /\ helloDue[s]
  /\ helloDue' = [helloDue EXCEPT ![s] = FALSE]
  /\ IF sess[s] = "waiting"
     THEN /\ sess' = [sess EXCEPT ![s] = "checking"]
          /\ asking' = [asking EXCEPT ![s] = TRUE]
          /\ UNCHANGED <<told, room, sockOf, stepping, posts>>
     ELSE /\ End(s, "again")
          /\ UNCHANGED asking
  /\ UNCHANGED <<page, mode, conn, tries, up, closeDue, restarts, periodic, card>>

\* The awaits return. A refusal closes the socket whether or not it is still there. An
\* entry is taken only while the session is the same one: the socket may have closed.
\* Then the room wakes, the player's older socket is replaced, room.join() runs, which
\* takes the player out first and is null when the world is full, and the welcome goes.
Answer(s, ok) ==
  LET u == UserOf(s)
      t == TabOf(s)
      rest == room \ {u}
  IN
  /\ asking[s]
  /\ asking' = [asking EXCEPT ![s] = FALSE]
  /\ UNCHANGED <<page, conn, tries, helloDue, closeDue, restarts, periodic, card>>
  /\ CASE ~ok ->
            /\ End(s, "stop")
            /\ UNCHANGED <<mode, up>>
       [] ok /\ sess[s] # "checking" ->
            UNCHANGED <<mode, up, told, sess, room, sockOf, stepping, posts>>
       [] OTHER ->
            \* sessions.delete(before) and end(before, replaced): its gone() then finds no session.
            LET olds == {b \in sockOf[u] : b # s}
                told1 == [x \in Sockets |-> IF x \in olds /\ up[x] /\ told[x] = "none" THEN "stop" ELSE told[x]]
                sess1 == [x \in Sockets |-> IF x \in olds THEN "none" ELSE sess[x]]
            IN
            IF Cardinality(rest) >= Cap
            THEN \* room.join() took the player out and found the world full: refuse(ws, 'full').
                 /\ room' = rest
                 /\ told' = [told1 EXCEPT ![s] = IF up[s] /\ told[s] = "none" THEN "stop" ELSE @]
                 /\ sess' = [sess1 EXCEPT ![s] = "none"]
                 /\ UNCHANGED <<mode, up, sockOf, stepping, posts>>
            ELSE /\ room' = rest \cup {u}
                 /\ told' = told1
                 /\ sess' = [sess1 EXCEPT ![s] = "in"]
                 /\ sockOf' = [sockOf EXCEPT ![u] = {s}]
                 /\ stepping' = TRUE
                 /\ mode' = IF up[s] THEN [mode EXCEPT ![t] = "in"] ELSE mode
                 /\ Post(rest \cup {u})
                 /\ UNCHANGED up

\* webSocketClose() or webSocketError(): gone(). A close comes after the socket's hello.
CloseArrives(s) ==
  /\ closeDue[s] /\ ~helloDue[s]
  /\ closeDue' = [closeDue EXCEPT ![s] = FALSE]
  /\ Gone(s)
  /\ UNCHANGED <<page, mode, conn, tries, up, told, helloDue, asking, restarts, periodic, card>>

\* The hello timer of fetch(): no player after 10 seconds.
HelloTimeout(s) ==
  /\ sess[s] \in {"waiting", "checking"}
  /\ End(s, "again")
  /\ UNCHANGED <<page, mode, conn, tries, up, helloDue, closeDue, asking, restarts, periodic, card>>

\* dropQuiet() in tick(): a player whose browser has gone silent for 15 seconds.
QuietDrop(s) ==
  /\ stepping /\ sess[s] = "in" /\ ~up[s]
  /\ End(s, "again")
  /\ UNCHANGED <<page, mode, conn, tries, up, helloDue, closeDue, asking, restarts, periodic, card>>

\* tick(): the 5-minute card while players are in.
CardTimer ==
  /\ stepping /\ periodic < Periodic
  /\ periodic' = periodic + 1
  /\ Post(room)
  /\ UNCHANGED <<browser, sess, asking, room, sockOf, stepping, restarts, card>>

\* A deploy or a crash: the Durable Object starts again with nothing in memory. The
\* sockets stay open (the hibernation API keeps them), events on the way reach the new
\* object, and posts already sent still land.
Restart ==
  /\ restarts < MaxRestarts
  /\ restarts' = restarts + 1
  /\ sess' = [s \in Sockets |-> "none"]
  /\ asking' = [s \in Sockets |-> FALSE]
  /\ room' = {}
  /\ sockOf' = [u \in Users |-> {}]
  /\ stepping' = FALSE
  /\ UNCHANGED <<browser, periodic, posts, card>>

-----------------------------------------------------------------------------
(* Convex.                                                                   *)

Without(seq, i) == [j \in 1..Len(seq) - 1 |-> IF j < i THEN seq[j] ELSE seq[j + 1]]

\* worlds.ts writeCard() takes the card. It drops a card made before the one it holds, as
\* `sentAt < cardAt`, so every post made before this one will change nothing when it lands.
\* The model lets those go at once.
Land == \E i \in 1..Len(posts) :
  /\ card' = posts[i]
  /\ posts' = SubSeq(posts, i + 1, Len(posts))
  /\ UNCHANGED <<browser, server>>

\* gate.ts postCard(): a post that fails is logged, and never sent again.
Lost == \E i \in 1..Len(posts) :
  /\ PostsCanFail
  /\ posts' = Without(posts, i)
  /\ UNCHANGED <<browser, server, card>>

-----------------------------------------------------------------------------

Next ==
  \/ \E t \in Tabs : OpenPage(t) \/ Connect(t) \/ ClosePage(t) \/ Drop(t) \/ HearClose(t) \/ Talk(t)
  \/ \E s \in Sockets : HelloArrives(s) \/ CloseArrives(s) \/ HelloTimeout(s) \/ QuietDrop(s)
  \/ \E s \in Sockets, ok \in BOOLEAN : Answer(s, ok)
  \/ CardTimer \/ Restart
  \/ Land \/ Lost

\* The server and Convex get to every event in the end. Players need not do anything.
Fairness ==
  /\ \A s \in Sockets :
       /\ WF_vars(HelloArrives(s)) /\ WF_vars(CloseArrives(s))
       /\ WF_vars(\E ok \in BOOLEAN : Answer(s, ok))
       /\ WF_vars(HelloTimeout(s)) /\ WF_vars(QuietDrop(s))
  /\ WF_vars(Land \/ Lost)

Spec == Init /\ [][Next]_vars /\ Fairness

-----------------------------------------------------------------------------
(* The rules.                                                                *)

TypeOK ==
  /\ page \in [Tabs -> {"shut", "open"}]
  /\ mode \in [Tabs -> {"idle", "connecting", "in", "stopped"}]
  /\ conn \in [Tabs -> 0..Tries] /\ tries \in 0..Tries
  /\ up \in [Sockets -> BOOLEAN] /\ told \in [Sockets -> Codes]
  /\ helloDue \in [Sockets -> BOOLEAN] /\ closeDue \in [Sockets -> BOOLEAN]
  /\ sess \in [Sockets -> {"none", "waiting", "checking", "in"}]
  /\ asking \in [Sockets -> BOOLEAN]
  /\ room \subseteq Users
  /\ sockOf \in [Users -> SUBSET Sockets]
  /\ stepping \in BOOLEAN
  /\ \A i \in 1..Len(posts) : posts[i] \subseteq Users
  /\ card \subseteq Users

\* One player is played from one tab at a time: no two tabs steer the same body or both get its snaps.
OneTabPlaysEachPlayer ==
  \A u \in Users : Cardinality({s \in Sockets : UserOf(s) = u /\ sess[s] = "in"}) <= 1

\* Every body in the world has a socket the server hears it through. A body without one is
\* never dropped for silence, so it stands in the world and keeps it awake for good.
NoBodyWithoutATab == \A u \in room : \E s \in sockOf[u] : sess[s] = "in"

\* Every welcomed session has its body, and is the one the body is played through. One
\* without is a player who was let in and stands frozen, told nothing.
NoTabWithoutABody ==
  \A s \in Sockets : sess[s] = "in" => UserOf(s) \in room /\ sockOf[UserOf(s)] = {s}

\* The world steps while someone is in and only then: an empty world that steps costs
\* money for nothing, and a world with players that does not step freezes them.
AwakeExactlyWhileSomeoneIsIn == stepping <=> room # {}

\* Nothing is left for anyone to do: no event or post on its way, every session is an
\* open tab that is in, every tab that is in has its session, and every open tab is in
\* or has stopped.
Settled ==
  /\ posts = <<>>
  /\ \A s \in Sockets : ~helloDue[s] /\ ~closeDue[s] /\ ~asking[s] /\ told[s] = "none"
  /\ \A s \in Sockets : sess[s] # "none" => up[s] /\ s = Cur(TabOf(s)) /\ mode[TabOf(s)] = "in"
  /\ \A t \in Tabs : mode[t] = "in" => sess[Cur(t)] = "in"
  /\ \A t \in Tabs : page[t] = "open" => mode[t] \in {"in", "stopped"}

\* Once everything has settled, the world list shows exactly who is in the world. Otherwise
\* it shows a player who left as playing now, or hides one who is there.
CardMatchesTheWorld == Settled => card = room

AllShut == \A t \in Tabs : page[t] = "shut"

\* Once every tab is closed, the world stops stepping, unless someone comes back.
SleepsOnceEveryoneHasGone == AllShut ~> (~stepping \/ ~AllShut)

=============================================================================
