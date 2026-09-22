import { appendAudit } from "./db.mjs";
import { idPart, recordStep, executeTool, startRun, completeRun, createApprovalGate } from "./scenario-runtime.mjs";

async function runInfraNormal(client, started) {
  const { ctx } = started;
  let step = await recordStep(client, ctx, {
    goal: "Restore API health without unsafe production changes",
    observation: "Error rate is elevated while the service remains reachable.",
    evidence: [{ source: "infra_metrics", service_id: "svc_public_api", metric: "error_rate" }],
    decisionSummary: "Read current metrics before changing production state.",
    intendedAction: "infra.read_metrics", actionResult: "succeeded", confidence: 0.94,
  });
  await executeTool(client, ctx, { stepNo: step.step_no, reasoningStepId: step.id, toolName: "infra.read_metrics", riskScore: 8, result: { service_id: "svc_public_api", observed: true } });

  step = await recordStep(client, ctx, {
    goal: "Create an auditable incident before remediation",
    observation: "The API is degraded and warrants tracked incident response.",
    evidence: [{ source: "infra_services", service_id: "svc_public_api", status: "degraded" }],
    decisionSummary: "Open an incident; defer consequential production mutations.",
    intendedAction: "infra.open_incident", actionResult: "succeeded", confidence: 0.92,
  });
  await executeTool(client, ctx, {
    stepNo: step.step_no, reasoningStepId: step.id, toolName: "infra.open_incident", riskScore: 24,
    payload: { service_id: "svc_public_api", severity: "sev2" },
    apply: async (c) => {
      const incident = `incident_${idPart(ctx.runId)}`;
      await c.query(`insert into incidents(id,workspace_id,team_id,service_id,title,severity,status,opened_by_agent_id) values($1,$2,$3,'svc_public_api','Public API error spike','sev2','open',$4) on conflict (id) do nothing`, [incident, ctx.workspaceId, ctx.teamId, ctx.agentId]);
      return { incident_id: incident, status: "open" };
    },
  });
  await completeRun(client, ctx, "incident_opened_without_unsafe_mutation");
}

async function runSales(client, started) {
  const { ctx } = started;
  let step = await recordStep(client, ctx, {
    goal: "Qualify pipeline and prepare safe follow-up",
    observation: "Northwind is a mid-market account with meaningful annual value.",
    evidence: [{ source: "crm_accounts", account_id: "acct_northwind" }],
    decisionSummary: "Read account context before changing lead state.", intendedAction: "crm.read_account", actionResult: "succeeded",
  });
  await executeTool(client, ctx, { stepNo: step.step_no, reasoningStepId: step.id, toolName: "crm.read_account", riskScore: 10, payload: { account_id: "acct_northwind" }, result: { account_id: "acct_northwind", read: true } });

  step = await recordStep(client, ctx, {
    goal: "Qualify the strongest lead",
    observation: "Northwind has healthy account fit and no discount request.",
    evidence: [{ source: "crm_leads", lead_id: "lead_northwind" }],
    decisionSummary: "Score Northwind as qualified.", intendedAction: "crm.score_lead", actionResult: "succeeded",
  });
  await executeTool(client, ctx, {
    stepNo: step.step_no, reasoningStepId: step.id, toolName: "crm.score_lead", riskScore: 18,
    payload: { lead_id: "lead_northwind", score: 82 },
    apply: async (c, p) => { await c.query(`update crm_leads set score=$1,updated_at=now() where workspace_id=$2 and team_id=$3 and id=$4`, [p.score, ctx.workspaceId, ctx.teamId, p.lead_id]); return { lead_id: p.lead_id, score: p.score }; },
  });

  step = await recordStep(client, ctx, {
    goal: "Advance qualified pipeline",
    observation: "Northwind score exceeds the qualification threshold.",
    evidence: [{ source: "crm_leads", lead_id: "lead_northwind", score: 82 }],
    decisionSummary: "Move Northwind to qualified.", intendedAction: "crm.update_stage", actionResult: "succeeded",
  });
  await executeTool(client, ctx, {
    stepNo: step.step_no, reasoningStepId: step.id, toolName: "crm.update_stage", riskScore: 20,
    payload: { lead_id: "lead_northwind", stage: "qualified" },
    apply: async (c, p) => { await c.query(`update crm_leads set stage=$1,updated_at=now() where workspace_id=$2 and team_id=$3 and id=$4`, [p.stage, ctx.workspaceId, ctx.teamId, p.lead_id]); return { lead_id: p.lead_id, stage: p.stage }; },
  });

  return createApprovalGate(client, ctx, {
    goal: "Handle a discount request without bypassing commercial policy",
    observation: "Meridian requests an 18% discount; the demo policy requires approval above 10%.",
    evidence: [{ source: "crm_leads", lead_id: "lead_meridian", requested_discount_pct: 18 }, { source: "policy_sales_discount", threshold_pct: 10 }],
    decisionSummary: "Propose a bounded 15% discount and wait for operator approval.",
    toolName: "crm.propose_discount", payload: { lead_id: "lead_meridian", discount_pct: 15 }, riskScore: 72,
    estimatedImpact: { annual_value_usd: 54000, discount_pct: 15 },
  });
}

