import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoScope} from '../functions/shared/demo-scope.mjs';
import {sealSession,openSession} from '../functions/shared/session-cookie.mjs';
import {assertDemoRequest,signSitesWorkload,requireSitesWorkload} from '../functions/shared/sites-workload.mjs';
const workspace='ws_demo_'+'a'.repeat(32),other='ws_demo_'+'b'.repeat(32);
const secret='test-session-secret-not-used-in-production-with-43-characters';
test('sessions have independent identities for all agent, team and task scopes',()=>{
  const a=demoScope(workspace),b=demoScope(other);
  assert.equal(new Set([...a.taskIds,...b.taskIds,...Object.values(a.agents),...Object.values(b.agents)]).size,12);
  assert.throws(()=>demoScope('arbitrary_workspace'),/forbidden/);
});
test('signed visitor session resists tampering, expiry and key replacement',async()=>{
  const token=await sealSession(workspace,secret,1000);
  assert.equal((await openSession(token,secret,1001)).workspaceId,workspace);
  assert.equal(await openSession(token,secret,87400),null);
  assert.equal(await openSession(token+'x',secret,1001),null);
  assert.equal(await openSession(token,secret+'x',1001),null);
});
test('dynamic workspace workload is bound to its own session',async()=>{
  const request=new Request(`https://neon.test/fleet?workspace_id=${workspace}`);
  const opts={secret,siteId:'test_site',audience:'control',workspaceId:workspace,now:1000};
  const token=await signSitesWorkload(request,opts);
  const signed=new Request(request,{headers:{authorization:`Bearer ${token}`}});
  await requireSitesWorkload(signed,opts);
  await assertDemoRequest(signed,'control',workspace);
  await assert.rejects(requireSitesWorkload(signed,{...opts,workspaceId:other}),/unauthorized/);
  await assert.rejects(assertDemoRequest(signed,'control',other),/forbidden/);
});
test('session routes reject cross-team, cross-agent and conflicting identity aliases',async()=>{
  const a=demoScope(workspace),b=demoScope(other);
  const req=(path,body)=>new Request('https://neon.test/'+path,{method:'POST',body:JSON.stringify(body)});
  await assertDemoRequest(req('sessions',{workspaceId:workspace}),'control',workspace);
  await assertDemoRequest(req(`agents/${a.agents.support}/pause`,{workspaceId:workspace,operatorId:a.operatorId,teamId:a.teams[0].id}),'control',workspace);
  for(const [path,body] of [[`agents/${b.agents.support}/kill`,{workspaceId:workspace}],[`agents/${a.agents.support}/kill`,{workspaceId:workspace,teamId:b.teams[0].id}],[`agents/${a.agents.support}/kill`,{workspaceId:workspace,workspace_id:other}]])await assert.rejects(assertDemoRequest(req(path,body),'control',workspace),/forbidden/);
});
