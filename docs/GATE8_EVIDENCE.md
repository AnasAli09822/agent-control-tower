# Phase 8 adversarial evidence

Date: 2026-09-22

## Main branch integrity (read-only)

Neon project: `weathered-poetry-97205616`
Main branch: `br-gentle-butterfly-b57bd2r5`
Database: `controltower`

Observed:

- schema migrations: `001_control_plane_core`, `002_execution_guards`, `003_task_inputs`, `005_declarative_execution_binding`
- run/tool scope mismatches: `0`
- approval/tool exact-binding mismatches: `0`
- duplicate `(workspace_id, sequence)` event keys: `0`
- events missing workspace or sequence: `0`
- successful tool actions executed after an agent kill event: `0`
- pending approvals: `0`
- workspaces: `5`
- teams: `10`
- agents: `15`

This confirms the production database has no known persisted violations of the control-scope, approval-binding, event ordering, or post-kill mutation invariants.

## Operator evidence on main

Observed:

- structured reasoning runs: `8`
- reasoning steps: `23`
- usage entries: `23`
- usage entries with workspace/agent/task scope: `23`
- audit events: `25`
- audit events missing workspace scope: `0`
- acceptance workspace audit events: `18`

Acceptance workspace `ws_acceptance1` has structured replay and usage for all four acceptance runs, including the killed rogue run.

## Validation branch attacks

Validation branch: `source-recovery-validation` (`br-little-art-b5e06cd8`).

Direct adversarial inserts were attempted against live validation fixtures:

1. Cross-team tool attribution substitution was rejected by PostgreSQL via `tool_agent_fk`.
2. Reusing an approved Sales approval with a changed discount payload was rejected with `approved payload hash does not match tool action`.
3. Reusing the same approval for a different tool was rejected with `approved action type does not match tool action`.

Earlier validation also proved rejection of append-only mutation, illegal run transition, approval identity mutation, stale control epoch, risk-score substitution, run/agent scope substitution, and non-approved approval execution.

## Public-surface finding

The legacy main `actevents` deployment currently returns `/events` data anonymously. This is an explicit release blocker. The repository's hardened `actevents` source requires a short-lived HMAC token bound to workspace/team, and must replace the legacy deployment before the demo is made public.

A reproducible Neon bundle workflow (`package-neon`) succeeds in GitHub Actions and produces self-contained `actcontrol` and `actevents` artifacts. A guarded `deploy-neon` workflow is present for validation-first and then production deployment once required secrets are configured.

## Release gate

Phase 8 database/control-plane invariants are green. Public production is not accepted until:

- hardened Neon Functions are deployed and anonymous `/events` access is rejected;
- Vercel server-only environment variables are configured;
- Vercel Authentication is disabled for the final production URL;
- external acceptance re-runs Start All, approvals, Rogue/Kill/stale-worker, replay, usage, and audit export.
