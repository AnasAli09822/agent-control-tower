# Failure tests — main Neon database

Migration 006 closes a verified defensive gap: the previous guard could accept a synthetic old running-run context after its authoritative agent had been killed or advanced to a different epoch. That earlier fixture was a database probe, not evidence of a deployed worker exploit.

The correction was first tested on isolated branch `br-square-dew-b57d7tcl`, then applied atomically to main with explicit user approval at 2026-09-30T20:44:16.039Z. Both the old guard and exact approval foreign keys remain enabled.

## Fresh complete acceptance

The 2026-10-01 private verification service created a new workspace with zero initial runs and credits. It executed normal Infra, Support and Sales tasks, approved the exact $350 credit once, rejected the discount without applying it, verified scope and payload/action/risk substitution defenses, then ran rogue Infra. Drift reached 92; both production proposals were blocked and the service rate limit stayed 1200.

Resume, pause and kill returned 200. The stale worker probe returned SQLSTATE 55000. Resume after kill returned 409. An active agent at epoch 1 with an old running run/worker at epoch 0 also returned SQLSTATE 55000.

## Actual overlapping worker and kill

An actual `executeTool` credit transaction held the guard's agent/run locks while its application callback waited at a coordinated barrier. A separate HTTP operator kill overlapped it. PostgreSQL showed PID 1413 blocked by worker PID 1416. The barrier then released; exactly one credit and one tool action committed before kill completed. A later stale attempt was denied before its callback, with no additional action or effect.

## Actual overlapping approval and kill

Two real HTTP handlers queued behind an agent row lock. PostgreSQL showed kill PID 1414 blocked by holder PID 1413, and approval PID 1416 queued behind kill PID 1414. After release, kill returned 200 and the approval returned `409 conflict:approval_cancelled`, without deadlock. The lead stayed new with its original 18% request; the proposed 15% discount was never applied.

The observer follows the complete lock chain because PostgreSQL may report the first waiter as the blocker of the second waiter. Two parallel connector calls without observed database overlap are not accepted as this evidence.

All 29 acceptance checks passed. Full inputs, IDs, response/effect evidence and timestamps are in `docs/evidence/2026-10-01-acceptance.json`. Business systems and agent usage are simulated; the transactions and guard behavior are actual database execution.
