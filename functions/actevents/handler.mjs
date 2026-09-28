import { createHash } from "node:crypto";
import { pool, json, errorResponse } from "../shared/db.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function scope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
}

function tokenDigest(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyStreamToken(token, workspaceId, teamId) {
  if (!token) throw new Error("unauthorized:missing_stream_token");
  const digest = tokenDigest(token);
  const { rows } = await pool.query(
    `select payload_json
       from audit_events
      where workspace_id=$1
        and team_id is not distinct from $2
        and action='stream.token.issue'
        and target_type='stream_token'
        and target_id=$3
        and result='issued'
      order by created_at desc, id desc
      limit 1`,
    [workspaceId, teamId ?? null, digest],
  );
  if (!rows.length) throw new Error("unauthorized:invalid_stream_token");
  const payload = rows[0].payload_json ?? {};
  const expiresAt = Number(payload.expires_at);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("unauthorized:expired_stream_token");
  }
  if ((payload.team_id ?? null) !== (teamId ?? null)) throw new Error("forbidden:stream_scope_mismatch");
  return true;
}

async function readEvents(workspaceId, teamId, after, limit = 100) {
  const params = [workspaceId, after, Math.min(Math.max(limit, 1), 250)];
  let where = "workspace_id=$1 and sequence>$2";
  if (teamId) { params.splice(2, 0, teamId); where += " and team_id=$3"; }
  const limitPos = params.length;
  const { rows } = await pool.query(
    `select event_id, workspace_id, team_id, agent_id, run_id, task_id, event_type, severity,
            sequence, correlation_id, causation_event_id, payload_json, occurred_at
       from agent_events
      where ${where}
      order by sequence asc
      limit $${limitPos}`,
    params,
  );
  return rows;
}

function sseHeaders() {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "access-control-allow-origin": "*",
    "x-accel-buffering": "no",
  };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "last-event-id" } });
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      if (url.pathname === "/health" || url.pathname === "/") return json({ ok: true, service: "actevents" }, 200, { "access-control-allow-origin": "*" });

      const { workspaceId, teamId } = scope(url);
      await verifyStreamToken(url.searchParams.get("token"), workspaceId, teamId);
      const queryAfter = Number(url.searchParams.get("after_sequence") || 0);
      const headerAfter = Number(request.headers.get("last-event-id") || 0);
      const after = Math.max(Number.isFinite(queryAfter) ? queryAfter : 0, Number.isFinite(headerAfter) ? headerAfter : 0);

      if (url.pathname === "/events") {
        const rows = await readEvents(workspaceId, teamId, after, Number(url.searchParams.get("limit") || 100));
        return json({ events: rows }, 200, { "access-control-allow-origin": "*" });
      }
      if (url.pathname !== "/stream") return json({ error: "not_found" }, 404, { "access-control-allow-origin": "*" });

      let cursor = after;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let lastHeartbeat = Date.now();
          controller.enqueue(encoder.encode(`retry: 1500\n\n`));
          try {
            while (!request.signal.aborted) {
              const rows = await readEvents(workspaceId, teamId, cursor, 100);
              for (const row of rows) {
                cursor = Number(row.sequence);
                controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: message\ndata: ${JSON.stringify(row)}\n\n`));
              }
              if (Date.now() - lastHeartbeat >= 10000) {
                controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
                lastHeartbeat = Date.now();
              }
              await sleep(rows.length ? 150 : 750);
            }
          } catch (error) {
            controller.enqueue(encoder.encode(`event: stream_error\ndata: ${JSON.stringify({ error: "stream_interrupted" })}\n\n`));
          } finally {
            try { controller.close(); } catch {}
          }
        },
      });
      return new Response(stream, { headers: sseHeaders() });
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("access-control-allow-origin", "*");
      return response;
    }
  },
};
