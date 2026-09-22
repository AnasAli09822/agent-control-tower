import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

const eventsBase = process.env.EVENTS_API_URL;
const streamSecret = process.env.EVENT_STREAM_SECRET ?? process.env.CONTROL_API_KEY;
const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const allowedTeams = new Set(["team_operations", "team_revenue"]);

export async function GET(request: NextRequest) {
  if (!eventsBase || !streamSecret) {
    return Response.json({ error: "event_stream_proxy_not_configured" }, { status: 503 });
  }
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  const teamId = request.nextUrl.searchParams.get("team_id");
  const rawAfter = Number(request.nextUrl.searchParams.get("after_sequence") ?? "0");
  const afterSequence = Number.isSafeInteger(rawAfter) && rawAfter >= 0 ? rawAfter : 0;
  if (workspaceId !== demoWorkspaceId) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });
  if (teamId && !allowedTeams.has(teamId)) return Response.json({ error: "demo_scope_forbidden" }, { status: 403 });

  const now = Math.floor(Date.now() / 1000);
  const claims = { v: 1, workspace_id: workspaceId, team_id: teamId || null, iat: now, exp: now + 120 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", streamSecret).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  const upstream = new URL("stream", eventsBase.endsWith("/") ? eventsBase : `${eventsBase}/`);
  upstream.searchParams.set("workspace_id", workspaceId);
  if (teamId) upstream.searchParams.set("team_id", teamId);
  if (afterSequence > 0) upstream.searchParams.set("after_sequence", String(afterSequence));
  upstream.searchParams.set("token", token);

  return Response.json({ url: upstream.toString(), expires_at: claims.exp }, { headers: { "cache-control": "no-store" } });
}
