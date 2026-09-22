-- Agent Control Tower recovered schema baseline.
-- Source: live Neon catalog on 2026-09-22.
-- This is intentionally named "recovered" rather than pretending to be the
-- original 001/002/003 source files, which are not present in the project archive.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspaces (
  id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_slug_key UNIQUE (slug)
);

CREATE TABLE teams (
  id text NOT NULL,
  workspace_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_workspace_id_id_key UNIQUE (workspace_id,id),
  CONSTRAINT teams_workspace_id_slug_key UNIQUE (workspace_id,slug)
);

CREATE TABLE operators (
  id text NOT NULL,
  workspace_id text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','admin','auditor')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT operators_pkey PRIMARY KEY (id),
  CONSTRAINT operators_workspace_id_id_key UNIQUE (workspace_id,id)
);

CREATE TABLE agents (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  name text NOT NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('sales_ops','support_ops','infra_ops')),
  current_status text DEFAULT 'idle' NOT NULL CHECK (current_status IN ('idle','queued','running','waiting_approval','paused','blocked','completed','failed','killed')),
  drift_score numeric(5,2) DEFAULT 0 NOT NULL CHECK (drift_score >= 0 AND drift_score <= 100),
  control_epoch bigint DEFAULT 0 NOT NULL CHECK (control_epoch >= 0),
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  last_heartbeat_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE tasks (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  assigned_agent_id text NOT NULL,
  title text NOT NULL,
  task_type text NOT NULL,
  goal text NOT NULL,
  status text DEFAULT 'queued' NOT NULL CHECK (status IN ('queued','running','waiting_approval','paused','blocked','completed','failed','killed')),
  risk_budget numeric(6,2) DEFAULT 60 NOT NULL CHECK (risk_budget >= 0 AND risk_budget <= 100),
  max_tokens bigint DEFAULT 12000 NOT NULL CHECK (max_tokens >= 0),
  max_cost_usd numeric(12,6) DEFAULT 1.00 NOT NULL CHECK (max_cost_usd >= 0),
  created_by_operator_id text,
  idempotency_key text,
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  input_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_workspace_id_idempotency_key_key UNIQUE (workspace_id,idempotency_key),
  CONSTRAINT tasks_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE agent_runs (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  task_id text NOT NULL,
  run_number integer NOT NULL CHECK (run_number > 0),
  status text DEFAULT 'queued' NOT NULL CHECK (status IN ('queued','running','waiting_approval','paused','blocked','completed','failed','killed')),
  control_epoch bigint DEFAULT 0 NOT NULL CHECK (control_epoch >= 0),
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  last_checkpoint_sequence bigint DEFAULT 0 NOT NULL CHECK (last_checkpoint_sequence >= 0),
  failure_code text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT agent_runs_pkey PRIMARY KEY (id),
  CONSTRAINT agent_runs_task_id_run_number_key UNIQUE (task_id,run_number),
  CONSTRAINT agent_runs_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE workspace_event_counters (
  workspace_id text NOT NULL,
  next_sequence bigint DEFAULT 1 NOT NULL CHECK (next_sequence > 0),
  CONSTRAINT workspace_event_counters_pkey PRIMARY KEY (workspace_id)
);

CREATE TABLE agent_events (
  event_id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text,
  run_id text,
  task_id text,
  event_type text NOT NULL,
  severity text DEFAULT 'info' NOT NULL CHECK (severity IN ('debug','info','warning','critical')),
  sequence bigint,
  correlation_id text NOT NULL,
  causation_event_id bigint,
  payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  occurred_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT agent_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT agent_events_workspace_id_sequence_key UNIQUE (workspace_id,sequence)
);

CREATE TABLE reasoning_steps (
  id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  task_id text NOT NULL,
  step_no integer NOT NULL CHECK (step_no > 0),
  goal text NOT NULL,
  observation text NOT NULL,
  evidence_json jsonb DEFAULT '[]'::jsonb NOT NULL,
  decision_summary text NOT NULL,
  policy_result text DEFAULT 'none' NOT NULL CHECK (policy_result IN ('none','allow','require_approval','block')),
  intended_action text,
  action_result text,
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  input_tokens bigint DEFAULT 0 NOT NULL CHECK (input_tokens >= 0),
  output_tokens bigint DEFAULT 0 NOT NULL CHECK (output_tokens >= 0),
  cached_tokens bigint DEFAULT 0 NOT NULL CHECK (cached_tokens >= 0),
  cost_usd numeric(14,8) DEFAULT 0 NOT NULL CHECK (cost_usd >= 0),
  duration_ms bigint DEFAULT 0 NOT NULL CHECK (duration_ms >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT reasoning_steps_pkey PRIMARY KEY (id),
  CONSTRAINT reasoning_steps_run_id_step_no_key UNIQUE (run_id,step_no)
);

CREATE TABLE approvals (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  task_id text NOT NULL,
  action_type text NOT NULL,
  action_payload jsonb NOT NULL,
  action_payload_hash char(64) GENERATED ALWAYS AS (encode(digest(action_payload::text,'sha256'),'hex')) STORED,
  reason text NOT NULL,
  evidence_json jsonb DEFAULT '[]'::jsonb NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  risk_score numeric(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  estimated_impact_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  requested_at timestamptz DEFAULT now() NOT NULL,
  decided_by_operator_id text,
  decided_at timestamptz,
  decision_note text,
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  idempotency_key text NOT NULL,
  CONSTRAINT approval_decision_shape CHECK (
    (status='pending' AND decided_at IS NULL) OR
    (status IN ('approved','rejected') AND decided_at IS NOT NULL AND decided_by_operator_id IS NOT NULL) OR
    (status IN ('expired','cancelled') AND decided_at IS NOT NULL)
  ),
  CONSTRAINT approvals_pkey PRIMARY KEY (id),
  CONSTRAINT approvals_workspace_id_idempotency_key_key UNIQUE (workspace_id,idempotency_key),
  CONSTRAINT approvals_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE interventions (
  id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  operator_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text,
  task_id text,
  command text NOT NULL CHECK (command IN ('pause','resume','kill')),
  reason text NOT NULL,
  expected_version bigint,
  resulting_control_epoch bigint CHECK (resulting_control_epoch IS NULL OR resulting_control_epoch >= 0),
  idempotency_key text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT interventions_pkey PRIMARY KEY (id),
  CONSTRAINT interventions_workspace_id_idempotency_key_key UNIQUE (workspace_id,idempotency_key)
);

CREATE TABLE usage_ledger (
  id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  task_id text NOT NULL,
  reasoning_step_id bigint,
  model text NOT NULL,
  source text NOT NULL CHECK (source IN ('actual','simulated')),
  input_tokens bigint NOT NULL CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL CHECK (output_tokens >= 0),
  cached_tokens bigint DEFAULT 0 NOT NULL CHECK (cached_tokens >= 0),
  cost_usd numeric(14,8) NOT NULL CHECK (cost_usd >= 0),
  duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
  idempotency_key text NOT NULL,
  recorded_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT usage_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT usage_ledger_workspace_id_idempotency_key_key UNIQUE (workspace_id,idempotency_key)
);

CREATE TABLE policies (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text,
  name text NOT NULL,
  policy_type text NOT NULL CHECK (policy_type IN ('tool','risk','drift','budget')),
  priority integer DEFAULT 100 NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  rule_json jsonb NOT NULL,
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT policies_pkey PRIMARY KEY (id),
  CONSTRAINT policies_workspace_id_id_key UNIQUE (workspace_id,id)
);

CREATE TABLE worker_leases (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  lease_token_hash char(64) NOT NULL CHECK (lease_token_hash ~ '^[0-9a-f]{64}$'),
  control_epoch bigint NOT NULL CHECK (control_epoch >= 0),
  acquired_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  CONSTRAINT lease_time_check CHECK (expires_at > acquired_at),
  CONSTRAINT worker_leases_pkey PRIMARY KEY (id),
  CONSTRAINT worker_leases_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE audit_events (
  id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text,
  actor_type text NOT NULL CHECK (actor_type IN ('operator','agent','system','control_plane')),
  actor_id text NOT NULL,
  agent_id text,
  run_id text,
  task_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  decision text,
  risk_score numeric(5,2) CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)),
  result text NOT NULL,
  correlation_id text NOT NULL,
  payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT audit_events_pkey PRIMARY KEY (id)
);

