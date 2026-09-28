const isVercel = process.env.VERCEL === "1";
if (!isVercel) {
  console.log("vercel-acceptance: skipped outside Vercel");
  process.exit(0);
}

const token = process.env.VERCEL_OIDC_TOKEN;
if (!token) throw new Error("vercel-acceptance: VERCEL_OIDC_TOKEN missing");

const control = "https://br-gentle-butterfly-b57bd2r5-actctlp2.compute.c-7.us-east-2.aws.neon.tech";
const events = "https://br-gentle-butterfly-b57bd2r5-actevents.compute.c-7.us-east-2.aws.neon.tech";
const workspace = "ws_demo";
const team = "team_operations";
const auth = { authorization: `Bearer ${token}`, accept: "application/json" };

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...auth, ...(options.headers ?? {}) }, cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new Error(`vercel-acceptance: ${response.status} ${url} :: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

const fleet = await json(`${control}/fleet?workspace_id=${workspace}&team_id=${team}`);
const agents = Array.isArray(fleet) ? fleet : fleet?.agents;
if (!Array.isArray(agents) || agents.length < 3) throw new Error("vercel-acceptance: fleet contract failed");

const issued = await json(`${events}/token?workspace_id=${workspace}&team_id=${team}`);
if (!issued?.token || !Number.isInteger(issued?.expires_at)) throw new Error("vercel-acceptance: stream token contract failed");

const eventPage = await fetch(`${events}/events?workspace_id=${workspace}&team_id=${team}&after_sequence=0&limit=5&token=${encodeURIComponent(issued.token)}`, { headers: { accept: "application/json" }, cache: "no-store" });
const eventBody = await eventPage.text();
if (!eventPage.ok) throw new Error(`vercel-acceptance: events ${eventPage.status} :: ${eventBody.slice(0, 500)}`);
const parsedEvents = eventBody ? JSON.parse(eventBody) : null;
if (!Array.isArray(parsedEvents?.events)) throw new Error("vercel-acceptance: events contract failed");

console.log(JSON.stringify({ ok: true, agents: agents.length, events_sampled: parsedEvents.events.length, oidc: true }));
