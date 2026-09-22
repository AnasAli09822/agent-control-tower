import { appendAudit, appendEvent, nextBigintId } from "./db.mjs";

const MODEL = "simulated-control-agent-v1";

export const idPart = (value) => String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-16) || "demo";
export const toolId = (runId, stepNo) => `tool_${idPart(runId)}_${stepNo}`;
export const approvalId = (runId, stepNo) => `approval_${idPart(runId)}_${stepNo}`;

async function nextRunNumber(client, taskId) {
  const { rows } = await client.query(`select coalesce(max(run_number),0)::int + 1 as run_number from agent_runs where task_id=$1`, [taskId]);
  return Number(rows[0].run_number);
}

async function nextStepNo(client, runId) {
  const { rows } = await client.query(`select coalesce(max(step_no),0)::int + 1 as step_no from reasoning_steps where run_id=$1`, [runId]);
  return Number(rows[0].step_no);
}

export async function recordStep(client, ctx, spec) {
  const stepNo = spec.stepNo ?? await nextStepNo(client, ctx.runId);
  const inputTokens = spec.inputTokens ?? 620;
  const outputTokens = spec.outputTokens ?? 180;
  const cachedTokens = spec.cachedTokens ?? 0;
  const costUsd = spec.costUsd ?? Number(((inputTokens * 0.000002) + (outputTokens * 0.000008) + (cachedTokens * 0.0000005)).toFixed(8));
  const durationMs = spec.durationMs ?? 240;
  const reasoningId = await nextBigintId(client, "reasoning_steps");
  const { rows } = await client.query(
    `insert into reasoning_steps(
       id,workspace_id,team_id,agent_id,run_id,task_id,step_no,goal,observation,evidence_json,
       decision_summary,policy_result,intended_action,action_result,confidence,
       input_tokens,output_tokens,cached_tokens,cost_usd,duration_ms
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     returning *`,
    [
      reasoningId, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, stepNo,
      spec.goal, spec.observation, JSON.stringify(spec.evidence ?? []), spec.decisionSummary,
      spec.policyResult ?? "allow", spec.intendedAction ?? null, spec.actionResult ?? null,
      spec.confidence ?? 0.88, inputTokens, outputTokens, cachedTokens, costUsd, durationMs,
    ],
  );
  const usageId = await nextBigintId(client, "usage_ledger");
  await client.query(
    `insert into usage_ledger(
       id,workspace_id,team_id,agent_id,run_id,task_id,reasoning_step_id,model,source,
       input_tokens,output_tokens,cached_tokens,cost_usd,duration_ms,idempotency_key
     ) values($1,$2,$3,$4,$5,$6,$7,$8,'simulated',$9,$10,$11,$12,$13,$14)`,
    [usageId, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, reasoningId, MODEL,
      inputTokens, outputTokens, cachedTokens, costUsd, durationMs, `${ctx.runId}:usage:${stepNo}`],
  );
  await appendEvent(client, {
    workspaceId: ctx.workspaceId, teamId: ctx.teamId, agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId,
    eventType: "reasoning.step", correlationId: ctx.correlationId,
    payload: { step_no: stepNo, decision_summary: spec.decisionSummary, policy_result: spec.policyResult ?? "allow" },
  });
  await appendEvent(client, {
    workspaceId: ctx.workspaceId, teamId: ctx.teamId, agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId,
    eventType: "usage.recorded", severity: "debug", correlationId: ctx.correlationId,
    payload: { step_no: stepNo, input_tokens: inputTokens, output_tokens: outputTokens, cached_tokens: cachedTokens, cost_usd: costUsd, source: "simulated" },
  });
  return rows[0];
}

