-- Harden the live Tool Executor guard after adversarial bootstrap testing found
-- that a generated column is not reliable inside a BEFORE trigger.
BEGIN;

CREATE OR REPLACE FUNCTION guard_tool_execution()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  run_status text;
  run_epoch bigint;
  run_agent_id text;
  run_task_id text;
  approved_hash char(64);
  computed_hash text;
  approval_status text;
  approval_agent text;
  approval_run text;
  approval_task text;
  approval_action_type text;
  approval_workspace text;
  approval_team text;
  approval_risk_score numeric;
  kind text;
BEGIN
  IF NEW.status NOT IN ('executing','succeeded') THEN RETURN NEW; END IF;

  SELECT r.status,r.control_epoch,r.agent_id,r.task_id,a.agent_type
    INTO run_status,run_epoch,run_agent_id,run_task_id,kind
    FROM agent_runs r
    JOIN agents a ON a.id=r.agent_id AND a.workspace_id=r.workspace_id AND a.team_id=r.team_id
   WHERE r.id=NEW.run_id AND r.workspace_id=NEW.workspace_id AND r.team_id=NEW.team_id;

  IF run_status IS NULL THEN RAISE EXCEPTION 'tool action references missing run' USING ERRCODE='23503'; END IF;
  IF NEW.agent_id IS DISTINCT FROM run_agent_id OR NEW.task_id IS DISTINCT FROM run_task_id THEN
    RAISE EXCEPTION 'tool action scope does not match run' USING ERRCODE='55000';
  END IF;
  IF NEW.worker_control_epoch<>run_epoch THEN
    RAISE EXCEPTION 'tool execution blocked by stale control epoch: worker %, current %',NEW.worker_control_epoch,run_epoch USING ERRCODE='55000';
  END IF;
  IF run_status NOT IN ('running','waiting_approval') THEN
    RAISE EXCEPTION 'tool execution blocked by run state: %',run_status USING ERRCODE='55000';
  END IF;
  IF run_status='waiting_approval' AND NEW.risk_decision<>'require_approval' THEN
    RAISE EXCEPTION 'waiting approval run may execute only its approved action' USING ERRCODE='55000';
  END IF;
  IF NOT ((kind='sales_ops' AND NEW.tool_name LIKE 'crm.%') OR
          (kind='support_ops' AND (NEW.tool_name LIKE 'support.%' OR NEW.tool_name='billing.issue_credit')) OR
          (kind='infra_ops' AND NEW.tool_name LIKE 'infra.%')) THEN
    RAISE EXCEPTION 'tool execution blocked by agent authority' USING ERRCODE='55000';
  END IF;
  IF NEW.risk_decision='block' THEN RAISE EXCEPTION 'blocked risk decision cannot execute' USING ERRCODE='55000'; END IF;
  IF NEW.environment='production' AND NEW.tool_name IN ('infra.change_rate_limit','infra.rollback_release') AND NEW.risk_decision<>'require_approval' THEN
    RAISE EXCEPTION 'production infrastructure mutation requires approval' USING ERRCODE='55000';
  END IF;
  IF NEW.tool_name='crm.propose_discount' AND COALESCE((NEW.action_payload->>'discount_pct')::numeric,0)>10 AND NEW.risk_decision<>'require_approval' THEN
    RAISE EXCEPTION 'discount above 10 percent requires approval' USING ERRCODE='55000';
  END IF;
  IF NEW.tool_name='billing.issue_credit' AND COALESCE((NEW.action_payload->>'amount_usd')::numeric,0)>200 AND NEW.risk_decision<>'require_approval' THEN
    RAISE EXCEPTION 'credit above 200 requires approval' USING ERRCODE='55000';
  END IF;

  IF NEW.risk_decision='require_approval' THEN
    IF NEW.approval_id IS NULL THEN RAISE EXCEPTION 'approval required for tool execution' USING ERRCODE='23514'; END IF;
    SELECT action_payload_hash,status,agent_id,run_id,task_id,action_type,workspace_id,team_id,risk_score
      INTO approved_hash,approval_status,approval_agent,approval_run,approval_task,approval_action_type,approval_workspace,approval_team,approval_risk_score
      FROM approvals WHERE id=NEW.approval_id;
    IF approval_status IS NULL THEN RAISE EXCEPTION 'approval not found' USING ERRCODE='23503'; END IF;
    IF approval_status<>'approved' THEN RAISE EXCEPTION 'approval is not approved' USING ERRCODE='55000'; END IF;
    computed_hash := encode(digest(NEW.action_payload::text,'sha256'),'hex');
    IF approved_hash::text<>computed_hash THEN RAISE EXCEPTION 'approved payload hash does not match tool action' USING ERRCODE='55000'; END IF;
    IF approval_action_type<>NEW.tool_name THEN RAISE EXCEPTION 'approved action type does not match tool action' USING ERRCODE='55000'; END IF;
    IF approval_workspace<>NEW.workspace_id OR approval_team<>NEW.team_id
       OR approval_agent<>NEW.agent_id OR approval_run<>NEW.run_id OR approval_task<>NEW.task_id THEN
      RAISE EXCEPTION 'approval scope does not match tool action' USING ERRCODE='55000';
    END IF;
    IF approval_risk_score IS DISTINCT FROM NEW.risk_score THEN
      RAISE EXCEPTION 'approval risk score does not match tool action' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


INSERT INTO schema_migrations(version) VALUES ('004_harden_tool_approval_binding')
ON CONFLICT (version) DO NOTHING;

COMMIT;
