// Temporary private verification service. It accepts no SQL, workspace or IDs
// from the caller; every mutation belongs to a newly created test workspace.
import { randomBytes, timingSafeEqual } from "node:crypto";
import handler from "../actcontrol/handler.mjs";
import { pool, withTx, json } from "../shared/db.mjs";
import { startAllScenario, startRogueScenario } from "../shared/scenarios.mjs";
import { executeTool, startRun } from "../shared/scenario-runtime.mjs";

const internalKey = randomBytes(32).toString("base64url");
process.env.CONTROL_API_KEY = internalKey;
const equal = (a, b) => !!a && !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
let running = false;

async function suite() {
  const suffix = randomBytes(5).toString("hex");
  const id = (name) => `${name}_${suffix}`;
  const ws = id("ws_acceptance"), ops = id("team_ops"), rev = id("team_rev"), operator = id("operator");
  const infra = id("infra"), support = id("support"), sales = id("sales");
  const service = id("svc"), boundedTicket = id("ticket125"), gatedTicket = id("ticket350");
  const account = id("account"), lead = id("lead"), discountLead = id("discount");
  const taskIds = [id("task_infra"), id("task_support"), id("task_sales")];
  const report = { startedAt: new Date().toISOString(), workspace: ws, database: "controltower", checks: [], concurrency: {} };
  const check = (name, ok, evidence) => {
    report.checks.push({ name, passed: !!ok, evidence });
    if (!ok) throw new Error(`acceptance_failed:${name}`);
  };
  const q = async (sql, values = []) => (await pool.query(sql, values)).rows;
  const request = async (path, body, key = `${id(path.replace(/[^a-z]/g, ""))}:${randomBytes(6).toString("hex")}`) => {
    const r = await handler.fetch(new Request(`https://acceptance.invalid${path}`, {
      method: body ? "POST" : "GET", headers: { "x-api-key": internalKey, "content-type": "application/json", "idempotency-key": key },
      ...(body ? { body: JSON.stringify({ workspaceId: ws, operatorId: operator, ...body }) } : {}),
    }));
    return { status: r.status, body: await r.json() };
  };
  const deny = async (name, fn) => {
    let error;
    try { await withTx(fn); } catch (e) { error = { code: e.code, message: e.message }; }
    check(name, error && ["55000", "23503", "23514"].includes(error.code), error);
  };
  try {
    const migration = await q("select version from schema_migrations where version='006_authoritative_epoch_fence'");
    check("main_migration_006_installed", migration.length === 1, migration);
    await withTx(async (c) => {
      await c.query("insert into workspaces(id,name,slug) values($1,'Acceptance fixture',$1)", [ws]);
      for (const [team, name] of [[ops, "Operations"], [rev, "Revenue"]]) await c.query("insert into teams(id,workspace_id,name,slug) values($1,$2,$3,$1)", [team, ws, name]);
      await c.query("insert into operators(id,workspace_id,display_name,role) values($1,$2,'Acceptance operator','admin')", [operator, ws]);
      for (const [agent, team, kind] of [[infra, ops, "infra_ops"], [support, ops, "support_ops"], [sales, rev, "sales_ops"]]) await c.query("insert into agents(id,workspace_id,team_id,name,agent_type) values($1,$2,$3,$1,$4)", [agent, ws, team, kind]);
      await c.query("insert into infra_services(id,workspace_id,team_id,name,environment,status,rate_limit_rps) values($1,$2,$3,'API','production','degraded',1200)", [service, ws, ops]);
      for (const [ticket, amount] of [[boundedTicket,125],[gatedTicket,350]]) await c.query("insert into support_tickets(id,workspace_id,team_id,customer_name,subject,priority,status,requested_credit_usd,owner_agent_id) values($1,$2,$3,'Customer','Credit test','high','open',$4,$5)", [ticket,ws,ops,amount,support]);
      await c.query("insert into crm_accounts(id,workspace_id,team_id,name,segment,employee_count,annual_value_usd) values($1,$2,$3,'Account','mid_market',120,54000)", [account,ws,rev]);
      for (const lid of [lead,discountLead]) await c.query("insert into crm_leads(id,workspace_id,team_id,account_id,stage,requested_discount_pct,owner_agent_id) values($1,$2,$3,$4,'new',18,$5)", [lid,ws,rev,account,sales]);
      const inputs = [{serviceId:service},{ticketIds:[boundedTicket,gatedTicket]},{primaryAccountId:account,primaryLeadId:lead,discountLeadId:discountLead}];
      for (let i=0;i<3;i++) await c.query("insert into tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,created_by_operator_id,idempotency_key,input_json) values($1,$2,$3,$4,'Acceptance task',$5,'Verify guarded execution',$6,$1,$7::jsonb)", [taskIds[i],ws,i===2?rev:ops,[infra,support,sales][i],["incident_response","support_triage","lead_qualification"][i],operator,JSON.stringify(inputs[i])]);
    });
    const baseline = await q("select (select count(*) from agent_runs where workspace_id=$1)::int as runs,(select count(*) from account_credits where workspace_id=$1)::int as credits", [ws]);
    check("fresh_fixture_zero_baseline", baseline[0].runs===0 && baseline[0].credits===0, baseline[0]);
    const args = { workspaceId:ws,operatorId:operator,idempotencyKey:id("normal"),correlationId:id("normal"),taskIds };
    const normal = await withTx(c=>startAllScenario(c,args));
    check("normal_three_fresh_runs",normal.runs.length===3 && normal.approvals.length===2 && !normal.idempotent,normal);
    const beforeDecisions = await q("select ticket_id,amount_usd from account_credits where workspace_id=$1",[ws]);
    check("risk_gate_no_350_effect_before_approval",beforeDecisions.length===1 && Number(beforeDecisions[0].amount_usd)===125,beforeDecisions);
    const scored = await q("select stage,score from crm_leads where id=$1",[lead]);
    check("normal_sales_scoring_effect",scored[0].stage==="qualified" && scored[0].score===82,scored[0]);
    const again = await withTx(c=>startAllScenario(c,args));
    const runCount = await q("select count(*)::int as n from agent_runs where workspace_id=$1",[ws]);
    check("normal_idempotent_no_duplicate_runs",again.idempotent && runCount[0].n===3,again);
    const pending = await q("select * from approvals where workspace_id=$1 order by action_type",[ws]);
    const creditApproval = pending.find(x=>x.action_type==="billing.issue_credit");
    const discountApproval = pending.find(x=>x.action_type==="crm.propose_discount");
    const wrongTeam = await request(`/approvals/${creditApproval.id}/approve`,{teamId:rev});
    check("approval_wrong_team_denied",wrongTeam.status===404,wrongTeam);
    // Test real generated-column FK checks before allowing the original action.
    const bindingClient = await pool.connect();
    try {
      await bindingClient.query("begin");
      await bindingClient.query("update approvals set status='approved',decided_at=now(),decided_by_operator_id=$1,version=version+1 where id=$2",[operator,creditApproval.id]);
      for (const [name,change] of [["payload","action_payload=jsonb_set(action_payload,'{amount_usd}','351')"],["action","tool_name='support.resolve_ticket'"],["risk","risk_score=75"]]) {
        await bindingClient.query("savepoint binding_probe");
        let error;
        try { await bindingClient.query(`update tool_actions set status='executing',${change} where approval_id=$1`,[creditApproval.id]); await bindingClient.query("set constraints all immediate"); }
        catch(e) { error={code:e.code,message:e.message}; }
        await bindingClient.query("rollback to binding_probe");
        check(`approval_exact_${name}_substitution_denied`,error && ["23503","55000"].includes(error.code),error);
      }
      await bindingClient.query("rollback");
    } finally { await bindingClient.query("rollback").catch(()=>{}); bindingClient.release(); }
    const accepted = await request(`/approvals/${creditApproval.id}/approve`,{teamId:ops});
    check("approval_approve_http_200",accepted.status===200,accepted);
    const issued = await q("select ticket_id,amount_usd from account_credits where workspace_id=$1 and ticket_id=$2",[ws,gatedTicket]);
    check("approval_exact_350_effect_once",issued.length===1 && Number(issued[0].amount_usd)===350,issued);
    const duplicate = await request(`/approvals/${creditApproval.id}/approve`,{teamId:ops});
    check("approval_duplicate_conflict",duplicate.status===409,duplicate);
    const rejected = await request(`/approvals/${discountApproval.id}/reject`,{teamId:rev});
    const unchanged = await q("select stage,requested_discount_pct from crm_leads where id=$1",[discountLead]);
    check("approval_reject_no_discount_effect",rejected.status===200 && unchanged[0].stage==="new" && Number(unchanged[0].requested_discount_pct)===18,{rejected,lead:unchanged[0]});
    const fleet = await request(`/fleet?workspace_id=${ws}&team_id=${ops}`);
    check("team_scoped_fleet",fleet.status===200 && fleet.body.agents.length===2 && fleet.body.agents.every(x=>x.team_id===ops),fleet.body.agents.map(x=>x.id));
    const replay = await request(`/replay/${normal.runs[1]}?workspace_id=${ws}`);
    check("persisted_replay_structured",replay.status===200 && replay.body.steps?.length>0 && !JSON.stringify(replay.body).includes("chain_of_thought"),{status:replay.status,steps:replay.body.steps?.length});
    const usage = await request(`/usage?workspace_id=${ws}`);
    check("persisted_usage_simulated_nonzero",usage.status===200 && Number(usage.body.total_tokens)>0 && Number(usage.body.total_cost_usd)>0,usage.body);
    const rogue = await withTx(c=>startRogueScenario(c,{workspaceId:ws,operatorId:operator,idempotencyKey:id("rogue"),correlationId:id("rogue"),agentId:infra,serviceId:service}));
    const infrastructure = await q("select rate_limit_rps from infra_services where id=$1",[service]);
    const blocked = await q("select tool_name,status from tool_actions where run_id=$1 and risk_decision='block'",[rogue.runId]);
    check("rogue_real_auto_pause_and_two_blocks",rogue.autoPaused && rogue.driftScore===92 && blocked.length===2 && infrastructure[0].rate_limit_rps===1200,{rogue,blocked,infrastructure});
    const resume = await request(`/agents/${infra}/resume`,{teamId:ops});
    const pause = await request(`/agents/${infra}/pause`,{teamId:ops});
    const kill = await request(`/agents/${infra}/kill`,{teamId:ops});
    check("intervention_resume_pause_kill",resume.status===200 && pause.status===200 && kill.status===200 && kill.body.staleWorkerGuard?.blocked,{resume:resume.status,pause:pause.status,kill});
    const postKillResume = await request(`/agents/${infra}/resume`,{teamId:ops});
    check("killed_agent_terminal",postKillResume.status===409,postKillResume);

    // Two physical PostgreSQL connections, with observed pg_blocking_pids;
    // the HTTP operator kill overlaps an actual guarded credit mutation.
    const concurrentTask=id("task_concur");
    await q("insert into tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,created_by_operator_id,idempotency_key) values($1,$2,$3,$4,'Concurrent credit','support_triage','Test kill serialization',$5,$1)",[concurrentTask,ws,ops,support,operator]);
    const started=await withTx(c=>startRun(c,{workspaceId:ws,taskId:concurrentTask,correlationId:id("concur")}));
    let enter,release;
    const entered=new Promise(r=>enter=r), gate=new Promise(r=>release=r);
    let workerPid;
    const worker=withTx(async c=>{
      workerPid=(await c.query("select pg_backend_pid() as pid")).rows[0].pid;
      return executeTool(c,started.ctx,{stepNo:1,toolName:"billing.issue_credit",riskScore:32,payload:{ticket_id:boundedTicket,amount_usd:125},apply:async client=>{
        enter(); await gate;
        await client.query("insert into account_credits(id,workspace_id,team_id,ticket_id,amount_usd,status,issued_by_agent_id) values($1,$2,$3,$4,125,'issued',$5)",[id("credit_concurrent"),ws,ops,boundedTicket,support]);
        return {credit_id:id("credit_concurrent")};
      }});
    });
    await entered;
    const overlappingKill=request(`/agents/${support}/kill`,{teamId:ops});
    let waits=[];
    const deadline=Date.now()+8000;
    try {
      while(Date.now()<deadline && !waits.length) waits=await q("select pid,pg_blocking_pids(pid) as blockers,wait_event_type from pg_stat_activity where $1=any(pg_blocking_pids(pid))",[workerPid]);
    } finally { release(); }
    const [workerResult,killResult]=await Promise.all([worker,overlappingKill]);
    report.concurrency={workerPid,observedBlockedConnections:waits,workerResult,killStatus:killResult.status};
    check("genuine_overlap_kill_waits_for_worker_commit",waits.some(x=>x.pid!==workerPid && x.blockers.includes(workerPid)) && killResult.status===200,report.concurrency);
    let lateEffect=false;
    await deny("post_kill_old_worker_blocked",c=>executeTool(c,started.ctx,{stepNo:2,toolName:"billing.issue_credit",riskScore:32,payload:{ticket_id:boundedTicket,amount_usd:125},apply:async()=>{lateEffect=true;return {};}}));
    check("post_kill_zero_late_effect",!lateEffect,{lateEffect});
    // Authoritative epoch check even when an outstanding run remains running.
    const epochAgent=id("epoch_agent"),epochTask=id("epoch_task"),epochRun=id("epoch_run");
    await withTx(async c=>{
      await c.query("insert into agents(id,workspace_id,team_id,name,agent_type,current_status,control_epoch) values($1,$2,$3,'Epoch test','infra_ops','running',1)",[epochAgent,ws,ops]);
      await c.query("insert into tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,status) values($1,$2,$3,$4,'Old run fixture','incident_response','Fence old epoch','running')",[epochTask,ws,ops,epochAgent]);
      await c.query("insert into agent_runs(id,workspace_id,team_id,agent_id,task_id,run_number,status,control_epoch) values($1,$2,$3,$4,$5,1,'running',0)",[epochRun,ws,ops,epochAgent,epochTask]);
    });
    await deny("authoritative_epoch_rejects_old_running_run",c=>c.query("insert into tool_actions(id,workspace_id,team_id,agent_id,run_id,task_id,tool_name,environment,action_payload,risk_score,risk_decision,status,worker_control_epoch,idempotency_key) values($1,$2,$3,$4,$5,$6,'infra.read_metrics','staging','{}',8,'allow','executing',0,$1)",[id("epoch_probe"),ws,ops,epochAgent,epochRun,epochTask]));
    const events=await q("select sequence,event_type from agent_events where workspace_id=$1 order by sequence",[ws]);
    check("persisted_event_order_unique",events.length>20 && events.every((x,i)=>i===0||BigInt(x.sequence)===BigInt(events[i-1].sequence)+1n),{count:events.length,first:events[0],last:events.at(-1)});
    const audit=await request(`/audit/export?workspace_id=${ws}&format=json`);
    check("audit_contains_operator_and_denial",audit.status===200 && JSON.stringify(audit.body).includes("approval.approve") && JSON.stringify(audit.body).includes("stale_worker_rejected"),{status:audit.status});
    report.passed=true;
  } catch(e) { report.passed=false;report.error={code:e.code,message:e.message}; }
  report.completedAt=new Date().toISOString();
  return report;
}

export default { async fetch(request) {
  if (request.method!=="POST" || new URL(request.url).pathname!=="/run") return json({error:"not_found"},404);
  if (Date.now()>Number(process.env.ACT_TEST_DEADLINE)||!equal(request.headers.get("x-test-key"),process.env.ACT_TEST_KEY)) return json({error:"unauthorized"},401);
  if (running) return json({error:"conflict:verification_running"},409);
  running=true;
  try { const report=await suite();return json(report,report.passed?200:500); }
  finally { running=false; }
}};
