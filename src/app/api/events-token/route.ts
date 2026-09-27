import { getVercelOidcToken } from "@vercel/oidc";
import { NextRequest } from "next/server";

const eventsBase = process.env.EVENTS_API_URL ?? "https://br-gentle-butterfly-b57bd2r5-actevents.compute.c-7.us-east-2.aws.neon.tech/";
const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const allowedTeams = new Set(["team_operations", "team_revenue"]);

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  const teamId = request.nextUrl.searchParams.get("team_id");
  const rawAfter = Number(request.nextUrl.searchParams.get("after_sequence") ?? "0");
  const afterSequence = Number.isSafeInteger(rawAfter) && rawAfter >= 0 ? rawAfter : 0;
  if (workspaceId !== demoWorkspaceId) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });
  if (teamId && !allowedTeams.has(teamId)) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });

  const oidcToken = await getVercelOidcToken();
  if (!oidcToken) return Response.json({ error: "event_stream_identity_unavailable" }, { status: 503 });

  const tokenEndpoint = new URL("token", eventsBase.endsWith("/") ? eventsBase : `${eventsBase}/`);
  tokenEndpoint.searchParams.set("workspace_id", workspaceId);
  if (teamId) tokenEndpoint.searchParams.set("team_id", teamId);
  const issued = await fetch(tokenEndpoint, {
    headers: { authorization: `Bearer ${oidcToken}` },
    cache: "no-store",
  });
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
