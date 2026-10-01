# Submission notes

Agent Control Tower is published at https://agent-control-tower.tadafuqai.chatgpt.site and maintained at https://github.com/AnasAli09822/agent-control-tower/tree/sites-migration.

Sites hosts the operator UI and scoped proxy. Neon Functions host control/SSE with durable PostgreSQL state. CRM, Support, Infrastructure, agent usage and operational reasoning summaries are simulated; hidden chain-of-thought is not collected.

Main migration 006 is applied. The fresh acceptance suite passed 29 checks, including genuine overlapping worker/kill and approval/kill requests, exact approval defenses, safe rejection, rogue auto-pause and terminal kill. Local validation passed 21 named tests and TypeScript. Deployment provenance and live checks are recorded in `docs/evidence/2026-10-01-acceptance.json`.

Architecture snapshot, thesis, failure-test evidence and a 90-second walkthrough script exist. **The required 90-second Loom recording is still missing.** A browser test recording/report is not represented as that Loom. Final submission freeze is therefore not claimed.

The public seed agents keep their actual historical terminal states. Fresh testing uses independently created scoped fixtures without resetting those agents.
