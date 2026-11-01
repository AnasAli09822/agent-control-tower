# Failure test — rogue agent containment

The public rogue scenario advances in separate server checkpoints. Infra reads stale metrics, proposes an unsupported rate-limit change (blocked; drift 70), then proposes an unsupported rollback (blocked; drift 92). The control plane automatically pauses it. Replay exposes both blocked proposals and their evidence. Kill advances the authoritative epoch and leaves the agent terminal. New session creates fresh identities while preserving that history.

The final dated evidence links the actual public acceptance results and the browser intervention observations. The public test also covers freezing an active agent, restoring a paused pending approval, approving the exact $350 credit, rejecting the 15% discount, per-task usage reconciliation and audit exports. It records both decided approval history and the empty pending queue.

## Database guards and overlapping races

The preserved [Neon acceptance report](evidence/2026-10-07-neon-acceptance.json) passed 29 guard/concurrency and 28 stepped/session checks on 2026-10-06 at 23:02 UTC. It confirms rate limit 1200 remains unchanged, no rollback is applied, the exact credit executes once, action/payload/risk/scope substitutions are rejected, concurrent viewers cannot duplicate steps, and stale post-kill actions are rejected before their application callback.

An actual worker transaction held the agent/run locks while its callback waited at a coordinated barrier. Kill connection PID 1085 was observed blocked by worker PID 1096. Releasing the barrier allowed one atomic action to commit before kill returned 200. A subsequent stale attempt produced no additional effect.

For approval/kill, holder PID 4947 blocked kill PID 4612, which in turn blocked approval PID 1085. After release, kill returned 200 and approval returned 409 conflict:approval_cancelled without deadlock. The lead remained new with its original 18% request; the proposed 15% discount was not applied. These are observed database lock chains, not an inference from sending parallel requests.

The temporary private test function was removed after verification. Fixture and audit records remain. Clean-clone CI independently boots PostgreSQL 16 and exercises the actual local frontend, signed control and SSE services.

Business domains, reasoning and usage are simulated; transactions, locks, controls, events and audits are actual application behavior. Closing the cockpit stops new simulation checkpoints until an operator connects again.
