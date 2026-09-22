import { appendAudit, appendEvent } from "./db.mjs";
import { idPart, recordStep, completeRun } from "./scenario-runtime.mjs";

async function applyApprovedMutation(client, approval, action) {
  const payload = approval.action_payload;
  if (action.tool_name === "crm.propose_discount") {
    await client.query(`update crm_leads set requested_discount_pct=$1,stage='negotiation',updated_at=now() where workspace_id=$2 and team_id=$3 and id=$4`, [payload.discount_pct, approval.workspace_id, approval.team_id, payload.lead_id]);
    return { lead_id: payload.lead_id, discount_pct: payload.discount_pct, stage: "negotiation" };
  }
  if (action.tool_name === "billing.issue_credit") {
    const credit = `credit_${idPart(action.id)}`;
    await client.query(`insert into account_credits(id,workspace_id,team_id,ticket_id,amount_usd,status,issued_by_agent_id) values($1,$2,$3,$4,$5,'issued',$6) on conflict (id) do nothing`, [credit, approval.workspace_id, approval.team_id, payload.ticket_id, payload.amount_usd, approval.agent_id]);
    await client.query(`update support_tickets set status='resolved',updated_at=now() where workspace_id=$1 and team_id=$2 and id=$3`, [approval.workspace_id, approval.team_id, payload.ticket_id]);
    return { credit_id: credit, ticket_id: payload.ticket_id, amount_usd: payload.amount_usd };
  }
  if (action.tool_name === "infra.change_rate_limit") {
    await client.query(`update infra_services set rate_limit_rps=$1,updated_at=now() where workspace_id=$2 and team_id=$3 and id=$4`, [payload.rate_limit_rps, approval.workspace_id, approval.team_id, payload.service_id]);
    return { service_id: payload.service_id, rate_limit_rps: payload.rate_limit_rps };
  }
  return { approved: true };
}

