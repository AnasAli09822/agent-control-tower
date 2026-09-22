# Validation evidence

This file records evidence gathered against isolated Neon resources before any main replacement.

## Source recovery bootstrap

Validation branch: `source-recovery-validation` (`br-little-art-b5e06cd8`).

A new empty database was bootstrapped from the recovered baseline. Verified inventory after bootstrap:

- 30 public base tables
- 8 non-internal triggers
- 67 indexes
- recovered baseline now includes migrations through `005_declarative_execution_binding`

The baseline includes pgcrypto payload hashing, compound workspace/team foreign keys, append-only evidence triggers, state-transition guards, approval immutability, execution guards, and simulator tables.

## Reproducible source gates

`npm run validate:source` passes and currently covers:

- 6/6 core control-plane tests
- 2/2 signed SSE security tests
- core TypeScript typecheck
- UI/server-route contract typecheck using local compile shims
- syntax validation for all Neon Function source files

A full `next build` is delegated to CI because the recovery execution environment does not provide a normal npm install path. GitHub Actions run `35674476204` on commit `258dd0b7cc3a81ff941c5b884cb7e122c68deecf` completed successfully: `npm install`, `npm run validate:source`, and `npm run build` all passed. The earlier install failure was traced to the nonexistent package `@neon/config@^0.2.0`; the source now uses Neon's published `@neondatabase/config` package and documented `@neondatabase/config/v1` import.

## Core cases

1. legal state transitions and terminal killed state
2. kill increments control epoch and rejects a stale worker
3. consequential production mutation requires approval
4. out-of-scope action is blocked
5. rogue signals cross the critical drift threshold and auto-pause
6. usage/cost accounting is additive without double-charging cached tokens

## Database adversarial tests

All cases below were executed on isolated validation databases.

| Test | Expected result | Observed |
|---|---|---|
| mutate `agent_events` | reject append-only mutation | rejected |
| `running -> idle` | reject illegal transition | rejected |
| mutate decided approval | reject immutable decision | rejected |
| change pending approval identity | reject action substitution | rejected |
| stale worker epoch | reject before mutation | rejected |
| approval payload substitution | reject SHA-256 mismatch | `approved payload hash does not match tool action` |
| approval action-type substitution | reject tool substitution | `approved action type does not match tool action` |
| approval risk-score substitution | reject risk substitution | `approval risk score does not match tool action` |
| run/agent scope substitution | reject scope mismatch | `tool action scope does not match run` |
| pending/unapproved approval | reject execution | `approval is not approved` |
| killed run, epoch N worker vs N+1 authoritative epoch | reject as stale epoch | rejected |

## Adversarial finding closed by migration 004

The recovered pre-004 guard compared a STORED GENERATED `action_payload_hash` from `NEW` inside a `BEFORE` trigger. A payload-substitution probe demonstrated that this is not a valid binding point: the generated value is not a reliable input before row generation completes.

Migration 004 closes the issue by recomputing SHA-256 from `NEW.action_payload` inside the guard and binding approval to the exact action type, workspace, team, agent, run, task and risk score.

## Migration 005 — prepared against main

Because the Neon prepared-migration parser cannot accept the PL/pgSQL body in migration 004, migration 005 adds declarative post-generation enforcement instead of bypassing the migration safety workflow.

Prepared migration ID: `9fe50546-40b5-44a5-88cf-ecbaf2c2ef46` on temporary branch `br-silent-math-b5kd7qep`, parent `br-gentle-butterfly-b57bd2r5`.

Tests on that prepared branch, which starts from main's pre-004 trigger:

- payload substitution: rejected by `tool_approval_exact_fk`
- action-type substitution: rejected by `tool_approval_exact_fk`
- risk-score substitution: rejected by `tool_approval_exact_fk`
- exact approved action: accepted

This proves migration 005 independently closes the generated-column timing weakness for execution binding. It was then **applied successfully to main on 2026-09-22** using the prepared-migration workflow.

## Environment split

- `source-recovery-validation/controltower`: migrations 004 and 005 are applied and adversarial tests pass.
- main `controltower`: migrations 001–003 plus `005_declarative_execution_binding`; migration 004 remains validation-only.
- prepared migration branch `br-silent-math-b5kd7qep`: main + migration 005, tested successfully, then deleted automatically after the migration was applied.
- main Neon Functions `actcontrol`, `actevents`, `actaccept`: preserved working deployments; source recovery has not overwritten them.

The PL/pgSQL migration 004 was not bypassed onto main with direct SQL. Migration 005 exists specifically to close the same binding gap through migration-API-compatible declarative constraints.

## External deployment status

Public GitHub repository `AnasAli09822/agent-control-tower` is live. The normal validation workflow has passed dependency installation, `npm run validate:source`, and production `next build`. Vercel is connected to this repository and GitHub reports successful Vercel deployment status under scope `alhajans664-2649s-projects`. The project-specific Vercel deployment is protected by Vercel Authentication, so anonymous runtime acceptance is not yet available. `https://agent-control-tower.vercel.app` currently resolves to a different/default “Create Next App” deployment and is not treated as acceptance evidence.

The hardened recovered Neon Function source is validated locally/source-side, while main still preserves the older `actcontrol`/`actevents` Function deployments. Phase 9 therefore remains open until the hardened Function source is deployed to validation and main, Vercel is pointed at that backend, and a fresh external acceptance run passes.

## Main post-apply verification — 2026-09-22

After applying migration 005 through Neon's prepared-migration workflow, main was queried directly:

- `schema_migrations` contains `005_declarative_execution_binding`.
- `runs_exec_scope_key`, `approvals_exec_binding_key`, `tool_run_scope_exact_fk`, and `tool_approval_exact_fk` are present on main.
- run-scope mismatches: `0`.
- approval-binding mismatches for executing/succeeded actions: `0`.

Migration 004 remains validation-only; migration 005 is the main-safe declarative enforcement path and does not depend on 004 being present.
