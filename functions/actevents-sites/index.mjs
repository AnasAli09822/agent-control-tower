import handler from "../actevents/handler.mjs";
import { json, errorResponse } from "../shared/db.mjs";
import { signStreamToken } from "../shared/stream-token.mjs";
import { requireSitesWorkload, assertDemoRequest } from "../shared/sites-workload.mjs";

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/token") {
        await requireSitesWorkload(request, { secret: process.env.ACT_WORKLOAD_SECRET, siteId: process.env.ACT_SITE_ID, audience: "events" });
        await assertDemoRequest(request, "events");
        const expiresAt = Math.floor(Date.now() / 1000) + 120;
        const secret = process.env.EVENT_STREAM_SECRET;
        if (!secret) throw new Error("EVENT_STREAM_SECRET is required in Neon runtime");
        const token = signStreamToken({ workspaceId: "ws_demo", teamId: url.searchParams.get("team_id"), expiresAt }, secret);
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
