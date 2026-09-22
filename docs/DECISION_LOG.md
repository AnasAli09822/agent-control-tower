# Decision log

## ACT-DEC-001 — Standalone challenge isolation
Accepted 2026-09-21. No runtime or submission dependency on previous challenge projects.

## ACT-DEC-002 — Control-epoch kill semantics
Accepted 2026-09-21. Kill increments authoritative `control_epoch`; every guarded tool mutation must re-check it.

## ACT-DEC-003 — Structured reasoning replay
Accepted 2026-09-21. Persist operational summaries/evidence, not hidden chain-of-thought.

## ACT-DEC-004 — Neon Function control plane + Vercel UI
Accepted 2026-09-21. Neon Postgres is durable state; Neon Functions host control/SSE; Vercel hosts the Next.js operator UI.

## ACT-DEC-005 — Source recovery before UI expansion
Accepted 2026-09-22. Existing Neon functions and acceptance evidence are preserved as the running baseline. New source is reconstructed and tested before replacing any deployed function, preventing an unreviewed regression of the working control plane.

## ACT-DEC-006 — Exact approval binding at execution time
Accepted 2026-09-22. The database execution guard recomputes SHA-256 from `NEW.action_payload` inside the trigger and binds approval to exact workspace/team/agent/run/task/tool/risk score. It does not trust the generated hash column during a `BEFORE` trigger, because generated-column materialization is not a safe source for this comparison at that point.

## ACT-DEC-007 — Signed direct SSE with scoped reconnect
Accepted 2026-09-22. The browser may connect directly to the Neon SSE Function for long-lived streaming, but it never receives the control-plane secret. Vercel mints a 120-second HMAC token bound to the exact demo workspace/team. Reconnect obtains a fresh token and resumes from the last persisted workspace sequence.

## ACT-DEC-008 — Public demo is scope-constrained at the proxy
Accepted 2026-09-22. The public Vercel proxy may act only on the canonical demo workspace, known demo teams, known agents, and demo operator identity. The server-held control API key must not become a generic credential for arbitrary workspaces.


## ACT-DEC-009 — Declarative exact execution binding
Accepted 2026-09-22. Migration 005 adds deferrable composite foreign keys that bind every ToolAction to its exact run scope and, at execution/success states, to the approved workspace/team/agent/run/task/tool/payload-hash/risk-score/status tuple. This provides post-generation enforcement independent of BEFORE-trigger generated-column timing and can protect main even before migration 004 is applied.
