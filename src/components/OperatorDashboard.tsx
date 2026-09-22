"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, command, type Approval, type FleetAgent, type ReplayStep } from "@/lib/api";

type StreamEvent = {
  event_id?: number;
  sequence?: number;
  event_type?: string;
  severity?: string;
  agent_id?: string;
  task_id?: string;
  occurred_at?: string;
};

type UsageSummary = { total_cost_usd: number | string; total_tokens: number | string };

const workspaceId = "ws_demo";
const operatorId = "operator_demo";

export function OperatorDashboard() {
  const [teamId, setTeamId] = useState("");
  const [agents, setAgents] = useState<FleetAgent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [usage, setUsage] = useState<UsageSummary>({ total_cost_usd: 0, total_tokens: 0 });
  const [replayAgent, setReplayAgent] = useState<FleetAgent | null>(null);
  const [replay, setReplay] = useState<ReplayStep[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const scope = teamId || undefined;
      const [fleet, queue, totals] = await Promise.all([
        api.fleet(workspaceId, scope),
        api.approvals(workspaceId, scope),
        api.usage(workspaceId, scope),
      ]);
      setAgents(fleet.agents ?? []);
      setApprovals((queue.approvals ?? []).filter((approval) => approval.status === "pending"));
      setUsage(totals);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load control plane");
    }
  }, [teamId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let lastSequence = 0;
    setConnected(false);

    const connect = async () => {
      try {
        const { url } = await api.eventsToken(workspaceId, teamId || undefined, lastSequence);
        if (cancelled) return;
        source?.close();
        source = new EventSource(url);
        source.onopen = () => setConnected(true);
        source.onerror = () => {
          setConnected(false);
          source?.close();
          if (!cancelled) retryTimer = setTimeout(() => void connect(), 1500);
        };
        source.onmessage = (event) => {
          try {
            const next = JSON.parse(event.data) as StreamEvent;
            const sequence = Number(next.sequence ?? 0);
            if (Number.isFinite(sequence) && sequence > lastSequence) lastSequence = sequence;
            setEvents((previous) => [next, ...previous].slice(0, 80));
            void refresh();
          } catch {
            // SSE heartbeat/non-JSON control frame.
          }
        };
      } catch (cause) {
        setConnected(false);
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Event stream unavailable");
          retryTimer = setTimeout(() => void connect(), 1500);
        }
      }
    };

    void connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [refresh, teamId]);

  const critical = useMemo(
    () => agents.filter((agent) => Number(agent.drift_score) >= 85).length,
    [agents],
  );

  const runCommand = async (path: string, body: Record<string, unknown>, label?: string) => {
    try {
      setBusy(path);
      const result = await command(path, {
        workspaceId,
        teamId: teamId || undefined,
        operatorId,
        ...body,
      });
      await refresh();
      setNotice(label ?? null);
      setError(null);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Command failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const openReplay = async (agent: FleetAgent) => {
    if (!agent.current_run_id) {
      setReplayAgent(agent);
      setReplay([]);
      return;
    }
    try {
      const result = await api.replay(workspaceId, agent.current_run_id, agent.team_id, 20);
      setReplayAgent(agent);
      setReplay(result.steps ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Replay unavailable");
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">OPERATIONS</p><h1>Agent Control Tower</h1></div>
        <div className="toolbar">
          <button className="primary" disabled={Boolean(busy)} onClick={() => void runCommand("/scenarios/start-all", {}, "Three-agent run started. Review pending approvals.")}>
            {busy === "/scenarios/start-all" ? "Starting…" : "Start all agents"}
          </button>
          <button className="rogue" disabled={Boolean(busy)} onClick={() => void runCommand("/scenarios/rogue-infra", {}, "Rogue Infra auto-paused at critical drift. Open Replay, then Kill.")}>
            {busy === "/scenarios/rogue-infra" ? "Inducing…" : "Run Rogue Infra"}
          </button>
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="Team scope">
            <option value="">All teams</option>
            <option value="team_operations">Operations</option>
            <option value="team_revenue">Revenue</option>
          </select>
          <a className="buttonLink" href={api.auditUrl(workspaceId, "csv", teamId || undefined)}>Export CSV</a>
          <a className="buttonLink" href={api.auditUrl(workspaceId, "json", teamId || undefined)}>Export JSON</a>
          <span className={connected ? "pill ok" : "pill warn"}>{connected ? "Live" : "Reconnecting"}</span>
        </div>
      </header>

      <section className="metrics">
        <Metric label="Active agents" value={String(agents.filter((agent) => ["running", "waiting_approval", "paused"].includes(agent.current_status)).length)} />
        <Metric label="Pending approvals" value={String(approvals.length)} />
        <Metric label="Critical drift" value={String(critical)} />
        <Metric label="Tokens" value={Number(usage.total_tokens ?? 0).toLocaleString()} />
        <Metric label="Tracked cost" value={`$${Number(usage.total_cost_usd ?? 0).toFixed(4)}`} />
      </section>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <section className="grid">
        <div className="panel span2">
          <div className="panelHead"><h2>Fleet</h2><button onClick={() => void refresh()}>Refresh</button></div>
          <div className="fleet">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} onCommand={runCommand} onReplay={openReplay} />
            ))}
            {!agents.length && <Empty text="No agents returned for this scope." />}
          </div>
        </div>

        <div className="panel">
          <div className="panelHead"><h2>Approval queue</h2><span>{approvals.length}</span></div>
          <div className="stack">
            {approvals.map((approval) => (
              <article className="approval" key={approval.id}>
                <div className="row"><strong>{approval.action_type}</strong><span className="risk">Risk {approval.risk_score}</span></div>
                <p>{approval.reason}</p><small>{approval.agent_id}</small>
                <div className="actions">
                  <button disabled={Boolean(busy)} onClick={() => void runCommand(`/approvals/${approval.id}/approve`, { teamId: approval.team_id }, `Approved ${approval.action_type}; exact bound action executed.`)}>Approve</button>
                  <button className="danger" disabled={Boolean(busy)} onClick={() => void runCommand(`/approvals/${approval.id}/reject`, { teamId: approval.team_id }, `Rejected ${approval.action_type}; no consequential mutation executed.`)}>Reject</button>
                </div>
              </article>
            ))}
            {!approvals.length && <Empty text="No decisions waiting." />}
          </div>
        </div>

        <div className="panel span3">
          <div className="panelHead"><h2>Live event stream</h2><span>{events.length} shown</span></div>
          <div className="events">
            {events.map((event, index) => (
              <div className="event" key={`${event.event_id ?? event.sequence ?? index}-${index}`}>
                <time>{event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString() : "—"}</time>
                <b>{event.event_type ?? "event"}</b>
                <span>{event.agent_id ?? "system"}</span>
                <span>{event.task_id ?? ""}</span>
              </div>
            ))}
            {!events.length && <Empty text="Waiting for persisted events…" />}
          </div>
        </div>

        <div className="panel span3">
          <div className="panelHead">
            <h2>Reasoning replay</h2>
            <span>{replayAgent ? `${replayAgent.name} · last ${replay.length} steps` : "Select Replay on an agent"}</span>
          </div>
          <div className="replay">
            {replay.map((step) => (
              <article className="replayStep" key={String(step.id)}>
                <div className="stepNo">{step.step_no}</div>
                <div>
                  <div className="row"><strong>{step.decision_summary}</strong><span className="policy">{step.policy_result}</span></div>
                  <p><b>Observation:</b> {step.observation}</p>
                  <p><b>Action:</b> {step.intended_action ?? "—"} <span className="muted">→ {step.action_result ?? "—"}</span></p>
                  <small>{Number(step.input_tokens) + Number(step.output_tokens)} tokens · ${Number(step.cost_usd).toFixed(4)} · {new Date(step.created_at).toLocaleTimeString()}</small>
                </div>
              </article>
            ))}
            {replayAgent && !replay.length && <Empty text="No structured reasoning steps stored for the latest run." />}
            {!replayAgent && <Empty text="Replay shows auditable summaries, evidence-linked decisions, policy results, actions, and usage — never hidden chain-of-thought." />}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function AgentRow({
  agent,
  onCommand,
  onReplay,
}: {
  agent: FleetAgent;
  onCommand: (path: string, body: Record<string, unknown>) => Promise<unknown>;
  onReplay: (agent: FleetAgent) => Promise<void>;
}) {
  const drift = Number(agent.drift_score ?? 0);
  const actionable = ["queued", "running", "waiting_approval", "paused", "blocked"].includes(agent.current_status);

  return (
    <article className="agent">
      <div className="agentIdentity"><strong>{agent.name}</strong><span>{agent.agent_type}</span></div>
      <span className={`status status-${agent.current_status}`}>{agent.current_status}</span>
      <div><small>Task</small><p>{agent.current_task ?? "—"}</p></div>
      <div><small>Last action</small><p>{agent.last_action ?? "—"}</p></div>
      <div><small>Drift</small><p>{drift.toFixed(0)} / 100</p></div>
      <div><small>Cost</small><p>${Number(agent.cost_usd ?? 0).toFixed(4)}</p></div>
      <div className="agentActions">
        <button onClick={() => void onReplay(agent)}>Replay</button>
        {agent.current_status === "paused" ? (
          <button onClick={() => void onCommand(`/agents/${agent.id}/resume`, { teamId: agent.team_id })}>Resume</button>
        ) : (
          <button disabled={!actionable || agent.current_status === "killed"} onClick={() => void onCommand(`/agents/${agent.id}/pause`, { teamId: agent.team_id })}>Pause</button>
        )}
        <button className="danger" disabled={!actionable || agent.current_status === "killed"} onClick={() => void onCommand(`/agents/${agent.id}/kill`, { teamId: agent.team_id })}>Kill</button>
      </div>
    </article>
  );
}
