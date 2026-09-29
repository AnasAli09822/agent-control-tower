# Submission notes — preparation checkpoint

Agent Control Tower is a standalone control plane, with Vercel UI/proxy, Vercel OIDC identity, Neon control/SSE Functions, and durable Neon Postgres state. CRM, Support, Infrastructure, agent usage, and operational reasoning summaries are simulated. Hidden chain-of-thought is not collected.

Repository: https://github.com/AnasAli09822/agent-control-tower

Architecture snapshot, project thesis, 90-second walkthrough script, and failure-test description exist in this repository. The script is not a recorded Loom.

**Not ready for submission freeze.** New backend slugs are working and identity/stream contracts are tested. Migration 006 is validated on an isolated main clone but pending on main; public UI access, runtime overrides, fresh complete scenario acceptance, and actual overlapping concurrency tests remain open. No working public live-demo URL is asserted in this checkpoint.
