import assert from "node:assert/strict";
import { test } from "node:test";
import { signSitesWorkload, requireSitesWorkload, assertDemoRequest } from "../functions/shared/sites-workload.mjs";

const config = { secret: "test-secret-for-hmac-that-is-never-used-in-production-32bytes", siteId: "test_site", audience: "control", now: 1000 };
const get = () => new Request("https://control.test/fleet?workspace_id=ws_demo");
async function signed(request, options = config) {
  const token = await signSitesWorkload(request, options);
  return new Request(request, { headers: { ...Object.fromEntries(request.headers), authorization: `Bearer ${token}` } });
}
test("accepts a signed request with the exact server identity and demo scope", async () => {
  const request = await signed(get());
  assert.equal((await requireSitesWorkload(request, config)).workspace, "ws_demo");
  await assertDemoRequest(request, "control");
});
test("denies anonymous and tampered signatures", async () => {
  await assert.rejects(requireSitesWorkload(get(), config), /unauthorized/);
  const request = await signed(get());
  const headers = new Headers(request.headers);
  headers.set("authorization", headers.get("authorization").slice(0, -2) + "AA");
  await assert.rejects(requireSitesWorkload(new Request(request, { headers }), config), /unauthorized/);
});
test("denies expired, future, wrong-site, wrong-audience, wrong-workspace, and wrong-key tokens", async () => {
  const request = await signed(get());
  for (const overrides of [{ now: 1030 }, { now: 990 }, { siteId: "other" }, { audience: "events" }, { workspaceId: "other" }, { secret: "another-test-secret-that-is-never-used-in-production-32bytes" }]) {
    await assert.rejects(requireSitesWorkload(request, { ...config, ...overrides }), /unauthorized/);
  }
});
test("binds the signature to method, query, body, and idempotency key", async () => {
  const request = new Request("https://control.test/agents/agent_infra/pause", { method: "POST", headers: { "idempotency-key": "key-a" }, body: JSON.stringify({ workspaceId: "ws_demo", operatorId: "operator_demo" }) });
  const bodyText = await request.clone().text();
  const authenticated = await signed(request);
  await requireSitesWorkload(authenticated, config);
  const headers = authenticated.headers;
  for (const changed of [
    new Request(authenticated.url + "?x=1", { method: "POST", headers, body: bodyText }),
    new Request(authenticated.url, { method: "GET", headers }),
    new Request(authenticated.url, { method: "POST", headers, body: "{}" }),
    new Request(authenticated.url, { method: "POST", headers: { ...Object.fromEntries(headers), "idempotency-key": "key-b" }, body: bodyText }),
  ]) await assert.rejects(requireSitesWorkload(changed, config), /unauthorized/);
});
test("enforces demo boundaries even for a legitimately signed workload", async () => {
  for (const url of ["fleet?workspace_id=other", "fleet?workspace_id=ws_demo&workspace_id=other", "fleet?workspace_id=ws_demo&team_id=other", "private?workspace_id=ws_demo", "token?workspace_id=ws_demo"]) {
    await assert.rejects(assertDemoRequest(new Request("https://control.test/" + url), "control"), /forbidden/);
  }
  for (const [path, body] of [
    ["agents/other/kill", { workspaceId: "ws_demo" }],
    ["agents/agent_infra/kill", { workspaceId: "ws_demo", workspace_id: "other" }],
    ["agents/agent_infra/kill", { workspaceId: "ws_demo", operatorId: "other" }],
    ["agents/agent_infra/kill", { workspaceId: "ws_demo", teamId: "team_operations", team_id: "team_revenue" }],
  ]) await assert.rejects(assertDemoRequest(new Request("https://control.test/" + path, { method: "POST", body: JSON.stringify(body) }), "control"), /forbidden/);
});
test("allows the expected control operations and event-token scope", async () => {
  for (const path of ["scenarios/start-all", "scenarios/rogue-infra", "agents/agent_infra/pause", "approvals/approval_test/approve"]) {
    await assertDemoRequest(new Request("https://control.test/" + path, { method: "POST", body: JSON.stringify({ workspaceId: "ws_demo", operatorId: "operator_demo", teamId: "team_operations" }) }), "control");
  }
  await assertDemoRequest(new Request("https://events.test/token?workspace_id=ws_demo&team_id=team_revenue"), "events");
});
