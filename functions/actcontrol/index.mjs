import { randomBytes } from "node:crypto";
import handler from "./handler.mjs";
import { errorResponse } from "../shared/db.mjs";
import { requireVercelOidc } from "../shared/vercel-oidc.mjs";

// The validated handler still contains its original API-key guard. Keep that
// defense-in-depth without managing a long-lived secret: every Neon isolate
// gets a fresh, unexported key at boot and only this wrapper can inject it.
const INTERNAL_CONTROL_KEY = randomBytes(32).toString("base64url");
process.env.CONTROL_API_KEY = INTERNAL_CONTROL_KEY;

function isHealth(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return request.method === "GET" && (path === "/" || path === "/health");
}

function withInternalKey(request) {
  const headers = new Headers(request.headers);
  headers.set("x-api-key", INTERNAL_CONTROL_KEY);
  return new Request(request, { headers });
}

export default {
  async fetch(request) {
    try {
      if (isHealth(request)) return handler.fetch(request);

      // All external control-plane traffic must carry a short-lived Vercel
      // workload identity. No static API key is accepted at the public edge.
      await requireVercelOidc(request);
      return handler.fetch(withInternalKey(request));
    } catch (error) {
      return errorResponse(error);
    }
  },
};
