# Play in Chrome

`bun tools/play.mjs start --mode human` builds the game and starts one browser for this worktree on port 5525. `--port` or `PLAY_PORT` selects the worktree's assigned port. The session serves its own build in `.artifacts/play/site`, so another build cannot remove its assets. The session file, log and automatic input recordings live under `.artifacts/play/`. `stop` closes Chrome and the server owned by that session.

Send `do` a JSON object. Human mode supports these inputs:

- `{"type":"click","text":"New game"}` clicks the real button.
- `{"type":"press","key":"KeyE"}` presses a key.
- `{"type":"hold","key":"KeyW","ms":250}` holds a key, then releases it.
- `{"type":"hold","key":"KeyW","until":{"path":"player.z","max":-224},"timeout":15000}` releases when a state condition becomes true, or fails on timeout.
- `{"type":"click","x":400,"y":300,"button":"right"}` and `{"type":"move","x":420,"y":300}` use the mouse.
- `{"type":"wait","ms":200}` waits.
- `{"type":"check","path":"talk.npc","equals":"tamsin"}` waits for a state assertion. Conditions accept `equals`, `min`, `max`, or truthiness.

Door mode additionally accepts `{"type":"door","method":"skipTo","args":["festival"]}`. It restricts calls to the documented mutation methods. Human mode rejects all door inputs. `state` prints JSON; `shot .artifacts/play/example.png` captures the page.

`record name` starts a named recording; `record stop` saves it. Stopping the session also saves an active named recording. Automatic recordings capture every input, including failed attempts. Copy useful recordings into `tools/play/scenarios/`. `replay tools/play/scenarios/first-talk.json` starts a session if needed, opens a clean browser context at the recorded seed, plays inputs serially and fails on console errors or failed checks. Replay resets local storage. No previous save is used.

`CHROME_SOFTWARE=1` or `start --software` selects software drawing; the default uses the available GPU. Stop and restart to change mode or renderer. The renderer is printed in the session log and stored in the session file.

`replay tools/play/scenarios/festival.json` demonstrates the door mode. Follow it with `shot .artifacts/play/festival.png`. Human mouse inputs also support `mouseDown`, `mouseUp` and `wheel`, each with the same button or coordinate fields as `click` and `move`.
