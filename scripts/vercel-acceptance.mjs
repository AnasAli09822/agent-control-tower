// acceptance probe: identity-safe production backend
const isVercel = process.env.VERCEL === "1";
if (!isVercel) {
  console.log("vercel-acceptance: skipped outside Vercel");
  process.exit(0);
}

const token = process.env.VERCEL_OIDC_TOKEN;
if (!token) throw new Error("vercel-acceptance: VERCEL_OIDC_TOKEN missing");

const control = "https://br-gentle-butterfly-b57bd2r5-actctlp2.compute.c-7.us-east-2.aws.neon.tech";
const events = "https://br-gentle-butterfly-b57bd2r5-actevtp2.compute.c-7.us-east-2.aws.neon.tech";
const workspace = "ws_demo";
const team = "team_operations";
const auth = { authorization: `Bearer ${token}`, accept: "application/json" };

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...auth, ...(options.headers ?? {}) }, cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new Error(`vercel-acceptance: ${response.status} ${url} :: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

const fleet = await json(`${control}/fleet?workspace_id=${workspace}`);
const agents = Array.isArray(fleet) ? fleet : fleet?.agents;
if (!Array.isArray(agents) || agents.length < 1) throw new Error("vercel-acceptance: fleet contract failed");

const issued = await json(`${events}/token?workspace_id=${workspace}&team_id=${team}`);
if (!issued?.token || !Number.isInteger(issued?.expires_at)) throw new Error("vercel-acceptance: stream token contract failed");

const eventPage = await fetch(`${events}/events?workspace_id=${workspace}&team_id=${team}&after_sequence=0&limit=5&token=${encodeURIComponent(issued.token)}`, { headers: { accept: "application/json" }, cache: "no-store" });
const eventBody = await eventPage.text();
if (!eventPage.ok) throw new Error(`vercel-acceptance: events ${eventPage.status} :: ${eventBody.slice(0, 500)}`);
const parsedEvents = eventBody ? JSON.parse(eventBody) : null;
if (!Array.isArray(parsedEvents?.events)) throw new Error("vercel-acceptance: events contract failed");

const operatorId = "operator_demo";
const post = (url, body, key) => json(url, {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body: JSON.stringify(body),
});

await post(`${control}/scenarios/start-all`, { workspaceId: workspace, operatorId }, `accept-start-${Date.now()}`);
const revenueFleet = await json(`${control}/fleet?workspace_id=${workspace}&team_id=team_revenue`);
if (!Array.isArray(revenueFleet?.agents) || revenueFleet.agents.some((a) => a.team_id !== "team_revenue")) throw new Error("vercel-acceptance: team isolation failed");

const approvals = await json(`${control}/approvals?workspace_id=${workspace}`);
if (!Array.isArray(approvals?.approvals)) throw new Error("vercel-acceptance: approvals contract failed");

const usage = await json(`${control}/usage?workspace_id=${workspace}`);
if (usage?.total_tokens == null || usage?.total_cost_usd == null) throw new Error("vercel-acceptance: usage contract failed");

const fleetAfterNormal = await json(`${control}/fleet?workspace_id=${workspace}`);
const replayRun = fleetAfterNormal?.agents?.find((a) => a.current_run_id)?.current_run_id;
if (!replayRun) throw new Error("vercel-acceptance: replay run missing");
const replay = await json(`${control}/replay/${encodeURIComponent(replayRun)}?workspace_id=${workspace}&limit=10`);
if (!Array.isArray(replay?.steps)) throw new Error("vercel-acceptance: replay contract failed");

const audit = await json(`${control}/audit/export?workspace_id=${workspace}&limit=50`);
if (!Array.isArray(audit?.audit)) throw new Error("vercel-acceptance: audit export contract failed");

await post(`${control}/scenarios/rogue-infra`, { workspaceId: workspace, operatorId }, `accept-rogue-${Date.now()}`);
const interventionBody = { workspaceId: workspace, teamId: team, operatorId, reason: "production acceptance" };
await post(`${control}/agents/agent_infra/resume`, interventionBody, `accept-resume-${Date.now()}`);
await post(`${control}/agents/agent_infra/pause`, interventionBody, `accept-pause-${Date.now()}`);
const killed = await post(`${control}/agents/agent_infra/kill`, interventionBody, `accept-kill-${Date.now()}`);
if (killed?.staleWorkerGuard?.blocked !== true) throw new Error("vercel-acceptance: stale worker guard failed");

console.log(JSON.stringify({ ok: true, agents: agents.length, events_sampled: parsedEvents.events.length, oidc: true, team_isolation: true, approvals: true, usage: true, replay: true, audit: true, rogue: true, resume_pause_kill: true, stale_worker_guard: true }));
