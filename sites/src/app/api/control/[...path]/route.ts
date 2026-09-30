import { authorizeNeon, settings } from "@/server/neon-identity";
import { NextRequest } from "next/server";


const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const demoOperatorId = process.env.DEMO_OPERATOR_ID ?? "operator_demo";
const allowedTeams = new Set(["team_operations", "team_revenue"]);
const allowedAgents = new Set(["agent_sales", "agent_support", "agent_infra"]);

function assertDemoTeam(teamId: unknown, optional = true) {
  if (teamId == null || teamId === "") {
    if (optional) return;
    throw new Error("demo_team_required");
  }
  if (typeof teamId !== "string" || !allowedTeams.has(teamId)) throw new Error("demo_scope_forbidden");
}

function assertReadScope(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  const teamId = request.nextUrl.searchParams.get("team_id");
  if (workspaceId !== demoWorkspaceId) throw new Error("demo_scope_forbidden");
  assertDemoTeam(teamId, true);
}

function assertPath(path: string, method: string) {
  if (method === "GET") {
    if (["fleet", "approvals", "usage", "audit/export"].includes(path)) return;
    if (/^replay\/[^/]+$/.test(path)) return;
  }
  if (method === "POST") {
    if (["scenarios/start-all", "scenarios/rogue-infra"].includes(path)) return;
    const intervention = path.match(/^agents\/([^/]+)\/(pause|resume|kill)$/);
    if (intervention && allowedAgents.has(decodeURIComponent(intervention[1]))) return;
    if (/^approvals\/[^/]+\/(approve|reject)$/.test(path)) return;
  }
  throw new Error("demo_route_forbidden");
}

function assertWriteScope(body: Record<string, unknown>) {
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const teamId = body.teamId ?? body.team_id;
  const operatorId = body.operatorId ?? body.operator_id;
  if (workspaceId !== demoWorkspaceId) throw new Error("demo_scope_forbidden");
  assertDemoTeam(teamId, true);
  if (operatorId != null && operatorId !== demoOperatorId) throw new Error("demo_operator_forbidden");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const controlBase = settings().CONTROL_API_URL;
    if (!controlBase) return Response.json({ error: "control_proxy_not_configured" }, { status: 503 });
    const { path } = await context.params;
    const joinedPath = path.join("/");
    assertPath(joinedPath, request.method);

    let bodyText: string | undefined;
    if (request.method === "GET" || request.method === "HEAD") {
      assertReadScope(request);
    } else {
      if (request.headers.get("origin") !== request.nextUrl.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "demo_origin_forbidden" }, { status: 403 });
      bodyText = await request.text();
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(bodyText || "{}"); }
      catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
      assertWriteScope(parsed);
    }

    const upstream = new URL(joinedPath, controlBase.endsWith("/") ? controlBase : `${controlBase}/`);
    upstream.search = request.nextUrl.search;
    const headers = new Headers();
    headers.set("x-correlation-id", request.headers.get("x-correlation-id") ?? crypto.randomUUID());
    const idem = request.headers.get("idempotency-key");
    if (idem) headers.set("idempotency-key", idem);
    if (request.headers.get("content-type")) headers.set("content-type", request.headers.get("content-type")!);
    const authenticated = await authorizeNeon(new Request(upstream, { method: request.method, headers, body: bodyText }), "control");
    const response = await fetch(authenticated, { cache: "no-store" });
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", response.headers.get("content-type") ?? "application/json");
    responseHeaders.set("cache-control", "no-store");
    const disposition = response.headers.get("content-disposition");
    if (disposition) responseHeaders.set("content-disposition", disposition);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy_rejected";
    const status = message.includes("not_configured") ? 503 : message.includes("forbidden") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export const GET = proxy;
export const POST = proxy;
