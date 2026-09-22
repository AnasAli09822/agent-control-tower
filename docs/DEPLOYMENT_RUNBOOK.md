# Production deployment runbook

This runbook is the controlled handoff from validated source to public production. Do not paste secret values into issues, commits, chat, or logs.

## 1. GitHub Actions secrets

Repository: `AnasAli09822/agent-control-tower`

Create these repository Actions secrets:

- `NEON_API_KEY` — Neon API key with access to project `weathered-poetry-97205616`.
- `CONTROL_API_KEY` — a new cryptographically random secret (at least 32 random bytes).
- `EVENT_STREAM_SECRET` — a different cryptographically random secret (at least 32 random bytes).

`CONTROL_API_KEY` and `EVENT_STREAM_SECRET` must also be set to the exact same values in the Vercel project. Never prefix either with `NEXT_PUBLIC_`.

## 2. Controlled Neon deployment

Workflow: `.github/workflows/deploy-neon.yml`.

The workflow can be run manually or by controlled deployment branches:

- `neon-validation` -> validation branch `br-little-art-b5e06cd8`
- `neon-production` -> production branch `br-gentle-butterfly-b57bd2r5`

Always deploy validation first. Verify:

1. `/health` is available.
2. `/fleet` without `x-api-key` is rejected.
3. `/events` and `/stream` without a valid signed token are rejected.
4. Valid exact-scope signed token works.
5. Wrong-scope, tampered, and expired tokens fail.
6. Start All, approval, pause/resume/kill, Rogue Scenario, replay, usage and audit export work.
7. Kill stale-worker probe is denied before any mutation.

Only then trigger `neon-production` using the same source commit and secrets.

## 3. Vercel project

Project: `agent-control-tower`
Expected account/scope: `alhajans664-2649s-projects`.

Set these server-side environment variables for Production (and Preview if preview acceptance is desired):

- `CONTROL_API_URL=https://br-gentle-butterfly-b57bd2r5-actcontrol.compute.c-7.us-east-2.aws.neon.tech/`
- `CONTROL_API_KEY=<same value as GitHub Actions secret>`
- `EVENTS_API_URL=https://br-gentle-butterfly-b57bd2r5-actevents.compute.c-7.us-east-2.aws.neon.tech/`
- `EVENT_STREAM_SECRET=<same value as GitHub Actions secret>`
- `DEMO_WORKSPACE_ID=ws_demo`
- `DEMO_OPERATOR_ID=operator_demo`

Redeploy after changing environment variables.

## 4. Public production acceptance

The final production URL must be reachable anonymously. Disable Vercel Authentication for the production deployment before final acceptance. Preview deployments may remain protected.

Verify externally without account cookies:

- title is `Agent Control Tower`
- Fleet loads the three demo agents
- live event stream reconnects and resumes from the last sequence
- approvals can be approved/rejected
- pause/resume/kill controls work
- token/cost totals are visible
- structured replay is visible
- audit CSV/JSON exports work
- Rogue Scenario auto-pauses on critical drift, kill increments control epoch, and stale worker mutation is denied
- direct anonymous Neon control/event reads are rejected except health endpoints
- no runtime 5xx errors are present

## 5. Freeze

After external acceptance, record the accepted Git commit SHA and deployment URL in `docs/PROJECT_STATUS.md` and `docs/SUBMISSION_NOTES.md`, rebuild the source archive, compute its SHA-256, and make no further code changes without re-running acceptance.
