import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {pool,withTx} from '../functions/shared/db.mjs';
import handler from '../functions/actcontrol/handler.mjs';
import {createDemoSession} from '../functions/shared/demo-session.mjs';
import {startSteppedDemo,startSteppedRogue,advanceWorkspace} from '../functions/shared/stepped-runtime.mjs';
import {executeTool} from '../functions/shared/scenario-runtime.mjs';

export async function runSteppedAcceptance(){
  const report={revision:'stepped-session-v1',startedAt:new Date().toISOString(),checks:[]};
  const check=(name,passed,evidence)=>{report.checks.push({name,passed:!!passed,evidence});assert.ok(passed,name);};
  const q=async(sql,params=[])=> (await pool.query(sql,params)).rows;
  const make=async()=>createDemoSession('ws_demo_'+randomBytes(16).toString('hex'));
  const s=await make();report.workspace=s.workspaceId;
  const req=async(path,body)=>{
    const response=await handler.fetch(new Request('https://acceptance.test'+path,{method:body?'POST':'GET',headers:{'x-api-key':process.env.CONTROL_API_KEY,'content-type':'application/json','idempotency-key':crypto.randomUUID()},...(body?{body:JSON.stringify({workspaceId:s.workspaceId,operatorId:s.operatorId,...body})}:{})}));
    return {status:response.status,body:await response.json()};
  };
  const due=()=>q("update agent_runs set updated_at=clock_timestamp()-interval '6 seconds' where workspace_id=$1 and status='running'",[s.workspaceId]);
  const tick=async()=>{await due();return advanceWorkspace(s.workspaceId);};
  const steps=async(agent)=>Number((await q('select count(*)::int as n from reasoning_steps where workspace_id=$1 and agent_id=$2',[s.workspaceId,agent]))[0].n);
  const base=await req(`/usage?workspace_id=${s.workspaceId}`);
  check('fresh_session_three_tasks_zero_usage',base.status===200&&base.body.by_task.length===3&&Number(base.body.total_tokens)===0,base.body);
  const normal=await startSteppedDemo({workspaceId:s.workspaceId,operatorId:s.operatorId,idempotencyKey:'fresh-start',correlationId:'fresh-start'});
  check('start_three_unique_running_runs_no_steps_yet',new Set(normal.runs).size===3&&(await q("select count(*)::int as n from agents where workspace_id=$1 and current_status='running'",[s.workspaceId]))[0].n===3&&await steps(s.agents.support)===0,normal);
  check('timing_gate_prevents_immediate_execution',(await advanceWorkspace(s.workspaceId)).length===0);
  const first=await tick();check('first_tick_commits_one_step_per_agent',first.length===3&&await steps(s.agents.support)===1&&await steps(s.agents.sales)===1,first);
  const paused=await req(`/agents/${s.agents.sales}/pause`,{teamId:s.teams[1].id});
  await tick();check('pause_in_flight_prevents_next_sales_step',paused.status===200&&await steps(s.agents.sales)===1,paused);
  const resumed=await req(`/agents/${s.agents.sales}/resume`,{teamId:s.teams[1].id});check('resume_continues_same_run',resumed.status===200&&resumed.body.agent.current_status==='running',resumed);
  for(let i=0;i<3;i++)await tick();
  const queue=await req(`/approvals?workspace_id=${s.workspaceId}`);const pending=queue.body.approvals.filter(a=>a.status==='pending');
  check('normal_tasks_reach_two_exact_approval_gates',pending.length===2,pending.map(a=>({id:a.id,action:a.action_type,payload:a.action_payload})));
  const creditsBefore=await q('select amount_usd from account_credits where workspace_id=$1',[s.workspaceId]);
  check('no_350_credit_before_approval',creditsBefore.length===1&&Number(creditsBefore[0].amount_usd)===125,creditsBefore);
  const credit=pending.find(a=>a.action_type==='billing.issue_credit'),discount=pending.find(a=>a.action_type==='crm.propose_discount');
  await req(`/agents/${s.agents.support}/pause`,{teamId:s.teams[0].id});
  const blockedDecision=await req(`/approvals/${credit.id}/approve`,{teamId:s.teams[0].id});
  check('paused_approval_returns_409_without_effect',blockedDecision.status===409&&(await q('select count(*)::int as n from account_credits where workspace_id=$1',[s.workspaceId]))[0].n===1,blockedDecision);
  const resumeApproval=await req(`/agents/${s.agents.support}/resume`,{teamId:s.teams[0].id});
  check('resume_restores_waiting_approval',resumeApproval.status===200&&resumeApproval.body.agent.current_status==='waiting_approval',resumeApproval);
  const approved=await req(`/approvals/${credit.id}/approve`,{teamId:s.teams[0].id});
  const creditsAfter=await q('select amount_usd from account_credits where workspace_id=$1',[s.workspaceId]);
  check('approved_350_credit_applied_exactly_once',approved.status===200&&creditsAfter.filter(r=>Number(r.amount_usd)===350).length===1,creditsAfter);
  check('duplicate_approval_conflicts',(await req(`/approvals/${credit.id}/approve`,{teamId:s.teams[0].id})).status===409);
  const rejected=await req(`/approvals/${discount.id}/reject`,{teamId:s.teams[1].id});
  const lead=(await q('select stage,requested_discount_pct from crm_leads where id=$1',[s.discountLeadId]))[0];
  check('reject_keeps_discount_unchanged',rejected.status===200&&lead.stage==='new'&&Number(lead.requested_discount_pct)===18,lead);
  const usage=await req(`/usage?workspace_id=${s.workspaceId}`);
  check('task_usage_reconciles_tokens_and_cost',usage.body.by_task.length===3&&usage.body.by_task.reduce((n,r)=>n+Number(r.input_tokens)+Number(r.output_tokens),0)===Number(usage.body.total_tokens)&&Math.abs(usage.body.by_task.reduce((n,r)=>n+Number(r.cost_usd),0)-Number(usage.body.total_cost_usd))<0.00000001,usage.body);
  const other=await make();const scoped=await handler.fetch(new Request(`https://acceptance.test/approvals/${credit.id}/approve`,{method:'POST',headers:{'x-api-key':process.env.CONTROL_API_KEY,'content-type':'application/json'},body:JSON.stringify({workspaceId:other.workspaceId,operatorId:other.operatorId,teamId:other.teams[0].id})}));
  check('other_workspace_cannot_decide_this_approval',scoped.status===404);
  const rogue=await startSteppedRogue({workspaceId:s.workspaceId,operatorId:s.operatorId,idempotencyKey:crypto.randomUUID(),correlationId:'rogue'});report.rogueRun=rogue.runId;
  check('rogue_starts_before_drift_not_as_finished_snapshot',rogue.driftScore===0&&!rogue.autoPaused,rogue);
  await tick();await tick();
  const watch=(await q('select current_status,drift_score from agents where id=$1',[s.agents.infra]))[0];
  check('rogue_warning_is_observable_before_containment',watch.current_status==='running'&&Number(watch.drift_score)===70,watch);
  await tick();
  const contained=(await q('select current_status,drift_score from agents where id=$1',[s.agents.infra]))[0];
  const infra=(await q('select rate_limit_rps from infra_services where id=$1',[s.serviceId]))[0];
  check('rogue_auto_pauses_at_92_without_production_effect',contained.current_status==='paused'&&Number(contained.drift_score)===92&&infra.rate_limit_rps===1200,{contained,infra});
  const replay=await req(`/replay/${rogue.runId}?workspace_id=${s.workspaceId}&limit=2`);
  check('replay_last_n_steps_with_evidence',replay.body.steps.length===2&&replay.body.steps[0].step_no===2&&Array.isArray(replay.body.steps[0].evidence_json),replay.body);
  const kill=await req(`/agents/${s.agents.infra}/kill`,{teamId:s.teams[0].id});
  check('kill_invalidates_epoch_and_denies_stale_probe',kill.status===200&&kill.body.staleWorkerGuard?.blocked&&Number(kill.body.agent.control_epoch)===1,kill);
  const beforeKillSteps=await steps(s.agents.infra);await tick();
  check('killed_agent_never_advances_again',await steps(s.agents.infra)===beforeKillSteps&&(await req(`/agents/${s.agents.infra}/resume`,{teamId:s.teams[0].id})).status===409);
  let lateEffect=false,error;
  const run=(await q('select * from agent_runs where id=$1',[rogue.runId]))[0];
  try{await withTx(c=>executeTool(c,{workspaceId:s.workspaceId,teamId:s.teams[0].id,agentId:s.agents.infra,taskId:run.task_id,runId:run.id,controlEpoch:0n,correlationId:'late'},{id:'late_'+randomBytes(12).toString('hex'),stepNo:99,toolName:'infra.read_metrics',riskScore:8,apply:async()=>{lateEffect=true;}}));}catch(e){error={code:e.code,message:e.message};}
  check('post_kill_callback_is_not_executed',!lateEffect&&error?.code==='55000',error);
  const again=await make();const repeat=await startSteppedDemo({workspaceId:again.workspaceId,operatorId:again.operatorId,idempotencyKey:'repeat',correlationId:'repeat'});
  check('new_session_after_kill_has_three_fresh_runs',repeat.runs.length===3&&!repeat.idempotent&&again.workspaceId!==s.workspaceId,repeat);
  await q("update agent_runs set updated_at=clock_timestamp()-interval '6 seconds' where workspace_id=$1",[again.workspaceId]);
  const overlap=await Promise.all([advanceWorkspace(again.workspaceId),advanceWorkspace(again.workspaceId)]);
  const duplicate=(await q('select run_id,count(*)::int as n from reasoning_steps where workspace_id=$1 group by run_id',[again.workspaceId]));
  check('concurrent_viewers_do_not_duplicate_steps',duplicate.length===3&&duplicate.every(r=>r.n===1),{overlap,steps:duplicate});
  const ordered=await q('select sequence from agent_events where workspace_id=$1 order by sequence',[s.workspaceId]);
  check('persisted_stream_sequence_is_contiguous',ordered.every((r,i)=>i===0||BigInt(r.sequence)===BigInt(ordered[i-1].sequence)+1n),{count:ordered.length});
  const audit=await req(`/audit/export?workspace_id=${s.workspaceId}&format=json`);
  check('audit_contains_approve_reject_pause_and_kill',audit.status===200&&['approval.approve','approval.reject','agent.pause','agent.kill'].every(a=>audit.body.audit.some(r=>r.action===a)));
  check('invalid_replay_limit_is_handled',(await req(`/replay/${rogue.runId}?workspace_id=${s.workspaceId}&limit=invalid`)).status===200);
  report.passed=true;report.completedAt=new Date().toISOString();return report;
}
if(process.env.ACT_LOCAL_MODE==='1'&&process.argv[1]===new URL(import.meta.url).pathname){
  process.env.CONTROL_API_KEY='local-acceptance-only-key';
  try{console.log(JSON.stringify(await runSteppedAcceptance(),null,2));}finally{await pool.end();}
}
