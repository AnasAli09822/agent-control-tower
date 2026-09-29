// Read-only deployed-backend checks. No scenarios or interventions run during a build.
if (process.env.VERCEL !== "1") {
  console.log("backend-smoke: skipped outside Vercel");
  process.exit(0);
}
const control = "https://br-gentle-butterfly-b57bd2r5-actctlp3.compute.c-7.us-east-2.aws.neon.tech";
const events = "https://br-gentle-butterfly-b57bd2r5-actevtp3.compute.c-7.us-east-2.aws.neon.tech";
const identity = process.env.VERCEL_OIDC_TOKEN;
if (!identity) throw new Error("backend-smoke: missing Vercel workload identity");
const evidence = [];
async function request(label, url, expected, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (r.status !== expected) throw new Error(`backend-smoke: ${label} expected ${expected}, received ${r.status}`);
  evidence.push({ test: label, status: r.status });
  return r;
}
const auth = { authorization: `Bearer ${identity}` };
await request("control health", `${control}/health`, 200);
await request("events health", `${events}/health`, 200);
await request("anonymous fleet denied", `${control}/fleet?workspace_id=ws_demo`, 401);
await request("anonymous token denied", `${events}/token?workspace_id=ws_demo`, 401);
await request("anonymous stream denied", `${events}/stream?workspace_id=ws_demo`, 401);
const fleet = await (await request("OIDC fleet reaches database", `${control}/fleet?workspace_id=ws_demo`, 200, { headers: auth })).json();
if (!Array.isArray(fleet.agents) || fleet.agents.length !== 3 || fleet.agents.some(a => a.workspace_id !== "ws_demo")) throw new Error("backend-smoke: fleet scope/data contract");
const issued = await (await request("OIDC signed token", `${events}/token?workspace_id=ws_demo&team_id=team_operations`, 200, { headers: auth })).json();
if (typeof issued.token !== "string" || issued.token.split(".").length !== 2) throw new Error("backend-smoke: signed token contract");
function eventUrl(path, workspace = "ws_demo", team = "team_operations") {
  const u = new URL(path, events + "/");
  u.searchParams.set("workspace_id", workspace);
  if (team) u.searchParams.set("team_id", team);
  u.searchParams.set("token", issued.token);
  return u;
}
await request("cross-workspace stream denied", eventUrl("events", "ws_other"), 403);
await request("cross-team stream denied", eventUrl("events", "ws_demo", "team_revenue"), 403);
const tampered = eventUrl("events");
tampered.searchParams.set("token", issued.token.slice(0, -1) + (issued.token.endsWith("a") ? "b" : "a"));
await request("tampered signature denied", tampered, 401);
const page = await (await request("signed events reach durable log", eventUrl("events"), 200)).json();
if (!Array.isArray(page.events) || page.events.some(e => e.workspace_id !== "ws_demo" || e.team_id !== "team_operations")) throw new Error("backend-smoke: event scope");
for (let i = 1; i < page.events.length; i++) if (BigInt(page.events[i].sequence) <= BigInt(page.events[i-1].sequence)) throw new Error("backend-smoke: nonmonotonic sequence");
const cursor = page.events[0]?.sequence ?? "0";
const controller = new AbortController();
const u = eventUrl("stream");
const response = await fetch(u, { headers: { "last-event-id": String(cursor) }, signal: controller.signal });
if (response.status !== 200 || !response.headers.get("content-type")?.startsWith("text/event-stream")) throw new Error("backend-smoke: SSE response contract");
const reader = response.body.getReader();
const decoder = new TextDecoder();
let bytes = "";
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  while (!bytes.includes("id: ") && !bytes.includes(": heartbeat")) {
    const part = await reader.read();
    if (part.done) throw new Error("backend-smoke: stream ended before a frame");
    bytes += decoder.decode(part.value, { stream: true });
  }
  const first = bytes.match(/(?:^|\n)id: (\d+)/);
  if (first && BigInt(first[1]) <= BigInt(cursor)) throw new Error("backend-smoke: Last-Event-ID not respected");
  evidence.push({ test: "SSE Content-Type and Last-Event-ID", status: 200, first_sequence: first?.[1] ?? null });
} finally {
  clearTimeout(timeout);
  controller.abort();
  await reader.cancel().catch(() => {});
}
console.log(JSON.stringify({ suite: "read-only-backend-smoke", ok: true, agents: fleet.agents.length, evidence }));
