# Sites deployment

Production frontend: https://agent-control-tower.tadafuqai.chatgpt.site

Sites runs the App Router through Vinext as a Cloudflare Worker. Runtime values are managed as Site environment variables, not committed source. Required bindings are ACT_SITE_ID, ACT_WORKLOAD_SECRET, CONTROL_API_URL and EVENTS_API_URL. The same workload secret and Site ID are configured on the Neon control/event Functions; EVENT_STREAM_SECRET stays exclusively in Neon. No credentials are sent to the browser.

The backend bundles are produced from root `functions/` by `package-sites-neon`. The frontend is built from `sites/`. The native Sites workflow pushes the exact source and packages matching Worker output; native save/deploy operations publish that archive. Preserve the existing project identity and public audience.

Production already contains migrations 001, 002, 003, 005 and 006. No production schema change is required for independent demo sessions or paced execution. Never apply the clean bootstrap to an existing database. The bootstrap's identity defaults repair fresh-database reproducibility only; production retains its existing ID sequences.

Acceptance includes fresh normal/approval/rejection flows, paused approvals, task-level usage, multiple viewers, rogue containment, terminal kill, signed scopes and a clean PostgreSQL bootstrap. The optional video is excluded by request.
