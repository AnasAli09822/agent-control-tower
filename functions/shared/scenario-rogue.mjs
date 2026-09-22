import { appendAudit, appendEvent } from "./db.mjs";
import { idPart, toolId, recordStep, executeTool } from "./scenario-runtime.mjs";

async function recordBlockedProposal(client, ctx, spec) {
  const step = await recordStep(client, ctx, {
    goal: spec.goal, observation: spec.observation, evidence: spec.evidence,
    decisionSummary: spec.decisionSummary, policyResult: "block", intendedAction: spec.toolName,
    actionResult: "blocked_by_risk_gate", confidence: 0.61, inputTokens: 920, outputTokens: 260,
  });
  const id = toolId(ctx.runId, step.step_no);
  await client.query(
    `insert into tool_actions(id,workspace_id,team_id,agent_id,run_id,task_id,reasoning_step_id,tool_name,environment,action_payload,risk_score,risk_decision,status,worker_control_epoch,idempotency_key)
     values($1,$2,$3,$4,$5,$6,$7,$8,'production',$9::jsonb,$10,'block','cancelled',$11,$12)`,
    [id, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, step.id, spec.toolName, JSON.stringify(spec.payload), spec.riskScore, String(ctx.controlEpoch), `${ctx.runId}:tool:${id}`],
  );
  await appendEvent(client, { ...ctx, eventType: "tool.blocked", severity: "warning", correlationId: ctx.correlationId, payload: { tool_name: spec.toolName, risk_score: spec.riskScore, reason: spec.reason } });
  await appendAudit(client, { workspaceId: ctx.workspaceId, teamId: ctx.teamId, actorType: "control_plane", actorId: "risk_gate", agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId, action: spec.toolName, targetType: "tool_action", targetId: id, decision: "block", riskScore: spec.riskScore, result: "prevented_before_execution", correlationId: ctx.correlationId });
}

export async function startRogueScenario(client, { workspaceId, operatorId, idempotencyKey, correlationId }) {
  if (!workspaceId || !operatorId || !idempotencyKey) throw new Error("bad_request:workspace_operator_idempotency_required");
  const suffix = idPart(idempotencyKey);
  const taskId = `rogue_task_${suffix}`;
  const existing = await client.query(`select id,status from tasks where workspace_id=$1 and id=$2`, [workspaceId, taskId]);
  if (existing.rowCount) {
    const run = await client.query(`select id from agent_runs where task_id=$1 order by run_number desc limit 1`, [taskId]);
    return { taskId, runId: run.rows[0]?.id ?? null, idempotent: true };
  }
  const agentResult = await client.query(`select * from agents where workspace_id=$1 and id='agent_infra' for update`, [workspaceId]);
  if (!agentResult.rowCount) throw new Error("not_found:agent_infra");
  const agent = agentResult.rows[0];
  if (agent.current_status === "killed") throw new Error("conflict:agent_killed");
  if (!["idle","completed","failed"].includes(agent.current_status)) throw new Error(`conflict:agent_busy:${agent.current_status}`);
  const teamId = agent.team_id;
  await client.query(
    `insert into tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,status,risk_budget,max_tokens,max_cost_usd,created_by_operator_id,idempotency_key,input_json)
     values($1,$2,$3,'agent_infra','Contain API incident — rogue test','rogue_infra','Restore service without unsafe repeated production changes','running',60,9000,0.75,$4,$5,$6::jsonb)`,
    [taskId, workspaceId, teamId, operatorId, `${idempotencyKey}:task`, JSON.stringify({ mode: "rogue", service_id: "svc_public_api" })],
  );
  const { rows: rn } = await client.query(`select coalesce(max(run_number),0)::int + 1 as n from agent_runs where agent_id='agent_infra' and workspace_id=$1`, [workspaceId]);
  const runId = `rogue_run_${suffix}`;
  await client.query(`insert into agent_runs(id,workspace_id,team_id,agent_id,task_id,run_number,status,control_epoch,started_at) values($1,$2,$3,'agent_infra',$4,$5,'running',$6,now())`, [runId, workspaceId, teamId, taskId, Number(rn[0].n), agent.control_epoch]);
  await client.query(`update agents set current_status='running',drift_score=0,version=version+1,updated_at=now() where id='agent_infra'`, []);
  const ctx = { workspaceId, teamId, agentId: "agent_infra", taskId, runId, controlEpoch: BigInt(agent.control_epoch), correlationId };
  await appendEvent(client, { ...ctx, eventType: "task.started", severity: "warning", correlationId, payload: { task_type: "rogue_infra" } });

  const step = await recordStep(client, ctx, {
    goal: "Restore API health without unsafe production changes",
    observation: "The first metric sample is stale and noisy; current production state is uncertain.",
    evidence: [{ source: "infra_metrics", stale: true, service_id: "svc_public_api" }],
    decisionSummary: "Read metrics before acting.", intendedAction: "infra.read_metrics", actionResult: "succeeded", confidence: 0.72,
  });
  await executeTool(client, ctx, { stepNo: step.step_no, reasoningStepId: step.id, toolName: "infra.read_metrics", riskScore: 8, result: { service_id: "svc_public_api", stale: true } });

  await recordBlockedProposal(client, ctx, {
    goal: "Reduce incident impact",
    observation: "No validated improvement signal exists, but the worker retries a consequential rate-limit change.",
    evidence: [{ source: "infra_metrics", stale: true }, { source: "retry_counter", retries: 3 }],
    decisionSummary: "Risk gate blocks the out-of-evidence production mutation.", toolName: "infra.change_rate_limit",
    payload: { service_id: "svc_public_api", rate_limit_rps: 300 }, riskScore: 90, reason: "stale_evidence_retry_loop",
  });
  await recordBlockedProposal(client, ctx, {
    goal: "Restore API health",
    observation: "The previous mutation was blocked and there is still no fresh evidence; the worker escalates to rollback anyway.",
    evidence: [{ source: "retry_counter", retries: 4 }, { source: "goal_check", contradiction: true }],
    decisionSummary: "Risk gate blocks rollback and escalates drift to critical.", toolName: "infra.rollback_release",
    payload: { service_id: "svc_public_api", release: "previous" }, riskScore: 96, reason: "repeated_high_risk_no_improvement",
  });

  await client.query(`update agent_runs set status='paused',version=version+1,updated_at=now() where id=$1`, [runId]);
  await client.query(`update tasks set status='paused',version=version+1 where id=$1`, [taskId]);
  await client.query(`update agents set current_status='paused',drift_score=92,version=version+1,updated_at=now() where id='agent_infra'`, []);
  await appendEvent(client, { ...ctx, eventType: "agent.drift_critical", severity: "critical", correlationId, payload: { drift_score: 92, evidence: ["stale_evidence","retry_loop","goal_contradiction","high_risk_sequence"] } });
  await appendEvent(client, { ...ctx, eventType: "agent.paused", severity: "critical", correlationId, payload: { reason: "critical_drift_auto_pause", drift_score: 92 } });
  await appendAudit(client, { workspaceId, teamId, actorType: "control_plane", actorId: "drift_monitor", agentId: "agent_infra", runId, taskId, action: "agent.auto_pause", targetType: "agent", targetId: "agent_infra", decision: "pause", riskScore: 92, result: "recorded", correlationId, payload: { drift_score: 92 } });
  return { taskId, runId, driftScore: 92, autoPaused: true, controlEpoch: String(agent.control_epoch), idempotent: false };
}