export async function executeTool(client, ctx, spec) {
  const id = spec.id ?? toolId(ctx.runId, spec.stepNo ?? await nextStepNo(client, ctx.runId));
  const actionPayload = spec.payload ?? {};
  await client.query(
    `insert into tool_actions(
       id,workspace_id,team_id,agent_id,run_id,task_id,reasoning_step_id,tool_name,environment,
       action_payload,risk_score,risk_decision,approval_id,status,worker_control_epoch,idempotency_key
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,'executing',$14,$15)`,
    [id, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, spec.reasoningStepId ?? null,
      spec.toolName, spec.environment ?? "sandbox", JSON.stringify(actionPayload), spec.riskScore ?? 10,
      spec.riskDecision ?? "allow", spec.approvalId ?? null, String(ctx.controlEpoch), `${ctx.runId}:tool:${id}`],
  );

  let result = spec.result ?? { ok: true };
  if (spec.apply) result = await spec.apply(client, actionPayload) ?? result;
  await client.query(
    `update tool_actions set status='succeeded',result_json=$1::jsonb,executed_at=now(),version=version+1 where id=$2`,
    [JSON.stringify(result), id],
  );
  await appendEvent(client, {
    workspaceId: ctx.workspaceId, teamId: ctx.teamId, agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId,
    eventType: "tool.completed", correlationId: ctx.correlationId,
    payload: { tool_action_id: id, tool_name: spec.toolName, risk_score: spec.riskScore ?? 10, risk_decision: spec.riskDecision ?? "allow" },
  });
  await appendAudit(client, {
    workspaceId: ctx.workspaceId, teamId: ctx.teamId, actorType: "agent", actorId: ctx.agentId,
    agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId, action: spec.toolName,
    targetType: "tool_action", targetId: id, decision: spec.riskDecision ?? "allow",
    riskScore: spec.riskScore ?? 10, result: "succeeded", correlationId: ctx.correlationId,
  });
  return id;
}

export async function startRun(client, { workspaceId, taskId, correlationId }) {
  const taskResult = await client.query(`select * from tasks where workspace_id=$1 and id=$2 for update`, [workspaceId, taskId]);
  if (!taskResult.rowCount) throw new Error(`not_found:task:${taskId}`);
  const task = taskResult.rows[0];
  const existing = await client.query(`select * from agent_runs where workspace_id=$1 and task_id=$2 order by run_number desc limit 1`, [workspaceId, taskId]);
  if (existing.rowCount) {
    const run = existing.rows[0];
    return { task, run, alreadyStarted: true, ctx: { workspaceId, teamId: task.team_id, agentId: task.assigned_agent_id, taskId, runId: run.id, controlEpoch: BigInt(run.control_epoch), correlationId } };
  }
  const agentResult = await client.query(`select * from agents where workspace_id=$1 and team_id=$2 and id=$3 for update`, [workspaceId, task.team_id, task.assigned_agent_id]);
  if (!agentResult.rowCount) throw new Error("not_found:agent");
  const agent = agentResult.rows[0];
  if (agent.current_status === "killed") throw new Error(`conflict:agent_killed:${agent.id}`);
  if (!["idle","completed","failed"].includes(agent.current_status)) throw new Error(`conflict:agent_busy:${agent.id}:${agent.current_status}`);

  const runNumber = await nextRunNumber(client, taskId);
  const runId = `run_${idPart(taskId)}_${runNumber}`;
  await client.query(
    `insert into agent_runs(id,workspace_id,team_id,agent_id,task_id,run_number,status,control_epoch,started_at)
     values($1,$2,$3,$4,$5,$6,'running',$7,now())`,
    [runId, workspaceId, task.team_id, task.assigned_agent_id, taskId, runNumber, agent.control_epoch],
  );
  await client.query(`update tasks set status='running',started_at=coalesce(started_at,now()),completed_at=null,version=version+1 where id=$1`, [taskId]);
  await client.query(`update agents set current_status='running',drift_score=0,version=version+1,updated_at=now(),last_heartbeat_at=now() where id=$1`, [task.assigned_agent_id]);
  const ctx = { workspaceId, teamId: task.team_id, agentId: task.assigned_agent_id, taskId, runId, controlEpoch: BigInt(agent.control_epoch), correlationId };
  await appendEvent(client, { ...ctx, eventType: "task.started", correlationId, payload: { task_type: task.task_type } });
  return { task, run: { id: runId, control_epoch: agent.control_epoch }, alreadyStarted: false, ctx };
}

