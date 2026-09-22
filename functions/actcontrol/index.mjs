import {
  pool, withTx, appendEvent, appendAudit, nextBigintId,
  json, errorResponse, readJson, requireApiKey, idempotencyKey, correlationId,
} from "../shared/db.mjs";
import {
  startAllScenario, startRogueScenario, resolveApprovalAction, recordStaleWorkerDenial,
} from "../shared/scenarios.mjs";

function queryScope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
}

async function getFleet(url) {
  const { workspaceId, teamId } = queryScope(url);
  const params = [workspaceId];
  const teamClause = teamId ? `and a.team_id=$2` : "";
  if (teamId) params.push(teamId);
  const { rows } = await pool.query(
    `select a.id, a.workspace_id, a.team_id, a.name, a.agent_type, a.current_status,
            a.drift_score, a.control_epoch, a.version, a.last_heartbeat_at,
            task.id as current_task_id, task.title as current_task,
            latest_run.id as current_run_id,
            last_audit.action as last_action,
            usage.input_tokens, usage.output_tokens, usage.cached_tokens, usage.cost_usd
       from agents a
       left join lateral (
         select t.id, t.title from tasks t
          where t.workspace_id=a.workspace_id and t.team_id=a.team_id and t.assigned_agent_id=a.id
            and t.status in ('queued','running','waiting_approval','paused','blocked')
          order by t.created_at desc limit 1
       ) task on true
       left join lateral (
         select r.id from agent_runs r
          where r.workspace_id=a.workspace_id and r.team_id=a.team_id and r.agent_id=a.id
          order by r.created_at desc limit 1
       ) latest_run on true
       left join lateral (
         select au.action from audit_events au
          where au.workspace_id=a.workspace_id and au.agent_id=a.id
          order by au.created_at desc limit 1
       ) last_audit on true
       left join lateral (
         select coalesce(sum(u.input_tokens),0)::bigint as input_tokens,
                coalesce(sum(u.output_tokens),0)::bigint as output_tokens,
                coalesce(sum(u.cached_tokens),0)::bigint as cached_tokens,
                coalesce(sum(u.cost_usd),0)::numeric as cost_usd
           from usage_ledger u where u.workspace_id=a.workspace_id and u.agent_id=a.id
       ) usage on true
      where a.workspace_id=$1 ${teamClause}
      order by a.team_id, a.name`,
    params,
  );
  return json({ agents: rows });
}

async function getApprovals(url) {
  const { workspaceId, teamId } = queryScope(url);
  const params = [workspaceId];
  let teamClause = "";
  if (teamId) { params.push(teamId); teamClause = `and team_id=$2`; }
  const { rows } = await pool.query(
    `select id, workspace_id, team_id, agent_id, run_id, task_id, action_type, reason, evidence_json,
            risk_level, risk_score, estimated_impact_json, status, requested_at, decision_note, version
       from approvals where workspace_id=$1 ${teamClause}
      order by (status='pending') desc, requested_at desc limit 200`,
    params,
  );
  return json({ approvals: rows });
}

async function getUsage(url) {
  const { workspaceId, teamId } = queryScope(url);
  const params = [workspaceId];
  let teamClause = "";
  if (teamId) { params.push(teamId); teamClause = `and team_id=$2`; }
  const { rows } = await pool.query(
    `select coalesce(sum(input_tokens + output_tokens),0)::bigint as total_tokens,
            coalesce(sum(input_tokens),0)::bigint as input_tokens,
            coalesce(sum(output_tokens),0)::bigint as output_tokens,
            coalesce(sum(cached_tokens),0)::bigint as cached_tokens,
            coalesce(sum(cost_usd),0)::numeric as total_cost_usd
       from usage_ledger where workspace_id=$1 ${teamClause}`,
    params,
  );
  return json(rows[0]);
}

