# Project status — Agent Control Tower

Status date: 2026-09-22.

| Phase | Status | Evidence / remaining gate |
|---|---|---|
| 0 — Plan / Context Lock | complete | canonical master plan, context lock, and decision log established |
| 1 — Data / Control Model | complete + recovered | 30-table schema, constraints, indexes, seed, transition rules; clean bootstrap validated |
| 2 — Execution Guard | complete + main hardened | pause/resume/kill, exact approval binding, control-epoch invalidation, append-only audit; migration 005 tested and applied to main |
| 3 — Three agents | implemented | Sales, Support, and Infra simulator evidence exists; deterministic source recovered |
| 4 — Live Event System | live baseline exists; hardened source validated | persisted workspace sequences and reconnect logic exist; signed workspace/team-scoped SSE source passes security tests but has not replaced the older main Function deployment |
| 5 — Operator UI | source complete + production build verified | fleet, events, approvals, controls, replay, token/cost visibility, CSV/JSON export; GitHub Actions production `next build` passes |
| 6 — Rogue Scenario | backend acceptance evidence complete; recovered source implemented | critical drift → auto-pause → kill → stale-worker epoch rejection demonstrated |
| 7 — Multi-team + Export | complete in source/control model | Operations/Revenue scoping, cross-team composite constraints, team-filtered views, and audit export are implemented; prior adversarial scope-substitution probes were rejected |
| 8 — Adversarial Audit | complete for database/control invariants | payload/action/risk/scope/unapproved/stale attacks rejected; migration 005 applied to main and post-apply integrity is clean; GitHub source validation remains green |
| 9 — Public Backend + Vercel + GitHub + CI | partial | public GitHub repo is live; CI and `package-neon` workflows are green; a Vercel deployment exists under scope `alhajans664-2649s-projects`, but that scope is not authorized in the connected Vercel plugin and the deployment is protected; hardened Neon Function bundles are built but not yet deployed to main |
| 10 — Submission Freeze | pending | freeze only after hardened backend deployment, public Vercel access, and fresh external acceptance all pass |

## Current verified external state

- GitHub repository: `AnasAli09822/agent-control-tower` (public).
- GitHub source/build workflow run `35774234096`: success (`npm install`, `validate:source`, `next build`).
- GitHub Neon bundling workflow run `35774234239`: success; artifact `neon-function-bundles` contains self-contained `actcontrol.zip` and `actevents.zip`.
- Neon main migration `005_declarative_execution_binding`: applied and verified; zero run-scope and approval-binding mismatches after apply.
- Main Neon Functions are still the older preserved deployments. `actcontrol` rejects anonymous fleet reads with `INVALID_SESSION`; `actevents` root/health remains anonymously reachable. The hardened recovered source instead requires an API key for control routes and signed stream tokens for `/events`/`/stream`.
- Vercel GitHub status is successful for the project under scope `alhajans664-2649s-projects`, but the ChatGPT Vercel connector is authenticated only to `nathmagency-2935s-projects`. Direct Vercel API access to the correct scope returns `403 ... re-authenticate to this scope`.
- `https://agent-control-tower.vercel.app` currently resolves to a different/default “Create Next App” deployment and must not be treated as the acceptance URL for this project.

## Remaining gates

1. Re-authenticate the Vercel connector to scope `alhajans664-2649s-projects`, then inspect the actual `agent-control-tower` deployment, disable deployment protection for the public demo (or assign an unprotected production domain), and configure the required server-only environment variables.
2. Deploy the hardened self-contained `actcontrol` and `actevents` bundles to Neon (validation first, then main) using an authenticated Neon deployment path. The generated bundles already solve the previous missing-`pg` failure.
3. Point Vercel to the hardened Neon Function URLs and matching secrets, redeploy, then run fresh external acceptance including live fleet, approvals, pause/kill, signed SSE reconnect, usage/replay/export, and the rogue stale-worker test.
4. Freeze Phase 10 artifacts only after those external checks pass.