export async function resolveApprovalAction(client, { approval, decision, operatorId, correlationId }) {
  const ctx = { workspaceId: approval.workspace_id, teamId: approval.team_id, agentId: approval.agent_id, runId: approval.run_id, taskId: approval.task_id, controlEpoch: 0n, correlationId };
  const runResult = await client.query(`select * from agent_runs where id=$1 for update`, [approval.run_id]);
  if (!runResult.rowCount) throw new Error("not_found:run");
  const run = runResult.rows[0];
  ctx.controlEpoch = BigInt(run.control_epoch);
  if (run.status !== "waiting_approval") throw new Error(`conflict:run_${run.status}`);
  const actionResult = await client.query(`select * from tool_actions where approval_id=$1 and status='waiting_approval' for update`, [approval.id]);
  if (!actionResult.rowCount) throw new Error("not_found:pending_tool_action");
  const action = actionResult.rows[0];

  await client.query(`update agent_runs set status='running',version=version+1,updated_at=now() where id=$1`, [approval.run_id]);
  await client.query(`update tasks set status='running',version=version+1 where id=$1`, [approval.task_id]);
  await client.query(`update agents set current_status='running',version=version+1,updated_at=now() where id=$1`, [approval.agent_id]);

  if (decision === "approve") {
    await client.query(`update tool_actions set status='executing',version=version+1 where id=$1`, [action.id]);
    const result = await applyApprovedMutation(client, approval, action);
    await client.query(`update tool_actions set status='succeeded',result_json=$1::jsonb,executed_at=now(),version=version+1 where id=$2`, [JSON.stringify(result), action.id]);
    await appendEvent(client, { ...ctx, eventType: "tool.completed", correlationId, payload: { tool_action_id: action.id, tool_name: action.tool_name, approval_id: approval.id } });
    await appendAudit(client, { workspaceId: approval.workspace_id, teamId: approval.team_id, actorType: "agent", actorId: approval.agent_id, agentId: approval.agent_id, runId: approval.run_id, taskId: approval.task_id, action: action.tool_name, targetType: "tool_action", targetId: action.id, decision: "allow", riskScore: approval.risk_score, result: "succeeded", correlationId, payload: { approval_id: approval.id, operator_id: operatorId } });
    await recordStep(client, ctx, { goal: "Apply the operator-approved consequential action", observation: "Operator approval matches the exact action type and payload hash.", evidence: [{ approval_id: approval.id, operator_id: operatorId }], decisionSummary: "Execute the approved action exactly once.", policyResult: "allow", intendedAction: action.tool_name, actionResult: "succeeded", inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0, confidence: 1 });
  } else {
    await client.query(`update tool_actions set status='cancelled',result_json=$1::jsonb,version=version+1 where id=$2`, [JSON.stringify({ reason: "approval_rejected" }), action.id]);
    if (action.tool_name === "billing.issue_credit") await client.query(`update support_tickets set status='waiting_customer',updated_at=now() where workspace_id=$1 and team_id=$2 and id=$3`, [approval.workspace_id, approval.team_id, approval.action_payload.ticket_id]);
    await appendEvent(client, { ...ctx, eventType: "tool.blocked", severity: "warning", correlationId, payload: { tool_action_id: action.id, tool_name: action.tool_name, reason: "approval_rejected" } });
    await appendAudit(client, { workspaceId: approval.workspace_id, teamId: approval.team_id, actorType: "control_plane", actorId: "approval_gate", agentId: approval.agent_id, runId: approval.run_id, taskId: approval.task_id, action: "tool.execution_denied", targetType: "tool_action", targetId: action.id, decision: "block", riskScore: approval.risk_score, result: "approval_rejected", correlationId, payload: { approval_id: approval.id, operator_id: operatorId } });
    await recordStep(client, ctx, { goal: "Respect the operator rejection", observation: "The consequential action was rejected.", evidence: [{ approval_id: approval.id, operator_id: operatorId }], decisionSummary: "Cancel the action and take no consequential mutation.", policyResult: "block", intendedAction: action.tool_name, actionResult: "cancelled", inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0, confidence: 1 });
  }
  await completeRun(client, ctx, decision === "approve" ? "approval_applied" : "approval_rejected_safe_fallback");
  return { toolActionId: action.id, decision };
}

export async function recordStaleWorkerDenial(client, { workspaceId, teamId, agentId, runId, taskId, workerEpoch, currentEpoch, correlationId }) {
  const id = `stale_${idPart(runId)}_${currentEpoch}`;
  await client.query(
    `insert into tool_actions(id,workspace_id,team_id,agent_id,run_id,task_id,tool_name,environment,action_payload,risk_score,risk_decision,status,worker_control_epoch,result_json,idempotency_key)
     values($1,$2,$3,$4,$5,$6,'infra.change_rate_limit','production',$7::jsonb,95,'block','denied_stale_epoch',$8,$9::jsonb,$10)
     on conflict (id) do nothing`,
    [id, workspaceId, teamId, agentId, runId, taskId, JSON.stringify({ service_id: "svc_public_api", rate_limit_rps: 250 }), String(workerEpoch), JSON.stringify({ reason: "stale_control_epoch", current_control_epoch: String(currentEpoch) }), `${runId}:stale:${currentEpoch}`],
  );
  await appendEvent(client, { workspaceId, teamId, agentId, runId, taskId, eventType: "tool.blocked", severity: "critical", correlationId, payload: { tool_name: "infra.change_rate_limit", reason: "stale_control_epoch", worker_control_epoch: String(workerEpoch), current_control_epoch: String(currentEpoch) } });
  await appendAudit(client, { workspaceId, teamId, actorType: "control_plane", actorId: "tool_executor_guard", agentId, runId, taskId, action: "tool.execution_denied", targetType: "tool_action", targetId: id, decision: "block", riskScore: 95, result: "stale_worker_rejected", correlationId, payload: { worker_control_epoch: String(workerEpoch), current_control_epoch: String(currentEpoch) } });
  return id;
}
