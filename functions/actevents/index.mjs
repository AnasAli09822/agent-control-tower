import handler from "./handler.mjs";
import { json, errorResponse } from "../shared/db.mjs";
import { signStreamToken } from "../shared/stream-token.mjs";
import { requireVercelOidc } from "../shared/vercel-oidc.mjs";

const DEMO_WORKSPACE_ID = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const DEMO_TEAMS = new Set(["team_operations", "team_revenue"]);

function scope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
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
        const secret = process.env.EVENT_STREAM_SECRET;
        if (!secret) throw new Error("EVENT_STREAM_SECRET is required in Neon runtime");
        const expiresAt = Math.floor(Date.now() / 1000) + 120;
        const token = signStreamToken({ workspaceId, teamId, expiresAt }, secret);
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
