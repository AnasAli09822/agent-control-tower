# Agent Control Tower

An operator cockpit for three simulated agents, with persisted events, guarded execution, approvals, pause/resume/kill, drift containment, task-level usage and reasoning replay.

**Live demo:** https://agent-control-tower.tadafuqai.chatgpt.site

**Public repository:** https://github.com/AnasAli09822/agent-control-tower

Sites hosts the operator UI and scoped server proxy. Neon Functions host the control plane and signed SSE; PostgreSQL holds authoritative state and audit records. `sites/` is the current frontend. `functions/` contains the shared backend. Older Vercel sources are retained for historical comparison; the delivery uses Sites.

## Try the demo

1. Open the demo. Your browser receives an independent session with fresh Infrastructure, Support and Sales agents.
2. Click **Start all agents**. Steps commit separately, approximately every five seconds while the tower is connected. Pause a working agent; its next step stops. Resume it to continue.
3. Approve the Support agent's **$350 credit**, or reject the Sales agent's **15% discount**. The reviewed payload is shown before deciding. A paused agent must resume before its approval can execute.
4. After Infrastructure finishes, click **Run Rogue Infra**. Watch drift move to 70 then 92, two unsafe proposals get blocked, and the agent automatically pause. Open Replay and Kill it.
5. **New session** creates fresh agents without reviving killed agents or overwriting the previous audit history. Refreshing the page preserves the current session for 24 hours.

Use team scope, usage by agent/task, the last-N replay selector and CSV/JSON audit export from the same cockpit.

## Clean local clone

Prerequisites: Node.js 24, npm, and Docker Compose (or an empty PostgreSQL 16+ database). No hosted Sites, Neon, Vercel or model-provider credentials are required for local operation.

```bash
git clone https://github.com/AnasAli09822/agent-control-tower.git
cd agent-control-tower
npm install
npm --prefix sites ci
docker compose up -d --wait db
export DATABASE_URL=postgresql://controltower:local_demo_only@127.0.0.1:5432/controltower
npm run db:bootstrap
npm run demo
```

Open http://localhost:5173. Local control and event services listen on ports 8008 and 8009. The launcher writes ignored local `.dev.vars` using a development-only signing key. Bootstrap refuses an already initialized database. On later starts, run `npm run demo` with the same DATABASE_URL; do not bootstrap again. For PowerShell, set the variable with `$env:DATABASE_URL="postgresql://controltower:local_demo_only@127.0.0.1:5432/controltower"`.

```bash
npm run validate:source
npm run acceptance:local
npm run build
```

`acceptance:local` creates separate test workspaces in the local database. GitHub Actions also boots a completely empty PostgreSQL service from this repository and runs the same acceptance flow.

## Production boundary

Business systems, agent reasoning summaries, tokens and cost are deterministic simulations and are labelled in the UI. Database effects, approval binding, intervention locks, epochs, event sequencing and audit history are actual persisted behavior. Simulation advances on the server while a signed operator SSE connection is open; without an operator connection, it stops at its last committed checkpoint. This is an interactive demo, not an unattended production fleet scheduler.

Kill is terminal and increments the authoritative epoch. Each tool mutation is checked under agent/run locks until commit. An already guarded atomic transaction can commit before a waiting kill; subsequent stale actions are rejected. Approvals bind the exact workspace/team/agent/run/task/tool/payload/risk tuple.

Submission material: [Architecture](docs/ARCHITECTURE.md), [Failure test](docs/FAILURE_TEST.md), [Two-year thesis](docs/TWO_YEAR_THESIS.md), [Submission notes](docs/SUBMISSION_NOTES.md), [Requirements](docs/REQUIREMENTS.md). The optional video is omitted at the user's request.
