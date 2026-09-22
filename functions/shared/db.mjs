import { Pool } from "pg";
import { attachDatabasePool } from "@neon/functions";

const databaseUrl = process.env.ACT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export const pool = new Pool({ connectionString: databaseUrl, max: 5 });
attachDatabasePool(pool);

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function nextBigintId(client, table) {
  const idColumns = new Map([
    ["agent_events", "event_id"],
    ["interventions", "id"],
    ["audit_events", "id"],
    ["reasoning_steps", "id"],
    ["usage_ledger", "id"],
    ["infra_metrics", "id"],
  ]);
  const idColumn = idColumns.get(table);
  if (!idColumn) throw new Error("unsupported_id_table");
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [`act:id:${table}`]);
  const { rows } = await client.query(`select coalesce(max(${idColumn}), 0)::bigint + 1 as id from ${table}`);
  return rows[0].id;
}

export async function nextWorkspaceSequence(client, workspaceId) {
  const { rows } = await client.query(
    `insert into workspace_event_counters(workspace_id, next_sequence)
     values ($1, 2)
     on conflict (workspace_id)
     do update set next_sequence = workspace_event_counters.next_sequence + 1
     returning (next_sequence - 1)::bigint as sequence`,
    [workspaceId],
  );
  return rows[0].sequence;
}

export async function appendEvent(client, event) {
  // event_id is global; sequence is workspace-scoped and is assigned atomically
  // by the database trigger. Keeping these two counters independent prevents
  // event_id collisions once more than one workspace emits sequence=1,2,...
  const eventId = await nextBigintId(client, "agent_events");
  const { rows } = await client.query(
    `insert into agent_events(
       event_id, workspace_id, team_id, agent_id, run_id, task_id,
       event_type, severity, sequence, correlation_id, causation_event_id, payload_json
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,null,$9,$10,$11::jsonb)
     returning *`,
    [
      eventId,
      event.workspaceId,
      event.teamId,
      event.agentId ?? null,
      event.runId ?? null,
      event.taskId ?? null,
      event.eventType,
      event.severity ?? "info",
      event.correlationId,
      event.causationEventId ?? null,
      JSON.stringify(event.payload ?? {}),
    ],
  );
  return rows[0];
}

export async function appendAudit(client, audit) {
  const id = await nextBigintId(client, "audit_events");
  const { rows } = await client.query(
    `insert into audit_events(
       id, workspace_id, team_id, actor_type, actor_id, agent_id, run_id, task_id,
       action, target_type, target_id, decision, risk_score, result, correlation_id, payload_json
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     returning *`,
    [
      id, audit.workspaceId, audit.teamId ?? null, audit.actorType, audit.actorId,
      audit.agentId ?? null, audit.runId ?? null, audit.taskId ?? null,
      audit.action, audit.targetType ?? null, audit.targetId ?? null,
      audit.decision ?? null, audit.riskScore ?? null, audit.result,
      audit.correlationId, JSON.stringify(audit.payload ?? {}),
    ],
  );
  return rows[0];
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(error) {
  const message = error instanceof Error ? error.message : "internal_error";
  const status = message.startsWith("not_found") ? 404
    : message.startsWith("conflict") || message.startsWith("invalid_transition") ? 409
    : message.startsWith("unauthorized") ? 401
    : message.startsWith("forbidden") ? 403
    : message.startsWith("bad_request") ? 400
    : 500;
  return json({ error: message }, status);
}

export async function readJson(request) {
  try { return await request.json(); }
  catch { throw new Error("bad_request:invalid_json"); }
}

export function requireApiKey(request) {
  const expected = process.env.CONTROL_API_KEY;
  if (!expected) throw new Error("CONTROL_API_KEY is required");
  const actual = request.headers.get("x-api-key");
  if (actual !== expected) throw new Error("unauthorized:invalid_api_key");
}

export function idempotencyKey(request, body) {
  return request.headers.get("idempotency-key") || body.idempotencyKey || null;
}

export function correlationId(request) {
  return request.headers.get("x-correlation-id") || crypto.randomUUID();
}
