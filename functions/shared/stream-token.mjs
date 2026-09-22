import { createHmac, timingSafeEqual } from "node:crypto";

export function signStreamToken({ workspaceId, teamId = null, expiresAt, issuedAt = Math.floor(Date.now() / 1000) }, secret) {
  if (!secret) throw new Error("EVENT_STREAM_SECRET is required");
  const claims = { v: 1, workspace_id: workspaceId, team_id: teamId, iat: issuedAt, exp: expiresAt };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyStreamToken(token, workspaceId, teamId, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error("EVENT_STREAM_SECRET is required");
  if (!token) throw new Error("unauthorized:missing_stream_token");
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) throw new Error("unauthorized:invalid_stream_token");
  const expected = createHmac("sha256", secret).update(payloadPart).digest("base64url");
  const actualBytes = Buffer.from(signaturePart);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error("unauthorized:invalid_stream_token");
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")); }
  catch { throw new Error("unauthorized:invalid_stream_token"); }
  if (claims.v !== 1 || !Number.isInteger(claims.exp) || claims.exp < now) throw new Error("unauthorized:expired_stream_token");
  if (claims.workspace_id !== workspaceId) throw new Error("forbidden:stream_scope_mismatch");
  const claimedTeam = claims.team_id ?? null;
  const requestedTeam = teamId ?? null;
  if (claimedTeam !== requestedTeam) throw new Error("forbidden:stream_scope_mismatch");
  return claims;
}
