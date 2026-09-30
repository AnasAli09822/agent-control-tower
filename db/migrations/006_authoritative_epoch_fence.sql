-- Applied to main on 2026-09-30 after explicit user approval.
BEGIN;
CREATE OR REPLACE FUNCTION guard_authoritative_agent_epoch()
RETURNS trigger LANGUAGE plpgsql AS $fence$
DECLARE agent_epoch bigint; agent_state text; run_epoch bigint; run_state text;
BEGIN
 IF NEW.status NOT IN ('executing','succeeded') THEN RETURN NEW; END IF;
 -- Agent first, then run: same lock order as operator pause/resume/kill.
 -- Hold both row locks until the mutation transaction commits.
 SELECT control_epoch,current_status INTO agent_epoch,agent_state
 FROM agents WHERE workspace_id=NEW.workspace_id AND team_id=NEW.team_id AND id=NEW.agent_id
 FOR SHARE;
 IF agent_state IS NULL THEN RAISE EXCEPTION 'tool execution references missing agent' USING ERRCODE='23503'; END IF;
 IF agent_state NOT IN ('running','waiting_approval') THEN
  RAISE EXCEPTION 'tool execution blocked by agent state: %',agent_state USING ERRCODE='55000';
 END IF;
 IF NEW.worker_control_epoch<>agent_epoch THEN
  RAISE EXCEPTION 'tool execution blocked by authoritative control epoch: worker %, agent %',NEW.worker_control_epoch,agent_epoch USING ERRCODE='55000';
 END IF;
 SELECT control_epoch,status INTO run_epoch,run_state
 FROM agent_runs WHERE workspace_id=NEW.workspace_id AND team_id=NEW.team_id AND id=NEW.run_id
 FOR SHARE;
 IF run_state IS NULL THEN RAISE EXCEPTION 'tool execution references missing run' USING ERRCODE='23503'; END IF;
 IF run_state NOT IN ('running','waiting_approval') OR run_epoch<>agent_epoch THEN
  RAISE EXCEPTION 'tool execution blocked by run state or epoch: %, %',run_state,run_epoch USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $fence$;
CREATE TRIGGER tool_actions_authoritative_epoch_fence
BEFORE INSERT OR UPDATE ON tool_actions
FOR EACH ROW EXECUTE FUNCTION guard_authoritative_agent_epoch();
INSERT INTO schema_migrations(version) VALUES ('006_authoritative_epoch_fence');
COMMIT;
