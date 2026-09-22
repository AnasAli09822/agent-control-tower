import test from "node:test";
import assert from "node:assert/strict";
import { signStreamToken, verifyStreamToken } from "../functions/shared/stream-token.mjs";

const secret = "test-secret-with-sufficient-entropy-for-contract-tests";

test("stream token validates only for the exact workspace/team scope", () => {
  const token = signStreamToken({ workspaceId: "ws_demo", teamId: "team_operations", issuedAt: 1000, expiresAt: 1120 }, secret);
  const claims = verifyStreamToken(token, "ws_demo", "team_operations", secret, 1050);
  assert.equal(claims.workspace_id, "ws_demo");
  assert.equal(claims.team_id, "team_operations");
  assert.throws(() => verifyStreamToken(token, "ws_demo", "team_revenue", secret, 1050), /stream_scope_mismatch/);
  assert.throws(() => verifyStreamToken(token, "ws_other", "team_operations", secret, 1050), /stream_scope_mismatch/);
});

test("expired or tampered stream tokens are rejected", () => {
  const token = signStreamToken({ workspaceId: "ws_demo", teamId: null, issuedAt: 1000, expiresAt: 1010 }, secret);
  assert.throws(() => verifyStreamToken(token, "ws_demo", null, secret, 1011), /expired_stream_token/);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.throws(() => verifyStreamToken(tampered, "ws_demo", null, secret, 1005), /invalid_stream_token/);
});
