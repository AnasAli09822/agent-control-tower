import { authorizeNeon, settings } from "@/server/neon-identity";
import { NextRequest } from "next/server";

const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const allowedTeams = new Set(["team_operations", "team_revenue"]);

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  const teamId = request.nextUrl.searchParams.get("team_id");
  const rawAfter = Number(request.nextUrl.searchParams.get("after_sequence") ?? "0");
  const afterSequence = Number.isSafeInteger(rawAfter) && rawAfter >= 0 ? rawAfter : 0;
  if (workspaceId !== demoWorkspaceId) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });
  if (teamId && !allowedTeams.has(teamId)) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });

  const eventsBase = settings().EVENTS_API_URL;
  if (!eventsBase) return Response.json({ error: "event_stream_identity_not_configured" }, { status: 503 });

  const tokenEndpoint = new URL("token", eventsBase.endsWith("/") ? eventsBase : `${eventsBase}/`);
  tokenEndpoint.searchParams.set("workspace_id", workspaceId);
  if (teamId) tokenEndpoint.searchParams.set("team_id", teamId);
  let authenticated: Request;
  try { authenticated = await authorizeNeon(new Request(tokenEndpoint), "events"); }
  catch { return Response.json({ error: "event_stream_identity_not_configured" }, { status: 503 }); }
  const issued = await fetch(authenticated, { cache: "no-store" });
  if (!issued.ok) {
    return Response.json({ error: "event_stream_token_rejected", upstream_status: issued.status }, { status: issued.status });
  }
  const payload = await issued.json() as { token?: string; expires_at?: number };
  if (!payload.token || !payload.expires_at) return Response.json({ error: "event_stream_token_invalid" }, { status: 502 });

  const upstream = new URL("stream", eventsBase.endsWith("/") ? eventsBase : `${eventsBase}/`);
  upstream.searchParams.set("workspace_id", workspaceId);
  if (teamId) upstream.searchParams.set("team_id", teamId);
  if (afterSequence > 0) upstream.searchParams.set("after_sequence", String(afterSequence));
  upstream.searchParams.set("token", payload.token);

  return Response.json({ url: upstream.toString(), expires_at: payload.expires_at }, { headers: { "cache-control": "no-store" } });
}
