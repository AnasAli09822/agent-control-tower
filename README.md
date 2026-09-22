# Agent Control Tower

A runtime-neutral operations control plane for autonomous agents. It provides persisted fleet state, approvals, pause/resume/kill controls, token/cost accounting, structured replay, drift detection, an append-only audit trail, and a failure test where a stale worker is denied after kill.

## Current verified state

The active Neon main branch contains the control-plane schema, three agent domains, persisted events, approval records, reasoning/usage ledgers, and prior acceptance evidence. Main Neon Functions `actevents`, `actcontrol`, and `actaccept` remain preserved working deployments.

Source recovery and adversarial hardening were validated on isolated Neon branches. Migration `005_declarative_execution_binding` was prepared from main, adversarially tested, and **applied successfully to main on 2026-09-22**. Post-apply integrity checks report zero run-scope mismatches and zero approval-binding mismatches. See `docs/VALIDATION.md` and `docs/PROJECT_STATUS.md`.

## Reproducible source

- `neon.ts` declares branch-scoped `actcontrol` and `actevents` functions.
- `db/migrations/000_recovered_baseline.sql` is a recovered clean-bootstrap baseline matching the verified schema shape; it is not represented as byte-for-byte historical 001/002/003 files.
- `db/migrations/004_harden_tool_approval_binding.sql` records trigger-level adversarial hardening.
- `db/migrations/005_declarative_execution_binding.sql` adds migration-API-compatible composite FK enforcement for exact run/approval binding.
- `db/seed.sql` contains the canonical demo workspace and three-agent seed.

## Validation

```bash
npm run validate:source
```

This runs core tests, signed-SSE security tests, core/UI contract type checks, and Function syntax checks. CI additionally installs dependencies and runs the full Next.js build.

## Environment

Copy `.env.example` to the deployment environment. `CONTROL_API_KEY`, Function targets, and the optional stream signing secret are server-only. The browser never receives the control key.

The public demo server proxy is scope-constrained to `ws_demo`; direct SSE uses a short-lived workspace/team-bound HMAC token. Reconnect mints a fresh token and resumes from the last persisted event sequence.

## Safety invariant

A tool action may mutate simulated external state only when its worker epoch equals the run's authoritative `control_epoch`, the action belongs to the run's agent/task scope, the run is executable, the tool is inside agent authority, and any required approval exactly matches workspace/team/agent/run/task/tool/payload/risk score.

Kill increments the epoch. Stale-epoch rejection takes precedence over terminal-state reporting so the failure test proves worker invalidation rather than only a UI/state check.

## Reproducible database bootstrap

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/000_recovered_baseline.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed.sql
```

For the historical production database, migration 005 is now applied on main. Do not rerun the recovered baseline over the existing database.
