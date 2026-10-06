import { withTx, appendAudit } from "./db.mjs";
import { demoScope } from "./demo-scope.mjs";

export async function createDemoSession(workspaceId) {
  const scope = demoScope(workspaceId);
  if (workspaceId === "ws_demo") throw new Error("forbidden:historical_demo");
  return withTx(async c => {
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [`act:session:${workspaceId}`]);
    const existing = await c.query("select id from workspaces where id=$1", [workspaceId]);
    if (existing.rowCount) return { ...scope, existing: true };
    await c.query("insert into workspaces(id,name,slug) values($1,'Agent Control Tower demo',$1)", [workspaceId]);
    for (const team of scope.teams) await c.query("insert into teams(id,workspace_id,name,slug) values($1,$2,$3,$1)", [team.id, workspaceId, team.name]);
    await c.query("insert into operators(id,workspace_id,display_name,role) values($1,$2,'Demo Operator','admin')", [scope.operatorId, workspaceId]);
    const kinds = [[scope.agents.infra, scope.teams[0].id, 'Infrastructure Ops', 'infra_ops'], [scope.agents.support, scope.teams[0].id, 'Support Ops', 'support_ops'], [scope.agents.sales, scope.teams[1].id, 'Sales Ops', 'sales_ops']];
    for (const [id, team, name, kind] of kinds) await c.query("insert into agents(id,workspace_id,team_id,name,agent_type) values($1,$2,$3,$4,$5)", [id, workspaceId, team, name, kind]);
    await c.query("insert into infra_services(id,workspace_id,team_id,name,environment,status,rate_limit_rps) values($1,$2,$3,'Public API','production','degraded',1200)", [scope.serviceId, workspaceId, scope.teams[0].id]);
    for (const [id, amount] of [[scope.boundedTicketId,125],[scope.gatedTicketId,350]]) await c.query("insert into support_tickets(id,workspace_id,team_id,customer_name,subject,priority,status,requested_credit_usd,owner_agent_id) values($1,$2,$3,'Demo customer','Service credit request','high','open',$4,$5)", [id,workspaceId,scope.teams[0].id,amount,scope.agents.support]);
    await c.query("insert into crm_accounts(id,workspace_id,team_id,name,segment,employee_count,annual_value_usd) values($1,$2,$3,'Northwind Robotics','mid_market',84,36000)", [scope.accountId,workspaceId,scope.teams[1].id]);
    for (const id of [scope.primaryLeadId,scope.discountLeadId]) await c.query("insert into crm_leads(id,workspace_id,team_id,account_id,stage,requested_discount_pct,owner_agent_id) values($1,$2,$3,$4,'new',18,$5)",[id,workspaceId,scope.teams[1].id,scope.accountId,scope.agents.sales]);
    const inputs = [{serviceId:scope.serviceId},{ticketIds:[scope.boundedTicketId,scope.gatedTicketId]},{primaryAccountId:scope.accountId,primaryLeadId:scope.primaryLeadId,discountLeadId:scope.discountLeadId}];
    const titles = ['Investigate API error spike','Clear urgent support queue','Qualify new accounts'];
    for (let i=0;i<3;i++) await c.query("insert into tasks(id,workspace_id,team_id,assigned_agent_id,title,task_type,goal,created_by_operator_id,idempotency_key,input_json) values($1,$2,$3,$4,$5,$6,'Complete the task within policy',$7,$1,$8::jsonb)", [scope.taskIds[i],workspaceId,kinds[i][1],kinds[i][0],titles[i],['incident_response','support_triage','lead_qualification'][i],scope.operatorId,JSON.stringify(inputs[i])]);
    await appendAudit(c,{workspaceId,actorType:'operator',actorId:scope.operatorId,action:'demo.session_created',targetType:'workspace',targetId:workspaceId,decision:'create',result:'recorded',correlationId:crypto.randomUUID()});
    return { ...scope, existing: false };
  });
}
