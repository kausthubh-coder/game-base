# Camera drag survives losing mouse capture

The user reported cursor trouble after Escape or UI clicks and continued rotation after a right drag.

`bun test src/game/shell/keys.test.ts` reproduced three failures in the real input handler: lost pointer capture left the right drag active, Escape did not cancel it, and opening UI retained queued camera movement. The initial result was zero passes and three failures.

The handler now cancels right-drag state and queued movement on capture loss or Escape, and cancels a missed release when the next pointer move reports no right button. A real right-button release during a multi-button gesture still clicks once. Existing click-versus-drag behavior is preserved.

`bun test src/game/shell/keys.test.ts src/game/shell/drag.test.ts` passes 12 tests. This is input-handler proof using DOM event stand-ins. Real browser mouse, pointer lock, menu and touch checks remain pending. This does not establish that unrestricted horizontal camera rotation itself is a defect.
