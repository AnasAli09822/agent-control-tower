import { pool, withTx, appendAudit, appendEvent } from "./db.mjs";
import { demoScope } from "./demo-scope.mjs";
import { startRun, recordStep, executeTool, completeRun } from "./scenario-runtime.mjs";
import { advanceNormalStep } from "./scenario-normal.mjs";
import { startRogueScenario, recordBlockedProposal } from "./scenario-rogue.mjs";

export const STEP_INTERVAL_SECONDS = 5;

export async function startSteppedDemo({workspaceId,operatorId,idempotencyKey,correlationId}) {
  const scope=demoScope(workspaceId);
  return withTx(async c=>{
    const started=[];
    // One lock order for starts, workers and operator interventions.
    await c.query("select id from agents where workspace_id=$1 order by id for update",[workspaceId]);
    for(const taskId of scope.taskIds) started.push(await startRun(c,{workspaceId,taskId,correlationId}));
    const idempotent=started.every(x=>x.alreadyStarted);
    await appendAudit(c,{workspaceId,actorType:'operator',actorId:operatorId,action:'scenario.start_all',targetType:'workspace',targetId:workspaceId,decision:'start',result:idempotent?'idempotent':'recorded',correlationId,payload:{runs:started.map(x=>x.run.id),step_interval_seconds:STEP_INTERVAL_SECONDS}});
    return {runs:started.map(x=>x.run.id),idempotent,step_interval_seconds:STEP_INTERVAL_SECONDS};
  });
}

export async function startSteppedRogue(args) {
  const scope=demoScope(args.workspaceId);
  return withTx(c=>startRogueScenario(c,{...args,agentId:scope.agents.infra,serviceId:scope.serviceId,deferred:true}));
}

async function advanceRogueStep(c,ctx,serviceId,index) {
  if(index===0){
    const step=await recordStep(c,ctx,{goal:'Restore API health within authority',observation:'Metrics are stale; production health is uncertain.',evidence:[{source:'infra_metrics',service_id:serviceId,stale:true}],decisionSummary:'Read metrics before acting.',intendedAction:'infra.read_metrics',actionResult:'succeeded',confidence:0.72});
    await executeTool(c,ctx,{stepNo:step.step_no,reasoningStepId:step.id,toolName:'infra.read_metrics',riskScore:8,result:{service_id:serviceId,stale:true}});
  }else if(index===1 || index===2){
    const critical=index===2;
    await recordBlockedProposal(c,ctx,{goal:'Reduce incident impact',observation:critical?'The worker repeats an unsafe proposal without fresh evidence.':'The worker proposes a production change using stale evidence.',evidence:[{source:'retry_counter',retries:critical?4:3},{source:'infra_metrics',stale:true}],decisionSummary:critical?'Block rollback and contain critical drift.':'Block the unsupported rate-limit change.',toolName:critical?'infra.rollback_release':'infra.change_rate_limit',payload:critical?{service_id:serviceId,release:'previous'}:{service_id:serviceId,rate_limit_rps:300},riskScore:critical?96:90,reason:'stale_evidence_retry_loop'});
    const drift=critical?92:70;
    await c.query("update agents set drift_score=$1,updated_at=now() where id=$2",[drift,ctx.agentId]);
    await appendEvent(c,{...ctx,eventType:critical?'agent.drift_critical':'agent.drift_warning',severity:critical?'critical':'warning',correlationId:ctx.correlationId,payload:{drift_score:drift}});
    if(critical){
      await c.query("update agent_runs set status='paused',version=version+1,updated_at=now() where id=$1",[ctx.runId]);
      await c.query("update tasks set status='paused',version=version+1 where id=$1",[ctx.taskId]);
      await c.query("update agents set current_status='paused',version=version+1 where id=$1",[ctx.agentId]);
      await appendEvent(c,{...ctx,eventType:'agent.paused',severity:'critical',correlationId:ctx.correlationId,payload:{reason:'critical_drift_auto_pause',drift_score:92}});
      await appendAudit(c,{workspaceId:ctx.workspaceId,teamId:ctx.teamId,actorType:'control_plane',actorId:'drift_monitor',agentId:ctx.agentId,runId:ctx.runId,taskId:ctx.taskId,action:'agent.auto_pause',decision:'pause',riskScore:92,result:'recorded',correlationId:ctx.correlationId});
    }
  }else{
    await recordStep(c,ctx,{goal:'Hand off the contained incident',observation:'Operator resumed a contained run. Unsafe proposals remain blocked.',evidence:[{source:'operator_intervention',result:'resume'}],decisionSummary:'End autonomous remediation and hand off safely.',policyResult:'block',actionResult:'human_handoff',inputTokens:0,outputTokens:0,costUsd:0});
    await completeRun(c,ctx,'contained_incident_human_handoff');
  }
}

// A persisted simulation advances while an operator's signed SSE connection is
// open. Multiple viewers are safe: each step is serialized by agent/run locks.
// No browser owns the simulation state or executes a tool mutation.
export async function advanceWorkspace(workspaceId) {
  if(!/^ws_demo_[a-f0-9]{32}$/.test(workspaceId)) return [];
  const {rows}=await pool.query("select id from agents where workspace_id=$1 and current_status='running' order by id",[workspaceId]);
  const progressed=[];
  for(const candidate of rows){
    const result=await withTx(async c=>{
      const locked=await c.query("select * from agents where workspace_id=$1 and id=$2 for update skip locked",[workspaceId,candidate.id]);
      const agent=locked.rows[0];
      if(!agent || agent.current_status!=='running') return null;
      const active=await c.query("select r.*,t.task_type,t.input_json from agent_runs r join tasks t on t.id=r.task_id where r.workspace_id=$1 and r.agent_id=$2 and r.status='running' and r.updated_at <= clock_timestamp()-interval '5 seconds' order by r.created_at desc limit 1 for update of r",[workspaceId,agent.id]);
      const run=active.rows[0]; if(!run || BigInt(run.control_epoch)!==BigInt(agent.control_epoch)) return null;
      const count=await c.query("select count(*)::int as n from reasoning_steps where run_id=$1",[run.id]);
      const index=count.rows[0].n;
      const ctx={workspaceId,teamId:agent.team_id,agentId:agent.id,runId:run.id,taskId:run.task_id,controlEpoch:BigInt(agent.control_epoch),correlationId:`step:${run.id}:${index+1}`};
      if(run.task_type==='rogue_infra') await advanceRogueStep(c,ctx,run.input_json.service_id,index);
      else await advanceNormalStep(c,{ctx,task:{task_type:run.task_type,input_json:run.input_json}},index);
      await c.query("update agent_runs set updated_at=clock_timestamp(),version=version+1 where id=$1",[run.id]);
      await c.query("update agents set last_heartbeat_at=clock_timestamp() where id=$1",[agent.id]);
      return {agentId:agent.id,runId:run.id,step:index+1};
    });
    if(result) progressed.push(result);
  }
  return progressed;
}
