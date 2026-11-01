# Validation

The final validation uses the current source, an empty PostgreSQL database, isolated Neon fixtures and the published operator journey. See `docs/evidence/2026-11-01-final.json` for bound commits, CI runs, deployment and actual outcomes.

Local unit/security tests cover state transitions, risk/authority, epoch fencing, drift signals, usage arithmetic, signed SSE, workload request binding, cookie/session expiry and session boundaries. TypeScript and the Sites Worker build validate the current frontend.

`validate-local-clean-clone` installs from a clean GitHub checkout, bootstraps PostgreSQL 16 from committed SQL, runs the stepped acceptance suite, then starts the local Sites frontend and real signed control/event services. HTTP checks observe three agents' SSE steps, pause/resume during execution, task usage and rejection of access to a prior session after New session.

The protected Neon acceptance suite combines the previous guard/concurrency tests with the current stepped/session tests. Fresh workspaces prevent terminal historical demo state from masking coverage. The public browser verifies actual controls and visible outcomes; successful backend tests alone do not close that journey.

The optional video is excluded by user request. Historical validation records remain in dated evidence files.

## Reproduce published acceptance

On Node.js 24, explicitly select the authorized demo origin:

```bash
ACT_DEMO_URL=https://agent-control-tower.tadafuqai.chatgpt.site node scripts/acceptance/published.mjs
```

This test creates its own simulated workspace. It uses a cookie jar, consumes the real signed stream and checks persisted state/effects. Approval history includes decided rows; the operator's pending queue is the pending subset. CI tests use an empty local PostgreSQL service instead of mutating the hosted demo.
