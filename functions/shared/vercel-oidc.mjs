import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

const DEFAULT_OWNER = "alhajans664-2649s-projects";
const DEFAULT_PROJECT = "agent-control-tower";
const DEFAULT_ENVIRONMENTS = ["production", "preview"];
const jwksByIssuer = new Map();

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

export function assertVercelClaims(payload) {
  const owner = ownerSlug();
  const project = projectName();
  const subjects = new Set([...allowedEnvironments()].map((env) => `owner:${owner}:project:${project}:environment:${env}`));
  if (!payload?.sub || !subjects.has(payload.sub)) throw new Error("unauthorized:vercel_oidc_subject");
  return payload;
}

async function jwksForIssuer(issuer) {
  if (jwksByIssuer.has(issuer)) return jwksByIssuer.get(issuer);
  const promise = (async () => {
    const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("unauthorized:vercel_oidc_discovery");
    const discovery = await response.json();
    if (!discovery?.jwks_uri) throw new Error("unauthorized:vercel_oidc_jwks");
    return createRemoteJWKSet(new URL(discovery.jwks_uri));
  })();
  jwksByIssuer.set(issuer, promise);
  try { return await promise; }
  catch (error) { jwksByIssuer.delete(issuer); throw error; }
}

export async function verifyVercelOidcToken(token) {
  if (!token) throw new Error("unauthorized:missing_vercel_oidc");
  let decoded;
  try { decoded = decodeJwt(token); }
  catch { throw new Error("unauthorized:invalid_vercel_oidc"); }
  const issuer = decoded.iss;
  if (!issuer || !allowedIssuers().has(issuer)) throw new Error("unauthorized:vercel_oidc_issuer");
  try {
    const jwks = await jwksForIssuer(issuer);
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: expectedAudience() });
    return assertVercelClaims(payload);
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
