# Resource-aware parallel work

The user requested adaptive concurrency on November 15. This supersedes the fixed single heavy-job rule in the Echo and tent briefs.

Run `bun tools/resource-status.mjs` before starting a build or browser and about every 30 seconds during long jobs. It samples CPU idle time, a reclaimable memory estimate, memory pressure, interval swapouts and available disk space. These are scheduling rules, not measured throughput or guarantees about a job's memory needs.

| Decision | CPU idle | Reclaimable estimate | Disk available | Other requirements |
|---|---|---|---|---|
| Start the first heavy job | At least 10% | At least 1 GiB | At least 2 GiB | Normal pressure and zero interval swapouts |
| Add a second independent job | At least 30% | At least 2 GiB | At least 3 GiB | Normal pressure and zero interval swapouts |

`sample()` returns `admitFirst`, `admitAdditional` and `heavyLimit`. The limit is 0 when new work must pause, 1 when a first job may start, or 2 when a second job may start. Existing work can finish or checkpoint when admission closes. Failed probes and missing or non-finite measurements authorize no new work.

A caller must know how many heavy jobs are already active across the machine. Use `canStartHeavy(await sample(), activeHeavyJobs)` immediately before launch. Zero active jobs uses `admitFirst`; one uses `admitAdditional`; two or an invalid count always denies. Count browser jobs from other worktrees too. This helper neither discovers jobs nor reserves a slot. The coordinator must serialize admission and launch, or use a shared reservation mechanism that maintains the count. An old sample or two simultaneous callers cannot establish ownership. At most two heavy jobs may run.

Source edits and short focused tests can overlap. Never stop another task's process to reduce load. Approved screenshot comparisons and performance measurements run alone. Ordinary functional browser checks may overlap when admitted.

## Memory semantics and the November 15 hold

The previous probe admitted only a second job and used `top` unused memory for its reserve. The Pump caller required that second-job result even with no active heavy job. This made a first-only decision impossible. It also kept the gate closed on a cache-heavy Mac with little unused memory and normal pressure.

The replacement estimate is `(vm_stat Pages free + File-backed pages) * reported page size`. `Pages free` already excludes speculative pages in Apple's [vm_stat implementation](https://github.com/apple-oss-distributions/system_cmds/blob/408bba7453608006b89772db185defbac8fe2fd0/vm_stat/vm_stat.c#L132). The [host statistics implementation](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/osfmk/kern/host.c#L818) reports the pageable external count as file-backed pages. Speculative pages overlap that category, so the estimate does not add them again.

Apple describes file-backed and free pages as memory the kernel can reclaim. Its [memory monitoring documentation](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/doc/vm/memorystatus.md#L109) gives free plus file-backed as an approximation under pressure. This scheduler adopts that narrower estimate. It excludes anonymous inactive pages and compressed memory. Purgeable pages are diagnostic only, because the [kernel formula](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/osfmk/vm/vm_page.h#L1533) treats them differently when dynamic paging is enabled. The scheduler does not claim to reproduce the macOS available-page formula.

`memory_pressure -Q` reported 80% while `top` reported little unused memory. That percentage is unsuitable as an allocation reserve. The [tool reads memorystatus_get_level](https://github.com/apple-oss-distributions/system_cmds/blob/408bba7453608006b89772db185defbac8fe2fd0/memory_pressure/memory_pressure.c#L118), which uses the kernel's broader pressure accounting. The [macOS formula](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/osfmk/vm/vm_page.h#L1549) includes noncompressed working-set memory. This percentage is not a promise that 80% of physical RAM can be allocated without reclaiming other pages.

The pressure sysctl remains a separate hard veto. Its [handler converts internal levels to dispatch flags](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/kern_memorystatus_notify.c#L1885). Normal is 1 at this interface, even though the internal normal enum is 0. Warning and critical states deny admission. The final parenthesized swapout count from the second `top` sample measures the interval, so old boot-time swaps do not permanently close the gate.

File-backed pages can be hot or dirty. Reclaiming them can cause file I/O and cache misses. This estimate supports admission with normal pressure and no observed swapping; it cannot guarantee an arbitrary build or browser will fit. Resample during overlap and stop launching work if pressure or swapouts rise. The source links above are pinned public Apple implementations, not proof that every line matches the installed kernel binary.

## Output ownership and evidence

Echo owns `dist-bench-copper` and port 5559. Tent verification owns `dist-tent-verified` and port 5563; prop captures must use that owned output or a distinct named output and port. Never rebuild an output while a server serves it. Broad verifier output directories also need exclusive ownership.

The existing single lock may be retired by its current owner after checking for active jobs. Admission does not cancel a running job. Each task records fresh resource samples with its verification logs and reports timeouts or resource failures. Keep raw saves and artifacts.

The diagnosis, failing and passing fixture logs, raw resource samples and pinned source hashes are in `.artifacts/resource-admission/`. Run `bun test tools/resource-status.test.mjs` to check first versus second admission, memory accounting, interval swaps, threshold boundaries and missing-data refusal. This light change has not run the full verifier or launched a browser. The coordinator must verify the Pump caller and real launch separately.
