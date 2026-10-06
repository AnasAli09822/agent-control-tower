import assert from 'node:assert/strict';
const base='http://localhost:5173';
let cookie='';
async function request(path,body){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:base,'content-type':'application/json','idempotency-key':crypto.randomUUID()},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  return {status:response.status,body:await response.json()};
}
const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Agent Control Tower/);
const session=await request('/api/session');assert.equal(session.status,200);const s=session.body;
const scope=encodeURIComponent(s.workspaceId);
const fleet=()=>request(`/api/control/fleet?workspace_id=${scope}`);
assert.equal((await fleet()).body.agents.length,3);
assert.equal((await request('/api/control/scenarios/start-all',{workspaceId:s.workspaceId,operatorId:s.operatorId})).status,200);
const token=await request(`/api/events-token?workspace_id=${scope}`);assert.equal(token.status,200);
const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),35000);
const stream=await fetch(token.body.url,{signal:abort.signal});assert.equal(stream.status,200);
const reader=stream.body.getReader();let buffer='';const events=[];
async function until(predicate){
  while(!predicate()){
    const value=await reader.read();if(value.done)throw new Error('SSE ended before expected checkpoint.');
    buffer+=new TextDecoder().decode(value.value);
    let cut;while((cut=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const data=frame.split('\n').find(line=>line.startsWith('data: '));if(data)events.push(JSON.parse(data.slice(6)));}
  }
}
try{
  await until(()=>new Set(events.filter(e=>e.event_type==='reasoning.step').map(e=>e.agent_id)).size===3);
  const pause=await request(`/api/control/agents/${s.agents.support}/pause`,{workspaceId:s.workspaceId,operatorId:s.operatorId,teamId:s.teams[0].id});assert.equal(pause.status,200);
  await until(()=>events.some(e=>e.event_type==='reasoning.step'&&e.agent_id===s.agents.sales&&e.payload_json.step_no>=2));
  const paused=(await fleet()).body.agents.find(a=>a.id===s.agents.support);assert.equal(paused.current_status,'paused');
  const usage=await request(`/api/control/usage?workspace_id=${scope}`);assert.equal(usage.body.by_task.length,3);
  const resume=await request(`/api/control/agents/${s.agents.support}/resume`,{workspaceId:s.workspaceId,operatorId:s.operatorId,teamId:s.teams[0].id});assert.equal(resume.status,200);
  await until(()=>events.some(e=>e.event_type==='reasoning.step'&&e.agent_id===s.agents.support&&e.payload_json.step_no>=2));
  const newSession=await request('/api/session',{});assert.equal(newSession.status,200);assert.notEqual(newSession.body.workspaceId,s.workspaceId);
  const cross=await request(`/api/control/fleet?workspace_id=${scope}`);assert.equal(cross.status,403);
  console.log(JSON.stringify({passed:true,checks:['frontend_http','fresh_cookie_session','signed_proxy_start','real_sse_three_agents','pause_in_flight','resume_progress','per_task_usage','new_session','cross_session_denied'],events:events.length}));
}finally{clearTimeout(timeout);abort.abort();await reader.cancel().catch(()=>{});}
