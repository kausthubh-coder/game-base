# Act 1 beta playtest repairs

User playtest, 16 November 2026. Repair play blockers before continuing chapter acceptance. Preserve earned saves and the existing Tailscale preview until a replacement passes. No deployment.

## Order

1. Reproduce and repair pond-to-field digging/water flow and invisible obstacles. Prove the opening irrigation objective through ordinary input.
2. Diagnose the recurring hero-to-animal animation frames during walking and shovel use. Check earlier repairs and enforce sprite ownership/frame bounds at the highest effective level. Retain a red regression and inspect every relevant frame.
3. Repair cursor release/re-entry around Escape and UI, camera drag behavior, first-person hero visibility, opening audio overlap, NPC placement inside stone, and water/bridge visual defects. Separate confirmed defects from camera/art symptoms.
4. Provide a verified private Tailscale preview with save continuity explained. Resume Light, Seed Vault and remaining Act 1; retain the final end-to-end replay.

## Later design work

Keep custom guild buildings, animated doors, separate roofless room interiors, richer dialogue/character voices and broader water/city art exploration for after the beta blockers. User clarified the city itself looks good; the initial guild is the main architecture concern. Record a smooth/block terrain mode request; evaluate it after digging correctness is established.

## Ownership and evidence

Coordinator: triage, camera/input/audio follow-up, integration, preview and acceptance. Light owner: chapter tools only; stop before earned replay while runtime blockers are repaired. Sprite helper: sprite/frame diagnosis, focused regression and asset-related fix. Water helper: irrigation/collision reproduction and focused tests first; report product cause before broad terrain changes. Disjoint files only, commit owned paths only. No shared builds or browser launches without a fresh resource probe and explicit slot handoff.

User screenshots are preserved under `/Users/dabot/.t3/userdata/attachments/` with the thread prefix `de2f07c8-70dc-4bc8-a56f-b47fce6a420f-`. Current preview serves `dist-gallery-resume-hud` on 5796, PID 92343; leave it running. Test current source separately and record whether an issue also exists in the preview snapshot.

Completion requires a reproducible before/after result, focused regressions that catch the original symptom, reviewed browser captures, combined verification, and an accessible updated private preview. Chapter diagnostics are not earned progression.
