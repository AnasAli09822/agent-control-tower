import test from "node:test";
import assert from "node:assert/strict";
import { assertVercelClaims } from "../functions/shared/vercel-oidc.mjs";

test("accepts exact production Vercel subject", () => {
  const payload = { sub: "owner:alhajans664-2649s-projects:project:agent-control-tower:environment:production" };
  assert.equal(assertVercelClaims(payload), payload);
});

test("accepts exact preview Vercel subject", () => {
  const payload = { sub: "owner:alhajans664-2649s-projects:project:agent-control-tower:environment:preview" };
  assert.equal(assertVercelClaims(payload), payload);
});

for (const [label, sub] of [
  ["wrong owner", "owner:other:project:agent-control-tower:environment:production"],
  ["wrong project", "owner:alhajans664-2649s-projects:project:other:environment:production"],
  ["wrong environment", "owner:alhajans664-2649s-projects:project:agent-control-tower:environment:development"],
  ["missing subject", undefined],
]) {
  test(`rejects ${label}`, () => {
    assert.throws(() => assertVercelClaims({ sub }), /unauthorized:vercel_oidc_subject/);
  });
}
