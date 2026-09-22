-- Defense-in-depth execution binding that does not depend on BEFORE-trigger
-- visibility of STORED GENERATED columns. Safe to apply even if migration 004
-- has not been applied: PostgreSQL validates these relationships after row
-- generation, at constraint time.
BEGIN;

ALTER TABLE agent_runs
  ADD CONSTRAINT runs_exec_scope_key
  UNIQUE (workspace_id, team_id, id, agent_id, task_id);

ALTER TABLE approvals
  ADD CONSTRAINT approvals_exec_binding_key
  UNIQUE (
    id, workspace_id, team_id, agent_id, run_id, task_id,
    action_type, action_payload_hash, risk_score, status
  );

ALTER TABLE tool_actions
  ADD COLUMN approval_expected_status text
  GENERATED ALWAYS AS (
    CASE
      WHEN approval_id IS NOT NULL AND status IN ('executing','succeeded') THEN 'approved'::text
      ELSE NULL::text
    END
  ) STORED;

ALTER TABLE tool_actions
  ADD CONSTRAINT tool_run_scope_exact_fk
  FOREIGN KEY (workspace_id, team_id, run_id, agent_id, task_id)
  REFERENCES agent_runs (workspace_id, team_id, id, agent_id, task_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tool_actions
  ADD CONSTRAINT tool_approval_exact_fk
  FOREIGN KEY (
    approval_id, workspace_id, team_id, agent_id, run_id, task_id,
    tool_name, action_payload_hash, risk_score, approval_expected_status
  )
  REFERENCES approvals (
    id, workspace_id, team_id, agent_id, run_id, task_id,
    action_type, action_payload_hash, risk_score, status
  )
  DEFERRABLE INITIALLY DEFERRED;

INSERT INTO schema_migrations(version)
VALUES ('005_declarative_execution_binding')
ON CONFLICT (version) DO NOTHING;

COMMIT;
