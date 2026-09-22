# Project status — Agent Control Tower

Status date: 2026-09-22.

| Phase | Status | Evidence / remaining gate |
|---|---|---|
| 0 — Plan / Context Lock | complete | master plan, context lock, decision log established |
| 1 — Data / Control Model | complete + recovered | 30-table schema, constraints, indexes, seed, transition rules; clean bootstrap validated |
| 2 — Core Control Plane | complete + main hardened | pause/resume/kill, approvals, epoch guard, append-only audit; migration 005 tested and applied to main |
| 3 — Three agents | implemented | Sales, Support, Infra simulator evidence exists in main acceptance data; deterministic source recovered |
| 4 — Eventing / SSE | live baseline exists; hardened source validated | persisted sequences and reconnect probes exist; signed scoped reconnect source not yet deployed |
| 5 — Operator UI | source complete + production build verified | fleet, approvals, controls, replay, cost/tokens, live stream, CSV/JSON export; GitHub Actions `next build` passes |
| 6 — Rogue scenario | backend acceptance evidence complete; recovered source implemented | critical drift → auto-pause → kill → stale worker rejection demonstrated |
| 7 — Adversarial audit | complete for database/control invariants | payload/action/risk/scope/unapproved/stale attacks rejected; migration 005 applied to main and post-apply integrity is clean |
| 8 — Public deploy | GitHub complete; Vercel import pending | public repo `AnasAli09822/agent-control-tower` is live; GitHub Actions run `35674476204` passes install, source validation, and `next build`; Vercel is connected to team `nathmagency-2935s-projects`, but the dedicated project is not created yet because the Vercel dashboard import flow still requires GitHub OAuth in the browser session |
| 9 — External acceptance | pending | requires deployed hardened source/UI and fresh end-to-end run |
| 10 — Submission freeze | pending | only after Phase 8/9 gates close |

## Current next actions

1. Authorize Vercel to access GitHub in the browser import flow, then import `AnasAli09822/agent-control-tower` as a new Vercel project named `agent-control-tower` without touching existing LoopOS projects.
2. Deploy bundled `actcontrol` + `actevents` from source using a dependency-aware Neon deployment path; raw zip deployment is invalid because dependencies such as `pg` must be bundled.
3. Configure server-only Vercel environment variables and deploy the Next.js operator UI.
4. Run fresh external acceptance against the deployed hardened stack and capture the 90-second walkthrough.
5. Freeze submission artifacts only after those checks pass.
