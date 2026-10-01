# Sites deployment

Live URL: https://agent-control-tower.tadafuqai.chatgpt.site

Sites serves the React App Router dashboard and server proxy as a Vinext Cloudflare Worker. Neon retains PostgreSQL, scenarios, control guards and direct SSE. Sites does not open TCP database sockets.

`ACT_WORKLOAD_SECRET` is a server runtime secret. Its 30-second signatures bind the Site, audience, workspace, method, query, body and idempotency key. Neon validates signature and demo scope independently. `EVENT_STREAM_SECRET` stays exclusively in Neon; browsers receive scoped 120-second SSE tokens. Runtime secret values never enter source or browser bundles. Vercel OIDC services remain a fallback.

Migration 006 is applied to main with explicit approval. Fresh normal, approval, rejection, rogue and actual overlapping concurrency checks passed. The read-only live verification route tests fleet, scopes, usage, replay, exports, signed tokens and SSE. The public demo remains in its real historical state after terminal kills.

Preserve the existing `.openai/hosting.json` project identity and audience. Run the Sites workflow in the selected checkout to perform checks/build, push source and package matching Worker output. Save and deploy the matching version through native Sites tools. Scenario mutations never run during build or publish.

Current acceptance and final publication evidence: `docs/evidence/2026-10-01-acceptance.json`. The 90-second Loom remains a separate unfinished delivery item.
