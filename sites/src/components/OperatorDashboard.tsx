"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, command, type Approval, type DemoSession, type FleetAgent, type ReplayStep, type UsageSummary } from "@/lib/api";

type StreamEvent = {event_id?:string|number;sequence?:string|number;event_type?:string;agent_id?:string;task_id?:string;occurred_at?:string;payload_json?:Record<string,unknown>};
const emptyUsage:UsageSummary={total_tokens:0,total_cost_usd:0,by_task:[]};
const money=(value:unknown)=>`$${Number(value??0).toFixed(4)}`;
const tokenCount=(a:unknown,b:unknown)=>Number(a??0)+Number(b??0);

export function OperatorDashboard(){
  const [session,setSession]=useState<DemoSession|null>(null);
  const boot=useRef<Promise<DemoSession>|null>(null);
  const [teamId,setTeamId]=useState("");
  const [agents,setAgents]=useState<FleetAgent[]>([]);
  const [approvals,setApprovals]=useState<Approval[]>([]);
  const [usage,setUsage]=useState<UsageSummary>(emptyUsage);
  const [events,setEvents]=useState<StreamEvent[]>([]);
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [selected,setSelected]=useState<FleetAgent|null>(null);
  const [steps,setSteps]=useState<ReplayStep[]>([]);
  const [replayLimit,setReplayLimit]=useState(20);
  const current=useRef("");current.current=`${session?.workspaceId}|${teamId}`;

  useEffect(()=>{
    let cancelled=false;
    boot.current??=api.session();
    void boot.current.then(data=>{if(!cancelled)setSession(data);}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[]);

  const refresh=useCallback(async()=>{
    if(!session)return;
    const scopeKey=`${session.workspaceId}|${teamId}`;
    try{
      const [fleet,queue,totals]=await Promise.all([api.fleet(session.workspaceId,teamId||undefined),api.approvals(session.workspaceId,teamId||undefined),api.usage(session.workspaceId,teamId||undefined)]);
      if(current.current!==scopeKey)return;
      setAgents(fleet.agents??[]);setApprovals((queue.approvals??[]).filter(a=>a.status==='pending'));setUsage(totals);
    }catch(e){if(current.current===scopeKey)setError(e instanceof Error?e.message:'Unable to load the control plane.');}
  },[session,teamId]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[refresh]);

  useEffect(()=>{
    if(!session)return;
    let cancelled=false;let source:EventSource|null=null;
    let retry:ReturnType<typeof setTimeout>|null=null;let rotation:ReturnType<typeof setTimeout>|null=null;let refreshTimer:ReturnType<typeof setTimeout>|null=null;
    let cursor=0;setEvents([]);setConnected(false);
    const connect=async()=>{
      try{
        const issued=await api.eventsToken(session.workspaceId,teamId||undefined,cursor);
        if(cancelled)return;
        source?.close();source=new EventSource(issued.url);
        source.onopen=()=>{if(!cancelled)setConnected(true);};
        source.onerror=()=>{
          if(cancelled)return;setConnected(false);source?.close();
          if(rotation)clearTimeout(rotation);retry=setTimeout(()=>void connect(),1500);
        };
        source.onmessage=event=>{
          if(cancelled)return;
          try{
            const next=JSON.parse(event.data) as StreamEvent;const seq=Number(next.sequence??0);
            if(seq<=cursor)return;cursor=seq;
            setEvents(previous=>[next,...previous].slice(0,80));
            if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),200);
          }catch{/* Heartbeat frames have no JSON payload. */}
        };
        rotation=setTimeout(()=>{source?.close();void connect();},Math.max(1000,issued.expires_at*1000-Date.now()-15000));
      }catch(e){if(!cancelled){setConnected(false);setError(e instanceof Error?e.message:'Stream unavailable.');retry=setTimeout(()=>void connect(),1500);}}
    };
    void connect();
    return()=>{cancelled=true;source?.close();if(retry)clearTimeout(retry);if(rotation)clearTimeout(rotation);if(refreshTimer)clearTimeout(refreshTimer);};
  },[session,teamId,refresh]);

  const runCommand=async(path:string,body:Record<string,unknown>,label:string)=>{
    if(!session||busy)return;
    setBusy(path);setError(null);setNotice(null);
    try{
      const result=await command(path,{workspaceId:session.workspaceId,operatorId:session.operatorId,...body});
      await refresh();setNotice(result.idempotent===true?'This session already has runs. Use New session to repeat the demo.':label);
    }catch(e){setError(e instanceof Error?e.message:'Command failed.');}
    finally{setBusy(null);}
  };
  const newSession=async()=>{
    if(busy)return;setBusy('session');setError(null);
    try{
      const next=await api.session(true);setSession(next);setTeamId('');setAgents([]);setApprovals([]);setUsage(emptyUsage);setSelected(null);setSteps([]);
      setNotice('Fresh session ready. Start all agents to watch their tasks.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to create a new session.');}finally{setBusy(null);}
  };
  const openReplay=useCallback(async(agent:FleetAgent,limit:number)=>{
    setSelected(agent);
    if(!session||!agent.current_run_id){setSteps([]);return;}
    try{const replay=await api.replay(session.workspaceId,agent.id,agent.team_id,limit);setSteps(replay.steps??[]);}
    catch(e){setError(e instanceof Error?e.message:'Replay unavailable.');}
  },[session]);
  const names=useMemo(()=>new Map(agents.map(a=>[a.id,a.name])),[agents]);
  const infra=agents.find(a=>a.agent_type==='infra_ops');
  const fresh=agents.length>0&&agents.every(a=>a.current_status==='idle'&&!a.current_run_id);
  const rogueReady=infra&&['idle','completed','failed'].includes(infra.current_status);

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">OPERATIONS</p><h1>Agent Control Tower</h1></div>
      <div className="toolbar">
        <button className="primary" disabled={!session||!!busy||!fresh} onClick={()=>void runCommand('/scenarios/start-all',{},'Agents started. Steps advance every 5 seconds while this tower is connected. Pause an agent or review its approval.')}>Start all agents</button>
        <button className="rogue" disabled={!session||!!busy||!rogueReady} onClick={()=>void runCommand('/scenarios/rogue-infra',{},'Rogue Infra started. Watch drift rise; unsafe actions will be blocked and the agent paused.')}>Run Rogue Infra</button>
        <button disabled={!!busy} onClick={()=>void newSession()}>New session</button>
        <select value={teamId} onChange={e=>setTeamId(e.target.value)} aria-label="Team scope"><option value="">All teams</option>{session?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {session&&<><a className="buttonLink" href={api.auditUrl(session.workspaceId,'csv',teamId||undefined)}>Export CSV</a><a className="buttonLink" href={api.auditUrl(session.workspaceId,'json',teamId||undefined)}>Export JSON</a></>}
        <span role="status" className={connected?'pill ok':'pill warn'}>{connected?'Live':'Connecting'}</span>
      </div>
    </header>
    <p className="guide">Start three agents, pause one while it works, then resume and review its risky action. Run Rogue Infra after its normal task finishes, inspect Replay, and Kill to contain it. New session gives you fresh agents.</p>
    <p className="simulationLabel">CRM, Support, Infrastructure, reasoning summaries and usage are simulated. Controls, event history and audit records are persisted.</p>
    <section className="metrics">
      <Metric label="Active agents" value={String(agents.filter(a=>['running','waiting_approval','paused'].includes(a.current_status)).length)}/>
      <Metric label="Pending approvals" value={String(approvals.length)}/>
      <Metric label="Critical drift" value={String(agents.filter(a=>Number(a.drift_score)>=85&&["running","paused","waiting_approval","blocked"].includes(a.current_status)).length)}/>
      <Metric label="Simulated tokens" value={Number(usage.total_tokens).toLocaleString()}/>
      <Metric label="Simulated cost" value={money(usage.total_cost_usd)}/>
    </section>
    {notice&&<div role="status" className="notice">{notice}</div>}{error&&<div role="alert" className="error">{error}</div>}
    <section className="grid">
      <div className="panel span2"><div className="panelHead"><h2>Fleet</h2><button disabled={!!busy} onClick={()=>void refresh()}>Refresh</button></div>
        <div className="fleet">{agents.map(agent=>{
          const active=['running','waiting_approval','paused','blocked','queued'].includes(agent.current_status);
          return <article className="agent" key={agent.id} aria-label={agent.name}>
            <div className="agentIdentity"><strong>{agent.name}</strong><span>{session?.teams.find(t=>t.id===agent.team_id)?.name}</span></div>
            <span className={`status status-${agent.current_status}`}>{agent.current_status.replaceAll('_',' ')}</span>
            <div><small>Task</small><p>{agent.current_task??'Ready to start'}</p>{agent.blocker&&<p className="blocker">{agent.blocker}</p>}</div>
            <div><small>Last action</small><p>{agent.last_action??'No actions yet'}</p></div>
            <div><small>Drift</small><p>{Number(agent.drift_score).toFixed(0)} / 100</p></div>
            <div><small>Simulated usage</small><p>{tokenCount(agent.input_tokens,agent.output_tokens).toLocaleString()} tokens</p><p>{money(agent.cost_usd)}</p></div>
            <div className="agentActions"><button disabled={!agent.current_run_id} onClick={()=>void openReplay(agent,replayLimit)}>Replay</button>
              {agent.current_status==='paused'?<button disabled={!!busy} onClick={()=>void runCommand(`/agents/${agent.id}/resume`,{teamId:agent.team_id},`${agent.name} resumed.`)}>Resume</button>:<button disabled={!!busy||!active} onClick={()=>void runCommand(`/agents/${agent.id}/pause`,{teamId:agent.team_id},`${agent.name} paused. New steps are stopped.`)}>Pause</button>}
              <button className="danger" disabled={!!busy||!active} onClick={()=>void runCommand(`/agents/${agent.id}/kill`,{teamId:agent.team_id},`${agent.name} killed. This agent cannot resume; use New session to repeat.`)}>Kill</button>
            </div>
          </article>;
        })}{!agents.length&&<Empty text={session?'Loading fleet…':'Preparing your independent demo session…'}/>}</div>
      </div>
      <div className="panel"><div className="panelHead"><h2>Approval queue</h2><span>{approvals.length}</span></div><div className="stack">
        {approvals.map(approval=>{
          const agent=agents.find(a=>a.id===approval.agent_id);const paused=agent?.current_status==='paused';
          return <article className="approval" key={approval.id}><div className="row"><strong>{approval.action_type}</strong><span className="risk">Risk {approval.risk_score}</span></div>
            <p>{approval.reason}</p><small>{names.get(approval.agent_id)}</small>
            <p className="impact">{approval.action_type==='billing.issue_credit'?`Issue $${approval.action_payload.amount_usd} credit`:`Apply ${approval.action_payload.discount_pct}% discount`}</p>
            <details><summary>Action and impact</summary><pre>{JSON.stringify({action:approval.action_payload,impact:approval.estimated_impact_json},null,2)}</pre></details>
            {paused&&<p className="blocker">Resume this agent before deciding.</p>}
            <div className="actions"><button disabled={!!busy||paused} onClick={()=>void runCommand(`/approvals/${approval.id}/approve`,{teamId:approval.team_id},'Approved. The exact reviewed action executed once.')}>Approve</button><button className="danger" disabled={!!busy||paused} onClick={()=>void runCommand(`/approvals/${approval.id}/reject`,{teamId:approval.team_id},'Rejected. The proposed action was cancelled without applying it.')}>Reject</button></div>
          </article>;
        })}{!approvals.length&&<Empty text="No decisions waiting. Running agents will request approval for risky actions."/>}
      </div></div>
      <div className="panel span3"><div className="panelHead"><h2>Usage by agent and task</h2><span>Simulated</span></div><div className="tableScroll"><table><thead><tr><th>Agent</th><th>Task</th><th>Status</th><th>Input tokens</th><th>Output tokens</th><th>Cached tokens</th><th>Cost</th></tr></thead><tbody>{usage.by_task.map(row=><tr key={row.task_id}><td>{row.agent_name}</td><td>{row.task_title}</td><td>{row.task_status.replaceAll('_',' ')}</td><td>{Number(row.input_tokens).toLocaleString()}</td><td>{Number(row.output_tokens).toLocaleString()}</td><td>{Number(row.cached_tokens).toLocaleString()}</td><td>{money(row.cost_usd)}</td></tr>)}</tbody></table></div></div>
      <div className="panel span3"><div className="panelHead"><h2>Live event stream</h2><span>{events.length} shown</span></div><div className="events">{events.map((event,i)=><div className="event" key={`${event.sequence}-${i}`}><time>{event.occurred_at?new Date(event.occurred_at).toLocaleTimeString():'—'}</time><b>{event.event_type}</b><span>{event.agent_id?names.get(event.agent_id)??event.agent_id:'System'}</span><span>{event.task_id?.startsWith('rogue')?'Rogue incident':usage.by_task.find(t=>t.task_id===event.task_id)?.task_title??''}</span></div>)}{!events.length&&<Empty text="Waiting for persisted events. Start agents to see their work."/>}</div></div>
      <div className="panel span3"><div className="panelHead"><h2>Reasoning replay</h2><div className="actions"><span>{selected?.name??'Select an agent'}</span><select aria-label="Replay step count" value={replayLimit} onChange={e=>{const n=Number(e.target.value);setReplayLimit(n);if(selected)void openReplay(selected,n);}}>{[5,10,20,50,100].map(n=><option key={n} value={n}>Last {n} steps</option>)}</select>{selected&&<button onClick={()=>void openReplay(selected,replayLimit)}>Refresh replay</button>}</div></div>
        <div className="replay">{steps.map(step=><article className="replayStep" key={String(step.id)}><div className="stepNo">{step.step_no}</div><div><div className="row"><strong>{step.decision_summary}</strong><span className="policy">{step.policy_result}</span></div><p><b>Task:</b> {usage.by_task.find(t=>t.task_id===step.task_id)?.task_title??"Task"}</p><p><b>Observation:</b> {step.observation}</p><p><b>Action:</b> {step.intended_action??'None'} · {step.action_result??'No result'}</p><small>{tokenCount(step.input_tokens,step.output_tokens).toLocaleString()} tokens · {money(step.cost_usd)} · {new Date(step.created_at).toLocaleTimeString()}</small><details><summary>Evidence</summary><pre>{JSON.stringify(step.evidence_json??[],null,2)}</pre></details></div></article>)}{!steps.length&&<Empty text={selected?'No steps recorded yet.':'Replay exposes structured operational summaries, evidence and decisions.'}/>}</div>
      </div>
    </section>
  </main>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;}
function Empty({text}:{text:string}){return <p className="empty">{text}</p>;}