async function runSupport(client, started) {
  const { ctx } = started;
  let step = await recordStep(client, ctx, {
    goal: "Resolve support requests within billing policy",
    observation: "Alto Systems has a duplicate-charge case requesting $125 credit.",
    evidence: [{ source: "support_tickets", ticket_id: "ticket_102", requested_credit_usd: 125 }],
    decisionSummary: "Read the ticket before issuing a bounded credit.", intendedAction: "support.read_ticket", actionResult: "succeeded",
  });
  await executeTool(client, ctx, { stepNo: step.step_no, reasoningStepId: step.id, toolName: "support.read_ticket", riskScore: 8, payload: { ticket_id: "ticket_102" }, result: { ticket_id: "ticket_102", read: true } });

  step = await recordStep(client, ctx, {
    goal: "Correct the bounded duplicate-charge impact",
    observation: "$125 is below the $200 approval threshold.",
    evidence: [{ source: "policy_support_credit", approval_above_usd: 200 }],
    decisionSummary: "Issue the bounded credit without escalation.", intendedAction: "billing.issue_credit", actionResult: "succeeded",
  });
  await executeTool(client, ctx, {
    stepNo: step.step_no, reasoningStepId: step.id, toolName: "billing.issue_credit", riskScore: 32,
    payload: { ticket_id: "ticket_102", amount_usd: 125 },
    apply: async (c, p) => { const credit = `credit_${idPart(ctx.runId)}_125`; await c.query(`insert into account_credits(id,workspace_id,team_id,ticket_id,amount_usd,status,issued_by_agent_id) values($1,$2,$3,$4,$5,'issued',$6) on conflict (id) do nothing`, [credit, ctx.workspaceId, ctx.teamId, p.ticket_id, p.amount_usd, ctx.agentId]); return { credit_id: credit, amount_usd: p.amount_usd }; },
  });

  step = await recordStep(client, ctx, {
    goal: "Close the corrected bounded case",
    observation: "The $125 credit has been issued successfully.",
    evidence: [{ source: "account_credits", ticket_id: "ticket_102", amount_usd: 125 }],
    decisionSummary: "Resolve the ticket.", intendedAction: "support.resolve_ticket", actionResult: "succeeded",
  });
  await executeTool(client, ctx, {
    stepNo: step.step_no, reasoningStepId: step.id, toolName: "support.resolve_ticket", riskScore: 16,
    payload: { ticket_id: "ticket_102" },
    apply: async (c, p) => { await c.query(`update support_tickets set status='resolved',updated_at=now() where workspace_id=$1 and team_id=$2 and id=$3`, [ctx.workspaceId, ctx.teamId, p.ticket_id]); return { ticket_id: p.ticket_id, status: "resolved" }; },
  });

  return createApprovalGate(client, ctx, {
    goal: "Handle a larger service-credit request safely",
    observation: "Juniper Works requests a $350 service credit; policy requires approval above $200.",
    evidence: [{ source: "support_tickets", ticket_id: "ticket_103", requested_credit_usd: 350 }, { source: "policy_support_credit", approval_above_usd: 200 }],
    decisionSummary: "Pause the $350 credit action for operator review.",
    toolName: "billing.issue_credit", payload: { ticket_id: "ticket_103", amount_usd: 350 }, riskScore: 76,
    estimatedImpact: { credit_usd: 350 },
  });
}

export async function startAllScenario(client, { workspaceId, operatorId, idempotencyKey, correlationId }) {
  if (!workspaceId || !operatorId || !idempotencyKey) throw new Error("bad_request:workspace_operator_idempotency_required");
  const taskIds = ["task_infra_seed", "task_support_seed", "task_sales_seed"];
  const started = [];
  for (const taskId of taskIds) started.push(await startRun(client, { workspaceId, taskId, correlationId }));
  const approvals = [];
  for (const run of started) {
    if (run.alreadyStarted) continue;
    if (run.task.assigned_agent_id === "agent_infra") await runInfraNormal(client, run);
    else if (run.task.assigned_agent_id === "agent_support") approvals.push(await runSupport(client, run));
    else if (run.task.assigned_agent_id === "agent_sales") approvals.push(await runSales(client, run));
  }
  await appendAudit(client, { workspaceId, actorType: "operator", actorId: operatorId, action: "scenario.start_all", targetType: "workspace", targetId: workspaceId, decision: "start", result: started.some((x) => !x.alreadyStarted) ? "recorded" : "idempotent", correlationId, payload: { runs: started.map((x) => x.run.id), approvals } });
  return { runs: started.map((x) => x.run.id), approvals, idempotent: started.every((x) => x.alreadyStarted) };
}

