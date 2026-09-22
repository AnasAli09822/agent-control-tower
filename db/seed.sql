-- Canonical deterministic demo seed for The Agent Control Tower.
-- Safe to re-run: every seed identity uses ON CONFLICT DO NOTHING.

INSERT INTO workspaces(id,name,slug)
VALUES ('ws_demo','Aperture Labs','aperture-labs')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams(id,workspace_id,name,slug) VALUES
  ('team_operations','ws_demo','Operations','operations'),
  ('team_revenue','ws_demo','Revenue','revenue')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operators(id,workspace_id,display_name,role)
VALUES ('operator_demo','ws_demo','Demo Operator','admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agents(id,workspace_id,team_id,name,agent_type,current_status,drift_score,control_epoch,version) VALUES
  ('agent_support','ws_demo','team_operations','Support Ops','support_ops','idle',0,0,0),
  ('agent_sales','ws_demo','team_revenue','Sales Ops','sales_ops','idle',0,0,0),
  ('agent_infra','ws_demo','team_operations','Infrastructure Ops','infra_ops','idle',0,0,0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,status,risk_budget,max_tokens,max_cost_usd,created_by_operator_id,idempotency_key,input_json) VALUES
  ('task_support_seed','ws_demo','team_operations','agent_support','Clear urgent support queue','support_triage','Resolve urgent cases within credit policy','queued',60,12000,1.00,'operator_demo','seed-task-support','{"ticketIds":["ticket_102","ticket_103"]}'::jsonb),
  ('task_infra_seed','ws_demo','team_operations','agent_infra','Investigate API error spike','incident_response','Restore API health without unsafe production changes','queued',60,12000,1.00,'operator_demo','seed-task-infra','{"mode":"normal","serviceId":"svc_public_api"}'::jsonb),
  ('task_sales_seed','ws_demo','team_revenue','agent_sales','Qualify new accounts','lead_qualification','Qualify pipeline and prepare safe follow-up','queued',60,12000,1.00,'operator_demo','seed-task-sales','{"primaryAccountId":"acct_northwind"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_accounts(id,workspace_id,team_id,name,segment,employee_count,annual_value_usd) VALUES
  ('acct_lattice','ws_demo','team_revenue','Lattice Commerce','smb',31,18000),
  ('acct_meridian','ws_demo','team_revenue','Meridian Health Systems','mid_market',120,54000),
  ('acct_northwind','ws_demo','team_revenue','Northwind Robotics','mid_market',84,36000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_leads(id,workspace_id,team_id,account_id,stage,score,requested_discount_pct,owner_agent_id) VALUES
  ('lead_lattice','ws_demo','team_revenue','acct_lattice','new',NULL,8,'agent_sales'),
  ('lead_meridian','ws_demo','team_revenue','acct_meridian','new',NULL,18,'agent_sales'),
  ('lead_northwind','ws_demo','team_revenue','acct_northwind','new',NULL,NULL,'agent_sales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_tickets(id,workspace_id,team_id,customer_name,subject,priority,status,requested_credit_usd,owner_agent_id) VALUES
  ('ticket_101','ws_demo','team_operations','Pine & Co','Webhook failures after deploy','urgent','open',0,'agent_support'),
  ('ticket_102','ws_demo','team_operations','Alto Systems','Duplicate charge','high','open',125,'agent_support'),
  ('ticket_103','ws_demo','team_operations','Juniper Works','Service credit request','high','open',350,'agent_support')
ON CONFLICT (id) DO NOTHING;

INSERT INTO infra_services(id,workspace_id,team_id,name,environment,status,rate_limit_rps) VALUES
  ('svc_public_api','ws_demo','team_operations','Public API','production','degraded',1200),
  ('svc_worker','ws_demo','team_operations','Job Worker','production','healthy',600)
ON CONFLICT (id) DO NOTHING;

INSERT INTO infra_deployments(id,workspace_id,team_id,service_id,version,status,deployed_at) VALUES
  ('deploy_api_141','ws_demo','team_operations','svc_public_api','1.4.1','previous','2026-09-19T20:59:04.894Z'),
  ('deploy_api_142','ws_demo','team_operations','svc_public_api','1.4.2','active','2026-09-21T20:24:04.894Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO infra_metrics(id,workspace_id,team_id,service_id,metric_name,metric_value,observed_at) VALUES
  (1,'ws_demo','team_operations','svc_public_api','error_rate_pct',8.4,'2026-09-21T20:56:04.894Z'),
  (2,'ws_demo','team_operations','svc_public_api','p95_latency_ms',920,'2026-09-21T20:56:04.894Z'),
  (3,'ws_demo','team_operations','svc_public_api','request_rate_rps',760,'2026-09-21T20:56:04.894Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO policies(id,workspace_id,team_id,name,policy_type,priority,enabled,rule_json,version) VALUES
  ('policy_drift','ws_demo',NULL,'Drift thresholds','drift',5,true,'{"watch_max":69,"normal_max":39,"warning_max":84,"critical_min":85,"critical_action":"auto_pause"}'::jsonb,0),
  ('policy_infra_prod','ws_demo','team_operations','Production mutation gate','risk',10,true,'{"tools":["infra.change_rate_limit","infra.rollback_release"],"decision":"require_approval","environment":"production","base_risk_score":80}'::jsonb,0),
  ('policy_sales_discount','ws_demo','team_revenue','Sales discount approval','risk',10,true,'{"tool":"crm.propose_discount","when":{"discount_pct_gt":10},"decision":"require_approval","risk_score":72}'::jsonb,0),
  ('policy_support_credit','ws_demo','team_operations','Support credit limits','risk',10,true,'{"tool":"billing.issue_credit","block_above_usd":500,"approval_above_usd":200}'::jsonb,0),
  ('policy_sales_bulk','ws_demo','team_revenue','Bulk outreach approval','risk',20,true,'{"tool":"mail.draft_outreach","when":{"recipient_count_gt":5},"decision":"require_approval","risk_score":68}'::jsonb,0)
ON CONFLICT (id) DO NOTHING;
