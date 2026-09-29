# Deployment and acceptance runbook

Repository: `AnasAli09822/agent-control-tower`. Vercel scope: `alhajans664-2649s-projects`. Neon project: `weathered-poetry-97205616`.

## Current main Functions

- `actctlp3`: control API; health public, all control traffic requires verified Vercel OIDC. The internal handler key is generated inside Neon.
- `actevtp3`: signed SSE; health public, /token requires verified Vercel OIDC and demo scope, /events and /stream require exact-scope signed tokens.
- Configure `EVENT_STREAM_SECRET` only on the Neon event Function. Owner/project/environment restrictions are configured there as appropriate.
- Do not place internal keys in Vercel, GitHub Actions, source, or browser output. Do not use the preserved old production slugs.

## Vercel

Source defaults target the new slugs. Check any runtime `CONTROL_API_URL` and `EVENTS_API_URL` overrides before accepting the UI deployment. Production and preview authenticate with Vercel workload OIDC; no long-lived control or stream secret is needed on Vercel.

`npm run build` includes a read-only deployed-backend smoke suite on Vercel. It must never start scenarios, issue credits, approve actions, or kill agents. GitHub validation builds skip this environment-specific smoke. GitHub Actions is limited to validation/packaging and public HTTP tests, without deployment secrets.

The Vercel management connection currently lacks this scope (403). GitHub deployment metadata confirms integration and successful builds. Do not relink or create another project as a reaction to that 403.

## Epoch fence gate

Review `db/migrations/006_authoritative_epoch_fence.sql` and the isolated validation evidence before applying to main. The prepared-migration tool fails on the dollar-quoted body; individual complete statements passed atomically through run_sql_transaction on validation branch `br-square-dew-b57d7tcl`. Production application is pending explicit approval. Do not rerun 001–005.

## Fresh acceptance and freeze

Use isolated fixtures for fresh normal, approval, rogue, scope, and concurrency tests. The existing scenario source uses canonical demo IDs, so explicitly resolve this fixture/selection requirement without weakening the public demo scope.

Verify the actual public project URL, UI controls, approvals, usage/replay, audit JSON/CSV, team filtering, live reconnect, heartbeat, persistent monotonic sequence, kill commit, rejected stale action, and zero post-kill business mutations. Record the accepted source SHA and deployment before freezing.

The current checkpoint is not the final submission freeze and does not claim a recorded walkthrough or accepted live-demo URL.
