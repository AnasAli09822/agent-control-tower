# Sites deployment

Live URL: https://agent-control-tower.tadafuqai.chatgpt.site

Sites now serves the original dashboard and server proxy. PostgreSQL, long-running scenarios, and SSE remain on Neon. The App Router is compiled with Vinext into a Cloudflare Worker; direct TCP database connections are not used in Sites.

The Sites server stores `ACT_WORKLOAD_SECRET` as a runtime secret. Its 30-second request signatures bind the Site, service audience, workspace, HTTP method, path/query, payload hash, and idempotency key. Both Neon services validate signatures and independently enforce the limited `ws_demo` scope. Existing Vercel OIDC functions are retained as a fallback. `EVENT_STREAM_SECRET` remains exclusively in Neon; the browser gets only a scoped 120-second SSE token.

15 live, read-only acceptance checks passed through Sites into Neon: anonymous backend denial, persisted fleet data, Operations/Revenue isolation, approvals, usage, JSON/CSV audit, structured replay, token issuance, wrong-workspace/team denial, tampered-token denial, SSE content type, and idle heartbeat. Exact results and deployment provenance are in `docs/evidence/2026-09-30-sites.json`.

No scenario mutations are run during build or deployment. Main database migration 006, genuine overlapping kill-vs-write verification, fresh scenario acceptance, and final walkthrough remain separate unfinished gates. Successful hosting must not be represented as final challenge acceptance.

Runtime secret values are never committed. For later publishing, preserve this Site's `.openai/hosting.json` identity, build the Worker, push the exact source commit, package `.openai/hosting.json`, `dist/server`, and `dist/client`, then save/deploy the matching version through Sites. Preserve the current audience.
