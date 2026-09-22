CREATE TABLE agent_state_transition_rules (
  from_state text NOT NULL CHECK (from_state IN ('idle','queued','running','waiting_approval','paused','blocked','completed','failed','killed')),
  to_state text NOT NULL CHECK (to_state IN ('idle','queued','running','waiting_approval','paused','blocked','completed','failed','killed')),
  CONSTRAINT agent_state_transition_rules_pkey PRIMARY KEY (from_state,to_state)
);

CREATE TABLE schema_migrations (
  version text NOT NULL,
  applied_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

-- Foreign keys: created after all tables so clean bootstrap order is deterministic.
ALTER TABLE teams ADD CONSTRAINT teams_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE operators ADD CONSTRAINT operators_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE agents ADD CONSTRAINT agents_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_agent_fk FOREIGN KEY (workspace_id,team_id,assigned_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE tasks ADD CONSTRAINT tasks_operator_fk FOREIGN KEY (workspace_id,created_by_operator_id) REFERENCES operators(workspace_id,id);
ALTER TABLE agent_runs ADD CONSTRAINT runs_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE agent_runs ADD CONSTRAINT runs_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE workspace_event_counters ADD CONSTRAINT workspace_event_counters_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE agent_events ADD CONSTRAINT agent_events_causation_event_id_fkey FOREIGN KEY (causation_event_id) REFERENCES agent_events(event_id);
ALTER TABLE agent_events ADD CONSTRAINT agent_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE agent_events ADD CONSTRAINT events_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE agent_events ADD CONSTRAINT events_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE agent_events ADD CONSTRAINT events_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE agent_events ADD CONSTRAINT events_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE reasoning_steps ADD CONSTRAINT reasoning_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE reasoning_steps ADD CONSTRAINT reasoning_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE reasoning_steps ADD CONSTRAINT reasoning_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE approvals ADD CONSTRAINT approval_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE approvals ADD CONSTRAINT approval_operator_fk FOREIGN KEY (workspace_id,decided_by_operator_id) REFERENCES operators(workspace_id,id);
ALTER TABLE approvals ADD CONSTRAINT approval_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE approvals ADD CONSTRAINT approval_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE interventions ADD CONSTRAINT intervention_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE interventions ADD CONSTRAINT intervention_operator_fk FOREIGN KEY (workspace_id,operator_id) REFERENCES operators(workspace_id,id);
ALTER TABLE interventions ADD CONSTRAINT intervention_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE interventions ADD CONSTRAINT intervention_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE usage_ledger ADD CONSTRAINT usage_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE usage_ledger ADD CONSTRAINT usage_reasoning_fk FOREIGN KEY (reasoning_step_id) REFERENCES reasoning_steps(id);
ALTER TABLE usage_ledger ADD CONSTRAINT usage_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE usage_ledger ADD CONSTRAINT usage_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE policies ADD CONSTRAINT policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE policies ADD CONSTRAINT policy_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE worker_leases ADD CONSTRAINT lease_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE worker_leases ADD CONSTRAINT lease_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE audit_events ADD CONSTRAINT audit_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE audit_events ADD CONSTRAINT audit_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE audit_events ADD CONSTRAINT audit_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE audit_events ADD CONSTRAINT audit_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE audit_events ADD CONSTRAINT audit_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE crm_accounts ADD CONSTRAINT crm_accounts_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_account_fk FOREIGN KEY (workspace_id,team_id,account_id) REFERENCES crm_accounts(workspace_id,team_id,id);
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_agent_fk FOREIGN KEY (workspace_id,team_id,owner_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE crm_notes ADD CONSTRAINT crm_notes_agent_fk FOREIGN KEY (workspace_id,team_id,author_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE crm_notes ADD CONSTRAINT crm_notes_lead_fk FOREIGN KEY (workspace_id,team_id,lead_id) REFERENCES crm_leads(workspace_id,team_id,id);
ALTER TABLE outreach_drafts ADD CONSTRAINT outreach_agent_fk FOREIGN KEY (workspace_id,team_id,author_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE outreach_drafts ADD CONSTRAINT outreach_lead_fk FOREIGN KEY (workspace_id,team_id,lead_id) REFERENCES crm_leads(workspace_id,team_id,id);
ALTER TABLE support_tickets ADD CONSTRAINT support_ticket_agent_fk FOREIGN KEY (workspace_id,team_id,owner_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE support_tickets ADD CONSTRAINT support_ticket_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE account_credits ADD CONSTRAINT credits_agent_fk FOREIGN KEY (workspace_id,team_id,issued_by_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE account_credits ADD CONSTRAINT credits_ticket_fk FOREIGN KEY (workspace_id,team_id,ticket_id) REFERENCES support_tickets(workspace_id,team_id,id);
ALTER TABLE support_notes ADD CONSTRAINT support_notes_agent_fk FOREIGN KEY (workspace_id,team_id,author_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE support_notes ADD CONSTRAINT support_notes_ticket_fk FOREIGN KEY (workspace_id,team_id,ticket_id) REFERENCES support_tickets(workspace_id,team_id,id);
ALTER TABLE infra_services ADD CONSTRAINT infra_services_team_fk FOREIGN KEY (workspace_id,team_id) REFERENCES teams(workspace_id,id);
ALTER TABLE infra_deployments ADD CONSTRAINT infra_deploy_service_fk FOREIGN KEY (workspace_id,team_id,service_id) REFERENCES infra_services(workspace_id,team_id,id);
ALTER TABLE infra_metrics ADD CONSTRAINT infra_metric_service_fk FOREIGN KEY (workspace_id,team_id,service_id) REFERENCES infra_services(workspace_id,team_id,id);
ALTER TABLE incidents ADD CONSTRAINT incident_agent_fk FOREIGN KEY (workspace_id,team_id,opened_by_agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE incidents ADD CONSTRAINT incident_service_fk FOREIGN KEY (workspace_id,team_id,service_id) REFERENCES infra_services(workspace_id,team_id,id);
ALTER TABLE tool_actions ADD CONSTRAINT tool_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE tool_actions ADD CONSTRAINT tool_approval_fk FOREIGN KEY (approval_id) REFERENCES approvals(id);
ALTER TABLE tool_actions ADD CONSTRAINT tool_reasoning_fk FOREIGN KEY (reasoning_step_id) REFERENCES reasoning_steps(id);
ALTER TABLE tool_actions ADD CONSTRAINT tool_run_fk FOREIGN KEY (workspace_id,team_id,run_id) REFERENCES agent_runs(workspace_id,team_id,id);
ALTER TABLE tool_actions ADD CONSTRAINT tool_task_fk FOREIGN KEY (workspace_id,team_id,task_id) REFERENCES tasks(workspace_id,team_id,id);
ALTER TABLE infra_changes ADD CONSTRAINT infra_change_agent_fk FOREIGN KEY (workspace_id,team_id,agent_id) REFERENCES agents(workspace_id,team_id,id);
ALTER TABLE infra_changes ADD CONSTRAINT infra_change_service_fk FOREIGN KEY (workspace_id,team_id,service_id) REFERENCES infra_services(workspace_id,team_id,id);
ALTER TABLE infra_changes ADD CONSTRAINT infra_change_tool_fk FOREIGN KEY (tool_action_id) REFERENCES tool_actions(id);

-- Query-path indexes recovered from the live catalog.
CREATE INDEX idx_events_run_sequence ON agent_events (run_id,sequence);
CREATE INDEX idx_events_scope_sequence ON agent_events (workspace_id,sequence);
CREATE INDEX idx_events_scope_time ON agent_events (workspace_id,team_id,occurred_at DESC);
CREATE INDEX idx_runs_agent_status ON agent_runs (workspace_id,team_id,agent_id,status,created_at DESC);
CREATE INDEX idx_agents_team_status ON agents (workspace_id,team_id,current_status);
CREATE INDEX idx_approvals_pending ON approvals (workspace_id,team_id,requested_at) WHERE status='pending';
CREATE INDEX idx_audit_scope_time ON audit_events (workspace_id,team_id,created_at DESC);
CREATE INDEX idx_infra_metrics_service_time ON infra_metrics (workspace_id,team_id,service_id,observed_at DESC);
CREATE INDEX idx_reasoning_run_step ON reasoning_steps (run_id,step_no);
CREATE INDEX idx_tasks_team_status ON tasks (workspace_id,team_id,status,created_at DESC);
CREATE INDEX idx_tool_actions_run ON tool_actions (run_id,created_at);
CREATE INDEX idx_usage_agent_task ON usage_ledger (workspace_id,team_id,agent_id,task_id,recorded_at);
CREATE UNIQUE INDEX worker_leases_one_active_per_run ON worker_leases (run_id) WHERE released_at IS NULL;

-- State transitions recovered exactly from the live rule table.
INSERT INTO agent_state_transition_rules(from_state,to_state) VALUES
('idle','queued'),
('queued','running'),('queued','failed'),('queued','killed'),
('running','waiting_approval'),('running','paused'),('running','blocked'),('running','completed'),('running','failed'),('running','killed'),
('waiting_approval','running'),('waiting_approval','paused'),('waiting_approval','blocked'),('waiting_approval','failed'),('waiting_approval','killed'),
('paused','running'),('paused','failed'),('paused','killed'),
('blocked','running'),('blocked','failed'),('blocked','killed');

-- Database-authoritative invariants.
