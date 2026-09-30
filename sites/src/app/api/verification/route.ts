import { authorizeNeon, settings } from "@/server/neon-identity";

// Read-only deployment acceptance. Never starts scenarios or changes agent state.
export async function GET() {
  const checks: { name: string; passed: boolean; detail?: string }[] = [];
  const { CONTROL_API_URL: control, EVENTS_API_URL: events } = settings();
  if (!control || !events) return Response.json({ passed: false, error: "not_configured" }, { status: 503 });
  const check = (name: string, passed: boolean, detail?: string) => { checks.push({ name, passed, ...(detail ? { detail } : {}) }); };
  async function get(base: string, path: string, audience: "control" | "events", signed = true) {
    const request = new Request(new URL(path, base));
    return fetch(signed ? await authorizeNeon(request, audience) : request, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  }
  try {
    const denied = await get(control, "fleet?workspace_id=ws_demo", "control", false);
    check("anonymous_backend_denied", denied.status === 401);
    const fleet = await get(control, "fleet?workspace_id=ws_demo", "control");
    const data = await fleet.json() as { agents?: { id: string; team_id: string; current_run_id?: string }[] };
    check("signed_fleet_from_postgres", fleet.ok && data.agents?.length === 3);
    for (const [team, count] of [["team_operations", 2], ["team_revenue", 1]] as const) {
      const response = await get(control, `fleet?workspace_id=ws_demo&team_id=${team}`, "control");
      const payload = await response.json() as { agents?: { team_id: string }[] };
      check(`team_scope_${team}`, response.ok && payload.agents?.length === count && payload.agents.every(a => a.team_id === team));
    }
    const approvals = await get(control, "approvals?workspace_id=ws_demo", "control");
    const queue = await approvals.json() as { approvals?: unknown[] };
    check("approvals_query", approvals.ok && Array.isArray(queue.approvals));
    const usage = await get(control, "usage?workspace_id=ws_demo", "control");
    const totals = await usage.json() as Record<string, unknown>;
    check("usage_query", usage.ok && "total_cost_usd" in totals && "total_tokens" in totals);
    for (const format of ["json", "csv"]) {
      const response = await get(control, `audit/export?workspace_id=ws_demo&format=${format}`, "control");
      check(`audit_${format}`, response.ok && response.headers.get("content-type")?.includes(format === "json" ? "application/json" : "text/csv") === true);
      await response.body?.cancel();
    }
    const run = data.agents?.find(a => a.current_run_id)?.current_run_id;
    if (run) {
      const response = await get(control, `replay/${encodeURIComponent(run)}?workspace_id=ws_demo&limit=20`, "control");
      const payload = await response.json() as { steps?: Record<string, unknown>[] };
      check("structured_replay", response.ok && Array.isArray(payload.steps) && payload.steps.every(s => !("chain_of_thought" in s)));
    } else check("structured_replay", false, "no_current_run_available");
    const tokenResponse = await get(events, "token?workspace_id=ws_demo&team_id=team_operations", "events");
    const issued = await tokenResponse.json() as { token?: string; expires_at?: number };
    check("signed_sse_token_issued", tokenResponse.ok && issued.token?.split(".").length === 2);
    if (issued.token) {
      const token = issued.token;
      for (const [name, query, expected] of [
        ["sse_other_workspace_denied", "workspace_id=other&team_id=team_operations", 403],
        ["sse_other_team_denied", "workspace_id=ws_demo&team_id=team_revenue", 403],
      ] as const) {
        const response = await fetch(new URL(`stream?${query}&token=${encodeURIComponent(token)}`, events), { signal: AbortSignal.timeout(20000) });
        check(name, response.status === expected); await response.body?.cancel();
      }
      const altered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
      const tampered = await fetch(new URL(`stream?workspace_id=ws_demo&team_id=team_operations&token=${encodeURIComponent(altered)}`, events), { signal: AbortSignal.timeout(20000) });
      check("sse_tampered_token_denied", tampered.status === 401); await tampered.body?.cancel();
      const stream = await fetch(new URL(`stream?workspace_id=ws_demo&team_id=team_operations&after_sequence=999999999999&token=${encodeURIComponent(token)}`, events), { signal: AbortSignal.timeout(18000) });
      check("sse_content_type", stream.ok && stream.headers.get("content-type")?.includes("text/event-stream") === true);
      const reader = stream.body?.getReader();
      let text = "";
      if (reader) {
        while (!text.includes("heartbeat")) {
          const chunk = await reader.read(); if (chunk.done) break;
          text += new TextDecoder().decode(chunk.value);
          if (text.length > 8192) break;
        }
        await reader.cancel();
      }
      check("sse_idle_heartbeat", text.includes("heartbeat"));
    }
  } catch (error) {
    check("request_execution", false, error instanceof Error ? error.message : "request_failed");
  }
  return Response.json({ passed: checks.length > 0 && checks.every(c => c.passed), workspace: "ws_demo", checked_at: new Date().toISOString(), checks }, { headers: { "cache-control": "no-store" } });
}
