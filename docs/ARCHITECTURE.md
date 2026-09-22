# Architecture

Agent Control Tower is a control plane between autonomous workers and consequential tools.

```text
Browser / Operator UI (Vercel / Next.js)
   | short reads + commands                    | signed 120s SSE token
   v                                           v
Vercel scoped server proxy              Neon Function: actevents
   | x-api-key stays server-only                 | persisted sequence replay
   v                                             |
Neon Function: actcontrol <----------------------+
   |                                             |
   +----------------------+----------------------+
                          v
                    Neon Postgres
          agents / tasks / runs / events
      approvals / reasoning / usage / audit
                          |
                  Tool Executor Guard
                          |
             CRM / Support / Infra simulators
```

The database is authoritative for mutable control state and append-only evidence. Every guarded tool mutation re-checks run state, run↔agent/task scope, agent authority, `control_epoch`, risk decision, and any exact approval binding immediately before the simulated external-system write.

`kill` increments the authoritative epoch. A worker holding the previous epoch is stale and must be denied before mutation. Stale-epoch rejection takes precedence over terminal-state reporting so the failure test proves worker invalidation, not merely UI state.

The public demo proxy is deliberately restricted to `ws_demo`, the two demo teams, the three demo agents, and `operator_demo`. The control API key is never exposed to the browser. SSE uses a short-lived HMAC token bound to workspace/team; reconnects mint a fresh token and pass `after_sequence` so persisted events resume without a gap.

Reasoning replay stores structured operational summaries and evidence references. Raw hidden chain-of-thought is not stored or exposed.
