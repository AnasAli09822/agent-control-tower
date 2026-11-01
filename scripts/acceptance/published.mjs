import assert from 'node:assert/strict';
const base=process.env.ACT_DEMO_URL;
if(!base)throw new Error('Set ACT_DEMO_URL explicitly to the authorized demo origin. This test creates a fresh simulated workspace.');
const jar=new Map(), checks=[], events=[];
let session, reader, streamAbort, consumption, streamDeadline;
const check=(name,evidence)=>checks.push({name,passed:true,...(evidence?{evidence}:{})});
async function api(path,body,expected=200){
  const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),origin:base,'content-type':'application/json','idempotency-key':crypto.randomUUID()},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  for(const set of r.headers.getSetCookie()){const pair=set.split(';')[0], i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
  const data=r.headers.get('content-type')?.includes('json')?await r.json():await r.text();
  assert.equal(r.status,expected,JSON.stringify({path,status:r.status,error:data.error}));return data;
}
const ws=()=>encodeURIComponent(session.workspaceId);
const command=(path,extra={},expected=200)=>api('/api/control'+path,{workspaceId:session.workspaceId,operatorId:session.operatorId,...extra},expected);
const fleet=()=>api('/api/control/fleet?workspace_id='+ws());
const approvals=async()=>{const data=await api('/api/control/approvals?workspace_id='+ws());return {history:data.approvals,approvals:data.approvals.filter(a=>a.status==='pending')};};
async function waitFor(fn,timeout=45000){const start=Date.now();while(Date.now()-start<timeout){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,700));}throw new Error('Expected state not reached');}
async function consume(){let buffer='';for(;;){const {value,done}=await reader.read();if(done)return;buffer+=new TextDecoder().decode(value);let cut;while((cut=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const data=frame.split('\n').find(l=>l.startsWith('data: '));if(data)events.push(JSON.parse(data.slice(6)));}}}
try{
 session=await api('/api/session',{});const original=session.workspaceId;
 const agents=(await fleet()).agents;assert.equal(agents.length,3);assert.ok(agents.every(a=>a.current_status==='idle'&&Number(a.input_tokens)===0));check('fresh_three_idle_agents',{workspace:original});
 await command('/scenarios/start-all');const token=await api('/api/events-token?workspace_id='+ws());streamAbort=new AbortController();streamDeadline=setTimeout(()=>streamAbort.abort(),120000);const stream=await fetch(token.url,{signal:streamAbort.signal});assert.equal(stream.status,200);reader=stream.body.getReader();consumption=consume().catch(e=>{if(!streamAbort.signal.aborted)throw e;});
 await command('/agents/'+session.agents.support+'/pause',{teamId:session.teams[0].id});const before=(await fleet()).agents.find(a=>a.id===session.agents.support);assert.equal(before.current_status,'paused');
 await new Promise(r=>setTimeout(r,6200));const frozen=(await fleet()).agents.find(a=>a.id===session.agents.support);assert.equal(frozen.current_status,'paused');assert.equal(frozen.input_tokens,before.input_tokens);check('pause_in_flight_freezes_usage');
 await command('/agents/'+session.agents.support+'/resume',{teamId:session.teams[0].id});check('resume_in_flight');
 const pending=await waitFor(async()=>{const a=(await approvals()).approvals;return a.length===2&&a;});const credit=pending.find(a=>a.action_type==='billing.issue_credit'),discount=pending.find(a=>a.action_type==='crm.propose_discount');assert.equal(Number(credit.action_payload.amount_usd),350);assert.equal(Number(discount.action_payload.discount_pct),15);check('exact_approval_payloads',{credit:credit.action_payload,discount:discount.action_payload});
 await command('/agents/'+session.agents.support+'/pause',{teamId:credit.team_id});await command('/approvals/'+credit.id+'/approve',{teamId:credit.team_id},409);check('paused_approval_rejected');
 await command('/agents/'+session.agents.support+'/resume',{teamId:credit.team_id});assert.equal((await fleet()).agents.find(a=>a.id===session.agents.support).current_status,'waiting_approval');check('resume_restores_pending_approval');
 await command('/approvals/'+credit.id+'/approve',{teamId:credit.team_id});await command('/approvals/'+discount.id+'/reject',{teamId:discount.team_id});const decided=await approvals();assert.equal(decided.approvals.length,0);assert.equal(decided.history.find(a=>a.id===credit.id).status,'approved');assert.equal(decided.history.find(a=>a.id===discount.id).status,'rejected');check('approve_credit_reject_discount_clears_queue');
 await command('/scenarios/rogue-infra');const rogue=await waitFor(async()=>{const a=(await fleet()).agents.find(a=>a.id===session.agents.infra);return a.current_status==='paused'&&Number(a.drift_score)===92&&a;});check('rogue_auto_paused_92',{agent:rogue.id,drift:rogue.drift_score});
 const replay=await api('/api/control/replay/'+session.agents.infra+'?workspace_id='+ws()+'&limit=5');assert.equal(replay.steps.length,5);assert.equal(replay.steps.filter(s=>s.policy_result==='block').length,2);check('last_five_history_contains_two_blocked_actions',{steps:replay.steps.map(s=>({step:s.step_no,task:s.task_id,policy:s.policy_result}))});
 await command('/agents/'+session.agents.infra+'/kill',{teamId:session.teams[0].id});await new Promise(r=>setTimeout(r,6200));const killed=(await fleet()).agents.find(a=>a.id===session.agents.infra);assert.equal(killed.current_status,'killed');assert.equal(Number(killed.control_epoch),1);check('terminal_kill_epoch_fence',{epoch:killed.control_epoch});
 for(const [team,count] of [[session.teams[0],2],[session.teams[1],1]])assert.equal((await api('/api/control/fleet?workspace_id='+ws()+'&team_id='+team.id)).agents.length,count);check('team_filters_two_and_one');
 const usage=await api('/api/control/usage?workspace_id='+ws());assert.equal(usage.by_task.length,4);assert.ok(Math.abs(usage.by_task.reduce((s,t)=>s+Number(t.cost_usd),0)-Number(usage.total_cost_usd))<1e-8);check('per_task_cost_reconciles',{tasks:usage.by_task.length,tokens:usage.total_tokens,cost:usage.total_cost_usd});
 const json=await api('/api/control/audit/export?workspace_id='+ws()+'&format=json'),csv=await api('/api/control/audit/export?workspace_id='+ws()+'&format=csv');assert.ok(JSON.stringify(json).includes('kill'));assert.ok(csv.includes('kill')&&csv.includes('pause'));check('audit_json_csv_contains_interventions');
 session=await api('/api/session',{});assert.notEqual(session.workspaceId,original);assert.ok((await fleet()).agents.every(a=>a.current_status==='idle'));await api('/api/control/fleet?workspace_id='+encodeURIComponent(original),undefined,403);const refresh=await api('/api/session');assert.equal(refresh.workspaceId,session.workspaceId);check('new_session_fresh_isolated_persistent',{workspace:session.workspaceId});
 console.log(JSON.stringify({passed:true,completedAt:new Date().toISOString(),base,workspace:original,checks,streamedEvents:events.length},null,2));
}catch(error){console.log(JSON.stringify({passed:false,completedAt:new Date().toISOString(),base,checks,error:error.message},null,2));process.exitCode=1;}finally{clearTimeout(streamDeadline);streamAbort?.abort();await reader?.cancel().catch(()=>{});await consumption;}
