import { demoScope } from "./demo-scope.mjs";
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(secret,usage){
  if(typeof secret!=='string'||secret.length<43) throw new Error('session_identity_not_configured');
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,[usage]);
}
export async function sealSession(workspaceId,secret,now=Math.floor(Date.now()/1000)){
  demoScope(workspaceId);
  const payload=b64(encoder.encode(JSON.stringify({workspaceId,expiresAt:now+86400})));
  const signature=await crypto.subtle.sign('HMAC',await key(secret,'sign'),encoder.encode('act:session:'+payload));
  return payload+'.'+b64(new Uint8Array(signature));
}
export async function openSession(token,secret,now=Math.floor(Date.now()/1000)){
  try{
    if(!token||token.length>1024) return null;
    const parts=token.split('.');if(parts.length!==2)return null;
    if(!await crypto.subtle.verify('HMAC',await key(secret,'verify'),decode(parts[1]),encoder.encode('act:session:'+parts[0])))return null;
    const value=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if(!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+86400)return null;
    if(!/^ws_demo_[a-f0-9]{32}$/.test(value.workspaceId))return null;
    return demoScope(value.workspaceId);
  }catch{return null;}
}
