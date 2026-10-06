// Every public visitor receives an independent persisted demo workspace.
// This module contains no credentials and is shared with the operator UI.
export function demoScope(workspaceId) {
  if (workspaceId !== "ws_demo" && !/^ws_demo_[a-f0-9]{32}$/.test(workspaceId ?? "")) throw new Error("forbidden:demo_workspace");
  const suffix = workspaceId === "ws_demo" ? "" : `_${workspaceId.slice(8)}`;
  const id = (name) => `${name}${suffix}`;
  return {
    workspaceId, operatorId: id("operator_demo"),
    teams: [{ id: id("team_operations"), name: "Operations" }, { id: id("team_revenue"), name: "Revenue" }],
    agents: { infra: id("agent_infra"), support: id("agent_support"), sales: id("agent_sales") },
    taskIds: [id("task_infra_seed"), id("task_support_seed"), id("task_sales_seed")],
    serviceId: id("svc_public_api"), boundedTicketId: id("ticket_102"), gatedTicketId: id("ticket_103"),
    accountId: id("acct_northwind"), primaryLeadId: id("lead_northwind"), discountLeadId: id("lead_meridian"),
  };
}

export function requestWorkspace(request) {
  if (request.method === "GET") return new URL(request.url).searchParams.get("workspace_id");
  return request.clone().json().then(body => body.workspaceId ?? body.workspace_id);
}
