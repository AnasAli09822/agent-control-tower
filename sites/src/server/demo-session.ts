import "server-only";
import { settings } from "./neon-identity";
import { openSession } from "../../functions/shared/session-cookie.mjs";

export async function sessionScope(request: Request) {
  const token=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("act_demo="))?.slice(9);
  const scope=await openSession(token,settings().ACT_WORKLOAD_SECRET);
  if(!scope) throw new Error("unauthorized:demo_session_expired");
  return scope;
}
