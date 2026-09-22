CREATE TABLE crm_accounts (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  name text NOT NULL,
  segment text NOT NULL,
  employee_count integer NOT NULL CHECK (employee_count >= 0),
  annual_value_usd numeric(14,2) NOT NULL CHECK (annual_value_usd >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT crm_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT crm_accounts_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE crm_leads (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  account_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('new','qualified','proposal','negotiation','won','lost')),
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  requested_discount_pct numeric(5,2) CHECK (requested_discount_pct IS NULL OR (requested_discount_pct >= 0 AND requested_discount_pct <= 100)),
  owner_agent_id text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT crm_leads_pkey PRIMARY KEY (id),
  CONSTRAINT crm_leads_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE crm_notes (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  lead_id text NOT NULL,
  author_agent_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT crm_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE outreach_drafts (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  lead_id text NOT NULL,
  author_agent_id text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft','approved','sent','cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT outreach_drafts_pkey PRIMARY KEY (id)
);

CREATE TABLE support_tickets (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  customer_name text NOT NULL,
  subject text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL CHECK (status IN ('open','investigating','waiting_customer','resolved','closed')),
  requested_credit_usd numeric(12,2) DEFAULT 0 NOT NULL CHECK (requested_credit_usd >= 0),
  owner_agent_id text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE account_credits (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  ticket_id text NOT NULL,
  amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0),
  status text NOT NULL CHECK (status IN ('proposed','issued','voided')),
  issued_by_agent_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT account_credits_pkey PRIMARY KEY (id)
);

CREATE TABLE support_notes (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  ticket_id text NOT NULL,
  author_agent_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT support_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE infra_services (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  name text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('staging','production')),
  status text NOT NULL CHECK (status IN ('healthy','degraded','incident')),
  rate_limit_rps integer NOT NULL CHECK (rate_limit_rps > 0),
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT infra_services_pkey PRIMARY KEY (id),
  CONSTRAINT infra_services_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE infra_deployments (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  service_id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','previous','rolled_back','failed')),
  deployed_at timestamptz NOT NULL,
  CONSTRAINT infra_deployments_pkey PRIMARY KEY (id),
  CONSTRAINT infra_deployments_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE infra_metrics (
  id bigint NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  service_id text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric(14,4) NOT NULL,
  observed_at timestamptz NOT NULL,
  CONSTRAINT infra_metrics_pkey PRIMARY KEY (id)
);

CREATE TABLE incidents (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  service_id text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('sev3','sev2','sev1')),
  status text NOT NULL CHECK (status IN ('open','mitigating','resolved')),
  opened_by_agent_id text NOT NULL,
  opened_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  CONSTRAINT incidents_pkey PRIMARY KEY (id)
);

CREATE TABLE tool_actions (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  task_id text NOT NULL,
  reasoning_step_id bigint,
  tool_name text NOT NULL,
  environment text DEFAULT 'sandbox' NOT NULL CHECK (environment IN ('sandbox','production')),
  action_payload jsonb NOT NULL,
  action_payload_hash char(64) GENERATED ALWAYS AS (encode(digest(action_payload::text,'sha256'),'hex')) STORED,
  risk_score numeric(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_decision text NOT NULL CHECK (risk_decision IN ('allow','require_approval','block')),
  approval_id text,
  status text NOT NULL CHECK (status IN ('proposed','waiting_approval','blocked','executing','succeeded','failed','denied_stale_epoch','cancelled')),
  worker_control_epoch bigint NOT NULL CHECK (worker_control_epoch >= 0),
  result_json jsonb,
  idempotency_key text NOT NULL,
  version bigint DEFAULT 0 NOT NULL CHECK (version >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  executed_at timestamptz,
  CONSTRAINT tool_actions_pkey PRIMARY KEY (id),
  CONSTRAINT tool_actions_workspace_id_idempotency_key_key UNIQUE (workspace_id,idempotency_key),
  CONSTRAINT tool_actions_workspace_id_team_id_id_key UNIQUE (workspace_id,team_id,id)
);

CREATE TABLE infra_changes (
  id text NOT NULL,
  workspace_id text NOT NULL,
  team_id text NOT NULL,
  service_id text NOT NULL,
  agent_id text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('rate_limit','rollback','config')),
  before_json jsonb NOT NULL,
  after_json jsonb NOT NULL,
  tool_action_id text NOT NULL,
  applied_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT infra_changes_pkey PRIMARY KEY (id)
);

