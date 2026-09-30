// Shared by the Sites Worker and Neon Functions. No platform-specific APIs.
// Only servers receive the signing secret; the browser receives SSE tokens only.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const teams = new Set(["team_operations", "team_revenue"]);
const agents = new Set(["agent_sales", "agent_support", "agent_infra"]);

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unbase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("unauthorized:workload_token");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
async function key(secret, usage) {
  if (typeof secret !== "string" || secret.length < 43) throw new Error("workload_identity_not_configured");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}
async function binding(request) {
  const url = new URL(request.url);
  const digest = await crypto.subtle.digest("SHA-256", await request.clone().arrayBuffer());
  return { method: request.method, target: url.pathname + url.search, body: base64url(new Uint8Array(digest)), idempotency: request.headers.get("idempotency-key") ?? "" };
}
export async function signSitesWorkload(request, { secret, siteId, audience, workspaceId = "ws_demo", now = Math.floor(Date.now() / 1000) }) {
  if (!siteId || !["control", "events"].includes(audience)) throw new Error("workload_identity_not_configured");
  const claims = { v: 1, iss: siteId, aud: audience, workspace: workspaceId, iat: now, exp: now + 30, ...await binding(request) };
  const encoded = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret, "sign"), encoder.encode(encoded));
  return encoded + "." + base64url(new Uint8Array(signature));
}
export async function requireSitesWorkload(request, { secret, siteId, audience, workspaceId = "ws_demo", now = Math.floor(Date.now() / 1000) }) {
  const raw = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!raw || raw.length > 4096) throw new Error("unauthorized:workload_token");
  try {
    const pieces = raw.split(".");
    if (pieces.length !== 2) throw new Error();
    const valid = await crypto.subtle.verify("HMAC", await key(secret, "verify"), unbase64url(pieces[1]), encoder.encode(pieces[0]));
    if (!valid) throw new Error();
    const claims = JSON.parse(decoder.decode(unbase64url(pieces[0])));
    if (claims.v !== 1 || !siteId || claims.iss !== siteId || claims.aud !== audience || claims.workspace !== workspaceId) throw new Error();
    if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat > now + 5 || claims.exp <= now || claims.exp - claims.iat !== 30) throw new Error();
    const expected = await binding(request);
    for (const field of ["method", "target", "body", "idempotency"]) if (claims[field] !== expected[field]) throw new Error();
    return claims;
  } catch {
    throw new Error("unauthorized:workload_token");
  }
}
function exactAlias(body, camel, snake, expected, required = false) {
  const values = [body[camel], body[snake]].filter((v) => v != null);
  if ((required && !values.length) || values.some((v) => v !== expected)) throw new Error("forbidden:demo_scope");
}
export async function assertDemoRequest(request, audience, workspaceId = "ws_demo") {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  if (request.method === "GET") {
    if (audience === "events" ? path !== "token" : !(["fleet", "approvals", "usage", "audit/export"].includes(path) || /^replay\/[A-Za-z0-9_-]+$/.test(path))) throw new Error("forbidden:demo_route");
    const workspaces = url.searchParams.getAll("workspace_id");
    const selectedTeams = url.searchParams.getAll("team_id");
    if (workspaces.length !== 1 || workspaces[0] !== workspaceId || selectedTeams.length > 1 || selectedTeams.some((t) => t && !teams.has(t))) throw new Error("forbidden:demo_scope");
    return;
  }
  if (audience !== "control" || request.method !== "POST") throw new Error("forbidden:demo_route");
  const intervention = path.match(/^agents\/([A-Za-z0-9_-]+)\/(pause|resume|kill)$/);
  if (!["scenarios/start-all", "scenarios/rogue-infra"].includes(path) && !(intervention && agents.has(intervention[1])) && !/^approvals\/[A-Za-z0-9_-]+\/(approve|reject)$/.test(path)) throw new Error("forbidden:demo_route");
  let body;
  try { body = await request.clone().json(); } catch { throw new Error("bad_request:invalid_json"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad_request:invalid_json");
  exactAlias(body, "workspaceId", "workspace_id", workspaceId, true);
  exactAlias(body, "operatorId", "operator_id", "operator_demo");
  const selectedTeams = [body.teamId, body.team_id].filter((v) => v != null && v !== "");
  if (selectedTeams.some((t) => !teams.has(t)) || new Set(selectedTeams).size > 1) throw new Error("forbidden:demo_scope");
}
