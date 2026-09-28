import { createHash, randomBytes, randomUUID } from "node:crypto";
import handler from "./handler.mjs";
import { appendAudit, errorResponse, json, withTx } from "../shared/db.mjs";
import { requireVercelOidc } from "../shared/vercel-oidc.mjs";

const DEMO_WORKSPACE_ID = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const DEMO_TEAMS = new Set(["team_operations", "team_revenue"]);
const TOKEN_TTL_SECONDS = 120;

function scope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
}

function tokenDigest(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function issueStreamToken(request, workspaceId, teamId) {
  const token = randomBytes(32).toString("base64url");
  const digest = tokenDigest(token);
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const correlationId = request.headers.get("x-correlation-id") ?? randomUUID();

  await withTx((client) => appendAudit(client, {
    workspaceId,
    teamId,
    actorType: "system",
    actorId: "vercel_oidc",
    action: "stream.token.issue",
    targetType: "stream_token",
    targetId: digest,
    decision: "allow",
    result: "issued",
    correlationId,
    payload: { team_id: teamId ?? null, expires_at: expiresAt },
  }));

  return { token, expiresAt };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "GET" && path === "/token") {
        await requireVercelOidc(request);
        const { workspaceId, teamId } = scope(url);
        if (workspaceId !== DEMO_WORKSPACE_ID || (teamId && !DEMO_TEAMS.has(teamId))) {
          throw new Error("forbidden:demo_scope");
        }
        const { token, expiresAt } = await issueStreamToken(request, workspaceId, teamId);
        return json({ token, expires_at: expiresAt }, 200, { "cache-control": "no-store" });
      }

      return handler.fetch(request);
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("access-control-allow-origin", "*");
      return response;
    }
  },
};
