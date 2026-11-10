# Brief for a style agent

You are one of five agents in the style lab. Read `docs/style-lab/README.md` and
`.agents/skills/verify-style-lab/SKILL.md` first, then `AGENTS.md`. Your style, its slug and its port are in
your task.

## Your checkout

- You are in your own git worktree, made from branch `style/lab`. Make a branch `style/<slug>` and commit
  each working slice there as you go. Nobody merges your branch into another style's; Kausthubh picks one.
- Your style lives behind `?style=<slug>`. Without it the game must look and behave exactly as on
  `style/lab`. Within your branch you may change any file, `src/engine` and `src/main.ts` included, as long as
  that holds.
- The lab's own tools may get fixes on `style/lab` while you work. Run `git merge style/lab` before your
  final shoot.
- If `node_modules` is missing, run `bun install` in your worktree. Never add a dependency; if you need one,
  say so in your report and work around it.
- Put assets in `public/assets/styles/<slug>/`, raw images and prompts in `assets-src/styles/<slug>/`, notes and
  the look bible in `docs/style-lab/<slug>/`, screenshots in `.artifacts/style-lab/<slug>/`.

## This Mac is shared

Many agents run headless Chrome here at once and the load is high. Run one shoot at a time, in the
background, and shoot only the place or clip you changed while you iterate. Stop every server you start by
its pid.

## Image generation and models

- Images: start a Codex child with `delegate_task`, `target: { providerInstanceId: "codex", model:
  "gpt-6.1-sol", options: { reasoningEffort: "medium" } }`, `isolation: "shared"`. Its brief needs: the
  reference image paths to attach, the palette, the exact pixel size, transparent or not, the output path,
  and "save every attempt". It knows nothing else.
- 3D: run Blender 5.3 headless yourself. If a model is beyond what you can script well, write
  `docs/style-lab/<slug>/model-request.md` for Kausthubh's stronger modelling agent (see
  `docs/style-lab/anime/model-request.md` for the shape) and keep going with your own first pass.

## Your report

End with PASS, ISSUES or BLOCKED, then:
- the branch and last commit;
- the `card.png` path and the three motion strips that show your style best;
- the counts at every place;
- the pipeline cost, from STYLE.md: tries per asset, failures, and the measured cost to add one villager, one
  action and one prop;
- the three biggest gaps left against the reference, in plain words;
- what you did not check.
Do not rank your style against the others. Kausthubh judges.
