# Project status — Agent Control Tower

Status date: 2026-09-22.

| Phase | Status | Evidence / remaining gate |
|---|---|---|
| 0 — Plan / Context Lock | complete | master plan, context lock, decision log established |
| 1 — Data / Control Model | complete + recovered | 30-table schema, constraints, indexes, seed, transition rules; clean bootstrap validated |
| 2 — Core Control Plane | complete + main hardened | pause/resume/kill, approvals, epoch guard, append-only audit; migration 005 tested and applied to main |
| 3 — Three agents | implemented | Sales, Support, Infra simulator evidence exists in main acceptance data; deterministic source recovered |
| 4 — Eventing / SSE | live baseline exists; hardened source validated | persisted sequences and reconnect probes exist; signed scoped reconnect source not yet deployed |
| 5 — Operator UI | source complete, external build pending | fleet, approvals, controls, replay, cost/tokens, live stream, CSV/JSON export; CI build still needed |
| 6 — Rogue scenario | backend acceptance evidence complete; recovered source implemented | critical drift → auto-pause → kill → stale worker rejection demonstrated |
| 7 — Adversarial audit | complete for database/control invariants | payload/action/risk/scope/unapproved/stale attacks rejected; migration 005 applied to main and post-apply integrity is clean |
| 8 — Public deploy | GitHub publication in progress; Vercel pending | public repo `AnasAli09822/agent-control-tower` now exists and source/CI are being published; Vercel is connected to team `nathmagency-2935s-projects`, but no dedicated `agent-control-tower` project exists yet |
| 9 — External acceptance | pending | requires deployed hardened source/UI and fresh end-to-end run |
| 10 — Submission freeze | pending | only after Phase 8/9 gates close |

## Current next actions

1. Finish publishing this clean source tree to public GitHub repo `AnasAli09822/agent-control-tower` and require CI to pass `validate:source` plus full `next build`.
2. Deploy bundled `actcontrol` + `actevents` from source using a dependency-aware Neon deployment path; raw zip deployment is invalid because dependencies such as `pg` must be bundled.
3. Create a dedicated Vercel project `agent-control-tower`, configure server-only environment variables, and deploy the Next.js operator UI.
4. Run fresh external acceptance against the deployed hardened stack and capture the 90-second walkthrough.
5. Freeze submission artifacts only after those checks pass.
