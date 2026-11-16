# The first world calm omits its key

The first-night fox uses E, but the thistlehog uses held F. The world fight's introduction names the Mark without naming F, and the current quest's log had no hint. The lab has F guidance; the world HUD does not expose that lab help.

The browser command below loads an unedited earned pre-fight checkpoint, enters through Continue, opens the real quest log, captures it and checks for the needed instruction. `guidance-red` fails on the missing key; `guidance-green` passes after adding the attack and held-F instruction to the current thistlehog step's existing hint. Narrative, controls, balance, scenes and rewards are unchanged. This is a UI guidance check, not an additional earned completion.

`PLAY_PORT=5562 bun tools/play-homestead.mjs --guidance-only --save .artifacts/homestead-input/crated-resume13/earned-before-thistlehog.save.json --out <new-directory>`
