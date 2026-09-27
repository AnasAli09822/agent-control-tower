import handler from "./handler.mjs";
import { errorResponse } from "../shared/db.mjs";
import { requireVercelOidc } from "../shared/vercel-oidc.mjs";

function isHealth(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return request.method === "GET" && (path === "/" || path === "/health");
}

function withInternalKey(request) {
  const key = process.env.CONTROL_API_KEY;
  if (!key) throw new Error("CONTROL_API_KEY is required in Neon runtime");
  const headers = new Headers(request.headers);
  headers.set("x-api-key", key);
  return new Request(request, { headers });
}

export default {
  async fetch(request) {
    try {
      if (isHealth(request)) return handler.fetch(request);

      // Direct administrative API-key access stays Neon-only. Normal Vercel
      // traffic authenticates with short-lived workload identity instead.
      const expected = process.env.CONTROL_API_KEY;
      const actual = request.headers.get("x-api-key");
      if (!(expected && actual === expected)) await requireVercelOidc(request);

      // The previously validated handler keeps its existing API-key guard.
      // The wrapper injects the Neon-local key only after workload identity
      // has been verified, so the browser and Vercel never receive it.
      return handler.fetch(withInternalKey(request));
    } catch (error) {
      return errorResponse(error);
    }
  },
};
