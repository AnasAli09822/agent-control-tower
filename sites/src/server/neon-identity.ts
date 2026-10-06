import "server-only";
import { env } from "cloudflare:workers";
import { signSitesWorkload, assertDemoRequest } from "../../functions/shared/sites-workload.mjs";

type Settings = { ACT_WORKLOAD_SECRET?: string; ACT_SITE_ID?: string; CONTROL_API_URL?: string; EVENTS_API_URL?: string };
export function settings(): Settings { return env as Settings; }

export async function authorizeNeon(request: Request, audience: "control" | "events", workspaceId = "ws_demo") {
  await assertDemoRequest(request, audience, workspaceId);
  const { ACT_WORKLOAD_SECRET: secret, ACT_SITE_ID: siteId } = settings();
  const token = await signSitesWorkload(request, { secret, siteId, audience, workspaceId });
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${token}`);
  return new Request(request, { headers });
}
