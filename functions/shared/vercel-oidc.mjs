import { createPublicKey, verify as verifySignature, constants as cryptoConstants } from "node:crypto";

const DEFAULT_OWNER = "alhajans664-2649s-projects";
const DEFAULT_PROJECT = "agent-control-tower";
const DEFAULT_ENVIRONMENTS = ["production", "preview"];
const JWKS_TTL_MS = 5 * 60_000;
const jwksCache = new Map();

function ownerSlug() { return process.env.VERCEL_OWNER_SLUG ?? DEFAULT_OWNER; }
function projectName() { return process.env.VERCEL_PROJECT_NAME ?? DEFAULT_PROJECT; }
function allowedEnvironments() {
  const raw = process.env.VERCEL_ALLOWED_ENVIRONMENTS;
  return new Set((raw ? raw.split(",") : DEFAULT_ENVIRONMENTS).map((v) => v.trim()).filter(Boolean));
}
function allowedIssuers() {
  const owner = ownerSlug();
  return new Set([`https://oidc.vercel.com/${owner}`, "https://oidc.vercel.com"]);
}
function expectedAudience() { return `https://vercel.com/${ownerSlug()}`; }
function decodeJson(segment) { return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")); }
function audienceMatches(aud) {
  const expected = expectedAudience();
  return typeof aud === "string" ? aud === expected : Array.isArray(aud) && aud.includes(expected);
}

export function assertVercelClaims(payload) {
  const owner = ownerSlug();
  const project = projectName();
  const subjects = new Set([...allowedEnvironments()].map((env) => `owner:${owner}:project:${project}:environment:${env}`));
  if (!payload?.sub || !subjects.has(payload.sub)) throw new Error("unauthorized:vercel_oidc_subject");
  return payload;
}

async function jwksForIssuer(issuer) {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const discoveryResponse = await fetch(discoveryUrl, { headers: { accept: "application/json" } });
  if (!discoveryResponse.ok) throw new Error("unauthorized:vercel_oidc_discovery");
  const discovery = await discoveryResponse.json();
  if (!discovery?.jwks_uri) throw new Error("unauthorized:vercel_oidc_jwks");
  const jwksResponse = await fetch(discovery.jwks_uri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("unauthorized:vercel_oidc_jwks");
  const jwks = await jwksResponse.json();
  if (!Array.isArray(jwks?.keys) || !jwks.keys.length) throw new Error("unauthorized:vercel_oidc_jwks");
  jwksCache.set(issuer, { keys: jwks.keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return jwks.keys;
}

function verifyWithJwk(alg, signingInput, signature, jwk) {
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(signingInput);
  const sig = Buffer.from(signature, "base64url");
  if (alg === "RS256" || alg === "RS384" || alg === "RS512") {
    const hash = `RSA-SHA${alg.slice(2)}`;
    return verifySignature(hash, data, key, sig);
  }
  if (alg === "PS256" || alg === "PS384" || alg === "PS512") {
    const bits = Number(alg.slice(2));
    return verifySignature(`RSA-SHA${bits}`, data, {
      key,
      padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
      saltLength: bits / 8,
    }, sig);
  }
  if (alg === "ES256" || alg === "ES384" || alg === "ES512") {
    return verifySignature(`sha${alg.slice(2)}`, data, { key, dsaEncoding: "ieee-p1363" }, sig);
  }
  throw new Error("unauthorized:vercel_oidc_alg");
}

export async function verifyVercelOidcToken(token) {
  if (!token) throw new Error("unauthorized:missing_vercel_oidc");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("unauthorized:invalid_vercel_oidc");
  let header, payload;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch {
    throw new Error("unauthorized:invalid_vercel_oidc");
  }
  const issuer = payload?.iss;
  if (!issuer || !allowedIssuers().has(issuer)) throw new Error("unauthorized:vercel_oidc_issuer");
  if (!audienceMatches(payload.aud)) throw new Error("unauthorized:vercel_oidc_audience");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("unauthorized:vercel_oidc_expired");
  if (payload.nbf != null && (!Number.isFinite(payload.nbf) || payload.nbf > now + 30)) throw new Error("unauthorized:vercel_oidc_not_yet_valid");
  assertVercelClaims(payload);
  if (!header?.kid || !header?.alg || header.alg === "none") throw new Error("unauthorized:invalid_vercel_oidc");
  try {
    const keys = await jwksForIssuer(issuer);
    const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === header.alg));
    if (!jwk || !verifyWithJwk(header.alg, `${parts[0]}.${parts[1]}`, parts[2], jwk)) {
      jwksCache.delete(issuer);
      throw new Error("unauthorized:invalid_vercel_oidc");
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("unauthorized:")) throw error;
    throw new Error("unauthorized:invalid_vercel_oidc");
  }
}

export async function requireVercelOidc(request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("unauthorized:missing_vercel_oidc");
  return verifyVercelOidcToken(auth.slice(7).trim());
}

export async function requireControlAuth(request) {
  const expected = process.env.CONTROL_API_KEY;
  const actual = request.headers.get("x-api-key");
  if (expected && actual === expected) return { auth: "api_key" };
  await requireVercelOidc(request);
  return { auth: "vercel_oidc" };
}
