import { authorizeNeon, settings } from "@/server/neon-identity";
import { sessionScope } from "@/server/demo-session";
import { sealSession } from "../../../../functions/shared/session-cookie.mjs";

async function initialize(request:Request,fresh:boolean){
  try{
    if(fresh&&request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"demo_origin_forbidden"},{status:403});
    let scope;
    if(!fresh){try{scope=await sessionScope(request);}catch{/* New visitor or expired session. */}}
    const workspaceId=scope?.workspaceId??`ws_demo_${crypto.randomUUID().replaceAll("-","")}`;
    const base=settings().CONTROL_API_URL;if(!base)throw new Error("control_proxy_not_configured");
    const body=JSON.stringify({workspaceId});
    const upstream=await authorizeNeon(new Request(new URL("sessions",base),{method:"POST",headers:{"content-type":"application/json","idempotency-key":workspaceId},body}),"control",workspaceId);
    const result=await fetch(upstream,{cache:"no-store"});
    if(!result.ok)return Response.json({error:"demo_session_unavailable"},{status:result.status});
    const data=await result.json();
    const token=await sealSession(workspaceId,settings().ACT_WORKLOAD_SECRET);
    return Response.json(data,{headers:{"cache-control":"no-store","set-cookie":`act_demo=${token}; HttpOnly; ${new URL(request.url).protocol === "https:" ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=86400`}});
  }catch{return Response.json({error:"demo_session_unavailable"},{status:503});}
}
export async function GET(request:Request){return initialize(request,false);}
export async function POST(request:Request){return initialize(request,true);}
