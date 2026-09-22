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
| 9 — Public Backend + Vercel + GitHub + CI | partial | public GitHub repo and CI are live; Vercel builds the repository successfully under `alhajans664-2649s-projects`; hardened Neon Function source is validated, but main still runs the preserved older Function deployments and the Vercel deployment is protected from anonymous external acceptance |
| 10 — Submission Freeze | pending | freeze only after hardened backend deployment, public Vercel access, and fresh external acceptance all pass |

## Current verified external state

- GitHub repository: `AnasAli09822/agent-control-tower` (public).
- GitHub source/build validation is green through dependency install, `validate:source`, and production `next build`.
- Neon main migration `005_declarative_execution_binding`: applied and verified; zero run-scope and approval-binding mismatches after apply.
- Main Neon Functions `actcontrol`, `actevents`, and `actaccept` remain the preserved older deployments. The recovered hardened source requires an API key for control routes and signed, workspace/team-scoped stream tokens for SSE.
- Vercel is connected to the GitHub repository and reports successful deployments under scope `alhajans664-2649s-projects`.
- The project-specific Vercel deployment is protected by Vercel Authentication, so anonymous external acceptance is not yet possible.
- `https://agent-control-tower.vercel.app` currently resolves to a different/default “Create Next App” deployment and is not the acceptance URL for this project.

## Remaining gates

1. Deploy the hardened `actcontrol` and `actevents` source to the Neon validation branch, verify health/auth/SSE behavior, then promote the same hardened source to main.
2. Configure the Vercel project to use the hardened Neon Function URLs and matching server-side secrets, and expose an unprotected production acceptance URL.
3. Run fresh external acceptance covering fleet, approvals, pause/resume/kill, signed SSE reconnect, usage/replay/export, team isolation, and the rogue stale-worker rejection path.
4. Freeze Phase 10 artifacts only after those external checks pass.
