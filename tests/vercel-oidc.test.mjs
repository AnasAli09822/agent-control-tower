import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyVercelOidcToken, assertVercelClaims } from "../functions/shared/vercel-oidc.mjs";

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

test("verifies the signature and rejects invalid issuer, audience, expiry, and signature", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const issuer = "https://oidc.vercel.com/alhajans664-2649s-projects";
  const key = { ...publicKey.export({ format: "jwk" }), kid: "generated-contract-key", alg: "RS256" };
  const payload = {
    sub: "owner:alhajans664-2649s-projects:project:agent-control-tower:environment:production",
    iss: issuer, aud: "https://vercel.com/alhajans664-2649s-projects",
    exp: Math.floor(Date.now()/1000)+120,
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const tokenFor = claims => {
    const input = encode({ alg: "RS256", kid: key.kid }) + "." + encode(claims);
    return input + "." + sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url === issuer + "/.well-known/openid-configuration") return Response.json({ jwks_uri: issuer + "/jwks" });
    if (url === issuer + "/jwks") return Response.json({ keys: [key] });
    throw new Error("Unexpected identity URL");
  };
  try {
    assert.equal((await verifyVercelOidcToken(tokenFor(payload))).sub, payload.sub);
    await assert.rejects(verifyVercelOidcToken(tokenFor({ ...payload, iss: "https://invalid.example" })), /vercel_oidc_issuer/);
    await assert.rejects(verifyVercelOidcToken(tokenFor({ ...payload, aud: "wrong-audience" })), /vercel_oidc_audience/);
    await assert.rejects(verifyVercelOidcToken(tokenFor({ ...payload, exp: 1 })), /vercel_oidc_expired/);
    const parts = tokenFor(payload).split(".");
    parts[2] = (parts[2].startsWith("a") ? "b" : "a") + parts[2].slice(1);
    await assert.rejects(verifyVercelOidcToken(parts.join(".")), /invalid_vercel_oidc/);
  } finally { globalThis.fetch = originalFetch; }
});
