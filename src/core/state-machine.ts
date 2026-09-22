import type { AgentState } from "./types.ts";

const transitions: Record<AgentState, ReadonlySet<AgentState>> = {
  idle: new Set(["queued"]),
  queued: new Set(["running", "killed", "failed"]),
  running: new Set(["waiting_approval", "paused", "blocked", "completed", "failed", "killed"]),
  waiting_approval: new Set(["running", "paused", "blocked", "failed", "killed"]),
  paused: new Set(["running", "blocked", "failed", "killed"]),
  blocked: new Set(["running", "failed", "killed"]),
  completed: new Set(),
  failed: new Set(),
  killed: new Set(),
};

export function canTransition(from: AgentState, to: AgentState): boolean {
  return transitions[from].has(to);
}

export function requireTransition(from: AgentState, to: AgentState): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_agent_transition:${from}->${to}`);
  }
}

export function isTerminal(state: AgentState): boolean {
  return state === "completed" || state === "failed" || state === "killed";
}
