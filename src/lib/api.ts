export type FleetAgent = {
  id: string;
  name: string;
  team_id: string;
  agent_type: string;
  current_status: string;
  drift_score: number | string;
  control_epoch: number | string;
  current_task?: string | null;
  current_run_id?: string | null;
  last_action?: string | null;
  blocker?: string | null;
  input_tokens?: number | string;
  output_tokens?: number | string;
  cost_usd?: number | string;
};

export type Approval = {
  id: string;
  team_id: string;
  agent_id: string;
  action_type: string;
  reason: string;
  risk_level: string;
  risk_score: number | string;
  status: string;
  requested_at: string;
};


export type ReplayStep = {
  id: number | string;
  step_no: number;
  goal: string;
  observation: string;
  decision_summary: string;
  policy_result: string;
  intended_action?: string | null;
  action_result?: string | null;
  confidence?: number | string | null;
  input_tokens: number | string;
  output_tokens: number | string;
  cost_usd: number | string;
  created_at: string;
};

const controlBase = "/api/control";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  fleet: (workspaceId: string, teamId?: string) =>
    readJson<{ agents: FleetAgent[] }>(`${controlBase}/fleet?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}`),
  approvals: (workspaceId: string, teamId?: string) =>
    readJson<{ approvals: Approval[] }>(`${controlBase}/approvals?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}`),
  usage: (workspaceId: string, teamId?: string) =>
    readJson<{ total_cost_usd: number | string; total_tokens: number | string }>(`${controlBase}/usage?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}`),
  replay: (workspaceId: string, runId: string, teamId?: string, limit = 20) =>
    readJson<{ steps: ReplayStep[] }>(`${controlBase}/replay/${encodeURIComponent(runId)}?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}&limit=${limit}`),
  auditUrl: (workspaceId: string, format: "csv" | "json", teamId?: string) =>
    `${controlBase}/audit/export?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}&format=${format}`,
  eventsToken: (workspaceId: string, teamId?: string, afterSequence = 0) =>
    readJson<{ url: string; expires_at: number }>(`/api/events-token?workspace_id=${encodeURIComponent(workspaceId)}${teamId ? `&team_id=${encodeURIComponent(teamId)}` : ""}&after_sequence=${Math.max(0, Math.floor(afterSequence))}`),
};

export async function command(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${controlBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? `command_${response.status}`);
  return payload;
}
