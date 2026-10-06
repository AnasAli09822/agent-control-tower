import { sessionScope } from "@/server/demo-session";
import { authorizeNeon, settings } from "@/server/neon-identity";
import { NextRequest } from "next/server";


async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const controlBase = settings().CONTROL_API_URL;
    if (!controlBase) return Response.json({ error: "control_proxy_not_configured" }, { status: 503 });
    const { path } = await context.params;
    const joinedPath = path.join("/");
    const scope = await sessionScope(request);

    let bodyText: string | undefined;
    if (request.method === "GET" || request.method === "HEAD") {
      if (request.nextUrl.searchParams.get("workspace_id") !== scope.workspaceId) throw new Error("demo_scope_forbidden");
    } else {
      if (request.headers.get("origin") !== request.nextUrl.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "demo_origin_forbidden" }, { status: 403 });
      bodyText = await request.text();
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(bodyText || "{}"); }
      catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
      if ((parsed.workspaceId ?? parsed.workspace_id) !== scope.workspaceId) throw new Error("demo_scope_forbidden");
    }

    const upstream = new URL(joinedPath, controlBase.endsWith("/") ? controlBase : `${controlBase}/`);
    upstream.search = request.nextUrl.search;
    const headers = new Headers();
    headers.set("x-correlation-id", request.headers.get("x-correlation-id") ?? crypto.randomUUID());
    const idem = request.headers.get("idempotency-key");
    if (idem) headers.set("idempotency-key", idem);
    if (request.headers.get("content-type")) headers.set("content-type", request.headers.get("content-type")!);
    const authenticated = await authorizeNeon(new Request(upstream, { method: request.method, headers, body: bodyText }), "control", scope.workspaceId);
    const response = await fetch(authenticated, { cache: "no-store" });
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", response.headers.get("content-type") ?? "application/json");
    responseHeaders.set("cache-control", "no-store");
    const disposition = response.headers.get("content-disposition");
    if (disposition) responseHeaders.set("content-disposition", disposition);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy_rejected";
    const status = message.startsWith("unauthorized") ? 401 : message.includes("not_configured") ? 503 : message.includes("forbidden") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export const GET = proxy;
export const POST = proxy;