export async function completeRun(client, ctx, summary = "task_completed") {
  await client.query(`update agent_runs set status='completed',version=version+1,ended_at=now(),updated_at=now() where id=$1`, [ctx.runId]);
  await client.query(`update tasks set status='completed',version=version+1,completed_at=now() where id=$1`, [ctx.taskId]);
  await client.query(`update agents set current_status='idle',version=version+1,updated_at=now(),last_heartbeat_at=now() where id=$1`, [ctx.agentId]);
  await appendEvent(client, { ...ctx, eventType: "task.completed", correlationId: ctx.correlationId, payload: { summary } });
}

export async function createApprovalGate(client, ctx, spec) {
  const step = await recordStep(client, ctx, {
    goal: spec.goal,
    observation: spec.observation,
    evidence: spec.evidence,
    decisionSummary: spec.decisionSummary,
    policyResult: "require_approval",
    intendedAction: spec.toolName,
    actionResult: "waiting_approval",
    inputTokens: spec.inputTokens ?? 760,
    outputTokens: spec.outputTokens ?? 220,
  });
  const approval = approvalId(ctx.runId, step.step_no);
  const action = toolId(ctx.runId, step.step_no);
  await client.query(
    `insert into approvals(
       id,workspace_id,team_id,agent_id,run_id,task_id,action_type,action_payload,reason,evidence_json,
       risk_level,risk_score,estimated_impact_json,status,version,idempotency_key
     ) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,'high',$11,$12::jsonb,'pending',0,$13)`,
    [approval, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, spec.toolName,
      JSON.stringify(spec.payload), spec.reason ?? "Policy requires operator approval", JSON.stringify(spec.evidence ?? []),
      spec.riskScore, JSON.stringify(spec.estimatedImpact ?? {}), `${ctx.runId}:approval:${step.step_no}`],
  );
  await client.query(
    `insert into tool_actions(
       id,workspace_id,team_id,agent_id,run_id,task_id,reasoning_step_id,tool_name,environment,action_payload,
       risk_score,risk_decision,approval_id,status,worker_control_epoch,idempotency_key
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'require_approval',$12,'waiting_approval',$13,$14)`,
    [action, ctx.workspaceId, ctx.teamId, ctx.agentId, ctx.runId, ctx.taskId, step.id, spec.toolName,
      spec.environment ?? "sandbox", JSON.stringify(spec.payload), spec.riskScore, approval, String(ctx.controlEpoch), `${ctx.runId}:tool:${action}`],
  );
  await client.query(`update agent_runs set status='waiting_approval',version=version+1,updated_at=now() where id=$1`, [ctx.runId]);
  await client.query(`update tasks set status='waiting_approval',version=version+1 where id=$1`, [ctx.taskId]);
  await client.query(`update agents set current_status='waiting_approval',version=version+1,updated_at=now() where id=$1`, [ctx.agentId]);
  await appendEvent(client, { ...ctx, eventType: "approval.requested", severity: "warning", correlationId: ctx.correlationId, payload: { approval_id: approval, tool_name: spec.toolName, risk_score: spec.riskScore } });
  await appendAudit(client, { workspaceId: ctx.workspaceId, teamId: ctx.teamId, actorType: "control_plane", actorId: "risk_gate", agentId: ctx.agentId, runId: ctx.runId, taskId: ctx.taskId, action: "approval.requested", targetType: "approval", targetId: approval, decision: "require_approval", riskScore: spec.riskScore, result: "recorded", correlationId: ctx.correlationId });
  return approval;
}

