# Agent Control Tower on Sites

The existing Agent Control Tower interface is retained. Sites hosts the React App Router application and two server proxy routes, using Vinext to emit a Cloudflare Worker. Neon continues to own PostgreSQL, agent execution, policy enforcement, and SSE.

The server proxy signs each upstream request for 30 seconds, bound to the Site ID, service audience, workspace, method, path/query, body digest, and idempotency key. Neon independently verifies the signature and the demo scope. Runtime secrets are configured through Sites and Neon; they are absent from source and browser bundles.

Source baseline: GitHub `AnasAli09822/agent-control-tower` commit `ae5edde93770324a63ad35ed51482365c77d5d60`. Sites-specific Function sources and packaging workflow are on `sites-migration`. Existing Vercel services remain available until replacement validation is complete.

## Validation

- `node tests/sites-workload.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run build`

Do not run scenario mutations during a build. Database migration 006 remains pending on main; isolated branch verification is recorded in `docs/evidence/2026-09-30-checkpoint.json`. Publication success alone does not complete the challenge acceptance gates.
