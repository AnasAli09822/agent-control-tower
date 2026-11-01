# Browser verification — recorded 2026-10-06, recovered 2026-11-01

Run: 30eb067e-21cb-481c-bf34-b831c31ce421. Same application source as the current deployment.

The following is a browser provider report, retained with its limitations. It is not a claim that every requested check was executed. Discount rejection and exact team-filter counts are proven separately by the 2026-11-01 public HTTP acceptance.

Agent Control Tower QA Report (Simulated Interventions):

1. **Start all agents**: Successfully clicked. All three agents started: Infrastructure Ops (Investigate API error spike), Support Ops (Clear urgent support queue), Sales Ops (Qualify new accounts).

2. **Support Ops Pause (while waiting_approval)**: Successfully clicked Pause on Support Ops. Status changed to PAUSED. Approval buttons became disabled ("Resume this agent before deciding." appeared). Confirmed PAUSED state with disabled approval controls.

3. **Resume**: Successfully clicked Resume on Support Ops. Status returned to RUNNING, approval buttons re-enabled.

4. **Approve billing.issue_credit $350**: Successfully clicked Approve on the billing.issue_credit item ($350, Risk 76.00, Support Ops). Event `approval.approved` logged. Notice: "Approved. The exact reviewed action executed once."

5. **Reject crm.propose_discount 15%**: The crm.propose_discount item (Risk 72.00) did not appear in the approval queue after the first approval was processed. The queue showed only billing.issue_credit (1 pending). After waiting, only one approval item was present (billing.issue_credit) which was then approved. The crm.propose_discount rejection was **not performed** as the item did not appear as a separate queue item for rejection.

6. **Queue empty confirmation**: After approving billing.issue_credit, the approval queue showed "No decisions waiting. Running agents will request approval for risky actions." Pending approvals count: 0. Event `approval.approved` confirmed.

7. **Run Rogue Infra**: Successfully clicked Run Rogue Infra after Infrastructure Ops was idle. Rogue Infra started with task "Contain API incident — rogue test." Notice: "Rogue Infra started. Watch drift rise; unsafe actions will be blocked and the agent paused."

8. **Wait ~20 seconds until Infra PAUSED drift92**: After ~25 seconds, Infrastructure Ops status changed to PAUSED with drift at 92/100. Blocked unsafe proposals observed: `infra.change_rate_limit · blocked_by_risk_gate` and `infra.rollback_release · blocked_by_risk_gate`.

9. **Click Replay, select Last5, expand Evidence**: Successfully clicked Replay for Infrastructure Ops. Replay step count set to Last 5 steps. Evidence sections visible for all steps:
   - Step 1: Read metrics before acting (ALLOW) — Evidence shows stale metrics
   - Step 2: Block unsupported rate-limit change (BLOCK) — Evidence shows retry_counter and stale metrics
   - Step 3: Block rollback and contain critical drift (BLOCK) — Evidence shows retry_counter and stale metrics

10. **Click Kill**: Successfully clicked Kill on Infrastructure Ops. Event `agent.kill` and `tool.blocked` logged. Notice: "Infrastructure Ops killed. This agent cannot resume; use New session to repeat."

11. **Wait 6 seconds after Kill**: No further actions occurred. Resume button was disabled (removed). Only Replay, Pause, Kill visible but agent was killed.

12. **Operations filter**: The Operations filter value is `team_operations_e10563007aee414787baac1f2968d457`.

13. **Revenue filter**: The Revenue filter value is `team_revenue_e10563007aee414787baac1f2968d457`.

**Agent Final States:**
- Infrastructure Ops: KILLED (cannot resume, no Resume button)
- Support Ops: IDLE
- Sales Ops: IDLE

**Failures/Skipped Checks:**
- The crm.propose_discount 15% rejection was not performed because the item did not appear as a separate actionable approval item in the queue after the first approval. Only billing.issue_credit was present when the queue was checked.
- Approval.approved/approval.rejected events: `approval.approved` events were observed for both Sales Ops and Support Ops approvals in the event stream. No `approval.rejected` event was observed since the rejection was not performed.
- Task status changes: Infrastructure Ops task changed from IDLE → RUNNING (rogue) → PAUSED (drift 92) → KILLED. Support Ops changed from IDLE → WAITING APPROVAL → PAUSED → RUNNING → IDLE. Sales Ops changed from IDLE → RUNNING → IDLE.
