import { randomBytes } from "node:crypto";
import handler from "../actcontrol/handler.mjs";
import { errorResponse } from "../shared/db.mjs";
import { requireSitesWorkload, assertDemoRequest } from "../shared/sites-workload.mjs";

const internalKey = randomBytes(32).toString("base64url");
process.env.CONTROL_API_KEY = internalKey;
export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && ["/", "/health"].includes(url.pathname.replace(/\/+$/, "") || "/")) return handler.fetch(request);
      await requireSitesWorkload(request, { secret: process.env.ACT_WORKLOAD_SECRET, siteId: process.env.ACT_SITE_ID, audience: "control" });
      await assertDemoRequest(request, "control");
      const headers = new Headers(request.headers);
      headers.set("x-api-key", internalKey);
      return handler.fetch(new Request(request, { headers }));
    } catch (error) { return errorResponse(error); }
  },
};
