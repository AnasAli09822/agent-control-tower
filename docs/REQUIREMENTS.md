# Challenge acceptance matrix

Source: the complete Agent Control Tower challenge supplied by the user, reviewed 2026-10-07 (Asia/Riyadh). Live demo and public clean-clone repository are required. Video is optional and explicitly excluded by the user.

| ID | Requirement | Observable acceptance | Implementation / evidence |
|---|---|---|---|
| ACT-01 | Live operator fleet | Three agents, status, recent action, blocker and drift change from persisted state | OperatorDashboard; control fleet query; public browser flow |
| ACT-02 | Approvals and per-agent kill | Exact risky action waits; approve/reject affects its domain; pause/kill stop new steps | Control handler; guards 005/006; fresh acceptance |
| ACT-03 | Per-agent/per-task usage | Token and cost rows reconcile with workspace totals | Usage ledger and by_task query; acceptance reconciliation |
| ACT-04 | Last-N reasoning replay | Select N, inspect ordered summaries, evidence, action and usage | Replay API/UI; last-N acceptance |
| ACT-05 | Three simulated agents | Infra, Support and Sales advance distinct jobs in separate visible checkpoints | Stepped runtime; browser observation and clean-database suite |
| ACT-06 | Public repo, clean clone | Install, bootstrap empty PostgreSQL, run local control/UI and build | README; local scripts; validate-local-clean-clone CI |
| ACT-07 | Public live demo | Anonymous visitor obtains an isolated usable session and intervenes | Sites public deployment; live acceptance |
| ACT-08 | Architecture snapshot | Agent events reach the operator UI through the control/data/stream plane | ARCHITECTURE.md |
| ACT-09 | Rogue failure containment | Drift warning then critical; two unsafe actions blocked; auto-pause; terminal kill | FAILURE_TEST.md; current acceptance and browser |
| ACT-10 | Two-year thesis ≤300 words | Runtime-neutral operational authority thesis within the word limit | TWO_YEAR_THESIS.md |
| ACT-11 | Submission notes | Named AI tools, decisions, scope limits and working links | SUBMISSION_NOTES.md; AI_USAGE.md |
| BONUS-01 | Team awareness | Operations and Revenue filters enforce their scopes | Workload/SSE validation; team-scoped acceptance |
| BONUS-02 | Audit export | CSV/JSON export includes operator controls and denied actions | Audit API; browser/export checks |
| OPTIONAL-01 | Video walkthrough | Omitted by user request | Not a readiness blocker |

Technical tests alone do not substitute for exercising the public operator journey. Dated evidence binds final results to source/deployment versions.