async function getReplay(url, runId) {
  const { workspaceId, teamId } = queryScope(url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
  const params = [workspaceId, runId];
  let teamClause = "";
  if (teamId) { params.push(teamId); teamClause = `and team_id=$3`; }
  params.push(limit);
  const { rows } = await pool.query(
    `select id, agent_id, run_id, task_id, step_no, goal, observation, evidence_json,
            decision_summary, policy_result, intended_action, action_result, confidence,
            input_tokens, output_tokens, cached_tokens, cost_usd, duration_ms, created_at
       from reasoning_steps
      where workspace_id=$1 and run_id=$2 ${teamClause}
      order by step_no desc limit $${params.length}`,
    params,
  );
  return json({ steps: rows.reverse() });
}

async function getAudit(url) {
  const { workspaceId, teamId } = queryScope(url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 1000);
  const params = [workspaceId];
  let teamClause = "";
  if (teamId) { params.push(teamId); teamClause = `and team_id=$2`; }
  params.push(limit);
  const { rows } = await pool.query(
    `select id, created_at, actor_type, actor_id, agent_id, run_id, task_id, action,
            target_type, target_id, decision, risk_score, result, correlation_id
       from audit_events where workspace_id=$1 ${teamClause}
      order by created_at desc, id desc limit $${params.length}`,
    params,
  );
  if (url.searchParams.get("format") === "csv") {
    const columns = ["created_at","actor_type","actor_id","agent_id","task_id","action","target_type","target_id","decision","risk_score","result","correlation_id"];
    const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
    const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=agent-control-tower-audit.csv", "cache-control": "no-store" } });
  }
  return json({ audit: rows });
}

async function activeContext(client, workspaceId, teamId, agentId) {
  const { rows } = await client.query(
    `select r.id as run_id, r.task_id, r.control_epoch, t.task_type
       from agent_runs r
       join tasks t on t.id=r.task_id and t.workspace_id=r.workspace_id and t.team_id=r.team_id
      where r.workspace_id=$1 and r.team_id=$2 and r.agent_id=$3
        and r.status in ('queued','running','waiting_approval','paused','blocked')
      order by r.created_at desc limit 1`,
    [workspaceId, teamId, agentId],
  );
  return rows[0] ?? { run_id: null, task_id: null, control_epoch: null, task_type: null };
}

async function assertTransition(client, from, to) {
  const { rowCount } = await client.query(
    `select 1 from agent_state_transition_rules where from_state=$1 and to_state=$2`,
    [from, to],
  );
  if (!rowCount) throw new Error(`invalid_transition:${from}->${to}`);
}

async function intervene(request, url, agentId, commandName) {
  requireApiKey(request);
  const body = await readJson(request);
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const teamId = body.teamId ?? body.team_id;
  const operatorId = body.operatorId ?? body.operator_id;
  const idem = idempotencyKey(request, body);
  if (!workspaceId || !teamId || !operatorId || !idem) throw new Error("bad_request:workspace_team_operator_idempotency_required");
  const corr = correlationId(request);

  const outcome = await withTx(async (client) => {
    const existing = await client.query(`select * from interventions where workspace_id=$1 and idempotency_key=$2`, [workspaceId, idem]);
    if (existing.rowCount) return { intervention: existing.rows[0], idempotent: true, staleContext: null };

    const agentResult = await client.query(
      `select * from agents where workspace_id=$1 and team_id=$2 and id=$3 for update`,
      [workspaceId, teamId, agentId],
    );
    if (!agentResult.rowCount) throw new Error("not_found:agent");
    const agent = agentResult.rows[0];
    const context = await activeContext(client, workspaceId, teamId, agentId);

    const to = commandName === "resume" ? "running" : commandName === "pause" ? "paused" : "killed";
    if (agent.current_status === to && commandName !== "kill") throw new Error(`conflict:already_${to}`);
    if (agent.current_status === "killed") throw new Error("conflict:agent_killed");
    await assertTransition(client, agent.current_status, to);

    if (commandName === "resume" && context.run_id) {
      const pending = await client.query(`select 1 from approvals where workspace_id=$1 and team_id=$2 and run_id=$3 and status='pending' limit 1`, [workspaceId, teamId, context.run_id]);
      if (pending.rowCount) throw new Error("conflict:pending_approval");
    }

    const oldEpoch = BigInt(agent.control_epoch);
    const newEpoch = commandName === "kill" ? oldEpoch + 1n : oldEpoch;
    const updated = await client.query(
      `update agents set current_status=$1, control_epoch=$2, version=version+1, updated_at=now()
        where workspace_id=$3 and team_id=$4 and id=$5 returning *`,
      [to, newEpoch.toString(), workspaceId, teamId, agentId],
    );
    if (context.run_id) {
      await client.query(`update agent_runs set status=$1, control_epoch=$2, version=version+1, updated_at=now(), ended_at=case when $1='killed' then now() else ended_at end where id=$3`, [to, newEpoch.toString(), context.run_id]);
      await client.query(`update tasks set status=$1, version=version+1, completed_at=case when $1='killed' then now() else completed_at end where id=$2`, [to, context.task_id]);
      if (commandName === "kill") {
        await client.query(`update approvals set status='cancelled', decided_at=now(), version=version+1 where run_id=$1 and status='pending'`, [context.run_id]);
      }
    }

    const interventionId = await nextBigintId(client, "interventions");
    const intervention = await client.query(
      `insert into interventions(id,workspace_id,team_id,operator_id,agent_id,run_id,task_id,command,reason,expected_version,resulting_control_epoch,idempotency_key)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [interventionId, workspaceId, teamId, operatorId, agentId, context.run_id, context.task_id, commandName, body.reason ?? `${commandName} from operator console`, body.expectedVersion ?? null, newEpoch.toString(), idem],
    );

    const eventType = commandName === "kill" ? "agent.kill" : `agent.${commandName}`;
    await appendEvent(client, { workspaceId, teamId, agentId, runId: context.run_id, taskId: context.task_id, eventType, severity: commandName === "kill" ? "critical" : "info", correlationId: corr, payload: { operator_id: operatorId, control_epoch: newEpoch.toString() } });
    await appendAudit(client, { workspaceId, teamId, actorType: "operator", actorId: operatorId, agentId, runId: context.run_id, taskId: context.task_id, action: eventType, targetType: "agent", targetId: agentId, decision: commandName, result: "recorded", correlationId: corr, payload: { control_epoch: newEpoch.toString() } });
    return {
      agent: updated.rows[0], intervention: intervention.rows[0], idempotent: false,
      staleContext: commandName === "kill" && context.task_type === "rogue_infra" && context.run_id ? {
        workspaceId, teamId, agentId, runId: context.run_id, taskId: context.task_id,
        workerEpoch: oldEpoch, currentEpoch: newEpoch,
      } : null,
    };
  });

  if (outcome.staleContext) {
    let blockedReason = null;
    try {
      await withTx(async (client) => {
        const probeId = `probe_${outcome.staleContext.runId}_${outcome.staleContext.currentEpoch}`;
        await client.query(
          `insert into tool_actions(id,workspace_id,team_id,agent_id,run_id,task_id,tool_name,environment,action_payload,risk_score,risk_decision,status,worker_control_epoch,idempotency_key)
           values($1,$2,$3,$4,$5,$6,'infra.change_rate_limit','production',$7::jsonb,95,'allow','executing',$8,$9)`,
          [probeId, outcome.staleContext.workspaceId, outcome.staleContext.teamId, outcome.staleContext.agentId,
            outcome.staleContext.runId, outcome.staleContext.taskId, JSON.stringify({ service_id: "svc_public_api", rate_limit_rps: 250 }),
            String(outcome.staleContext.workerEpoch), `${idem}:stale-probe`],
        );
      });
      throw new Error("stale_worker_guard_failed:mutation_was_not_blocked");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("stale_worker_guard_failed")) throw error;
      if (!message.includes("stale control epoch")) throw new Error(`stale_worker_guard_failed:${message}`);
      blockedReason = message;
    }
    const staleActionId = await withTx((client) => recordStaleWorkerDenial(client, { ...outcome.staleContext, correlationId: corr }));
    return json({ agent: outcome.agent, intervention: outcome.intervention, staleWorkerGuard: { blocked: true, reason: blockedReason, evidenceToolActionId: staleActionId } });
  }
  return json({ agent: outcome.agent ?? null, intervention: outcome.intervention, idempotent: outcome.idempotent });
}

async function decideApproval(request, approvalId, decision) {
  requireApiKey(request);
  const body = await readJson(request);
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const teamId = body.teamId ?? body.team_id;
  const operatorId = body.operatorId ?? body.operator_id;
  if (!workspaceId || !teamId || !operatorId) throw new Error("bad_request:workspace_team_operator_required");
  const corr = correlationId(request);
  return withTx(async (client) => {
    const result = await client.query(`select * from approvals where workspace_id=$1 and team_id=$2 and id=$3 for update`, [workspaceId, teamId, approvalId]);
    if (!result.rowCount) throw new Error("not_found:approval");
    const approval = result.rows[0];
    if (approval.status !== "pending") throw new Error(`conflict:approval_${approval.status}`);
    const status = decision === "approve" ? "approved" : "rejected";
    const updated = await client.query(
      `update approvals set status=$1, decided_by_operator_id=$2, decided_at=now(), decision_note=$3, version=version+1 where id=$4 returning *`,
      [status, operatorId, body.note ?? null, approvalId],
    );
    await appendEvent(client, { workspaceId, teamId, agentId: approval.agent_id, runId: approval.run_id, taskId: approval.task_id, eventType: `approval.${status}`, severity: status === "approved" ? "info" : "warning", correlationId: corr, payload: { approval_id: approvalId, action_payload_hash: approval.action_payload_hash } });
    await appendAudit(client, { workspaceId, teamId, actorType: "operator", actorId: operatorId, agentId: approval.agent_id, runId: approval.run_id, taskId: approval.task_id, action: `approval.${decision}`, targetType: "approval", targetId: approvalId, decision, riskScore: approval.risk_score, result: "recorded", correlationId: corr });
    const resolution = await resolveApprovalAction(client, { approval, decision, operatorId, correlationId: corr });
    return json({ approval: updated.rows[0], resolution });
  });
}

async function runScenario(request, scenario) {
  requireApiKey(request);
  const body = await readJson(request);
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const operatorId = body.operatorId ?? body.operator_id;
  const idem = idempotencyKey(request, body);
  if (!workspaceId || !operatorId || !idem) throw new Error("bad_request:workspace_operator_idempotency_required");
  const corr = correlationId(request);
  const result = await withTx((client) => scenario === "start-all"
    ? startAllScenario(client, { workspaceId, operatorId, idempotencyKey: idem, correlationId: corr })
    : startRogueScenario(client, { workspaceId, operatorId, idempotencyKey: idem, correlationId: corr }));
  return json(result);
}

async function guardTool(request) {
  requireApiKey(request);
  const body = await readJson(request);
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const teamId = body.teamId ?? body.team_id;
  const agentId = body.agentId ?? body.agent_id;
  const workerEpoch = BigInt(body.workerControlEpoch ?? body.worker_control_epoch ?? -1);
  if (!workspaceId || !teamId || !agentId) throw new Error("bad_request:workspace_team_agent_required");
  const { rows } = await pool.query(`select current_status, control_epoch from agents where workspace_id=$1 and team_id=$2 and id=$3`, [workspaceId, teamId, agentId]);
  if (!rows.length) throw new Error("not_found:agent");
  const currentEpoch = BigInt(rows[0].control_epoch);
  const allowed = rows[0].current_status !== "killed" && currentEpoch === workerEpoch;
  return json({ allowed, reason: allowed ? null : BigInt(rows[0].control_epoch) !== workerEpoch ? "stale_control_epoch" : "agent_killed", current_control_epoch: currentEpoch.toString() }, allowed ? 200 : 409);
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (request.method === "GET" && (path === "/" || path === "/health")) return json({ ok: true, service: "actcontrol" });
      // Every non-health control-plane route is private. The Vercel server proxy
      // injects the shared key; browsers never receive it.
      requireApiKey(request);
      if (request.method === "GET" && path === "/fleet") return getFleet(url);
      if (request.method === "GET" && path === "/approvals") return getApprovals(url);
      if (request.method === "GET" && path === "/usage") return getUsage(url);
      if (request.method === "GET" && path === "/audit/export") return getAudit(url);
      const replay = path.match(/^\/replay\/([^/]+)$/);
      if (request.method === "GET" && replay) return getReplay(url, decodeURIComponent(replay[1]));

      if (request.method === "POST" && path === "/scenarios/start-all") return runScenario(request, "start-all");
      if (request.method === "POST" && path === "/scenarios/rogue-infra") return runScenario(request, "rogue-infra");
      const intervention = path.match(/^\/agents\/([^/]+)\/(pause|resume|kill)$/);
      if (request.method === "POST" && intervention) return intervene(request, url, decodeURIComponent(intervention[1]), intervention[2]);
      const approval = path.match(/^\/approvals\/([^/]+)\/(approve|reject)$/);
      if (request.method === "POST" && approval) return decideApproval(request, decodeURIComponent(approval[1]), approval[2]);
      if (request.method === "POST" && path === "/tools/guard") return guardTool(request);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      console.error("actcontrol", error instanceof Error ? error.message : error);
      return errorResponse(error);
    }
  },
};
