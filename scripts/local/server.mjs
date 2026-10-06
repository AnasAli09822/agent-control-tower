import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
process.env.ACT_LOCAL_MODE='1';
process.env.ACT_SITE_ID??='local-control-tower';
process.env.ACT_WORKLOAD_SECRET??='local-only-development-secret-never-used-for-production-43bytes';
process.env.EVENT_STREAM_SECRET??=randomBytes(32).toString('base64url');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required. Run db:bootstrap once against an empty PostgreSQL database.');
const [{default:control},{default:events}]=await Promise.all([import('../../functions/actcontrol-sites/index.mjs'),import('../../functions/actevents-sites/index.mjs')]);
for(const [port,handler] of [[8008,control],[8009,events]]){
  createServer(async(req,res)=>{
    const abort=new AbortController();res.on('close',()=>abort.abort());
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,signal:abort.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
      const response=await handler.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body){const reader=response.body.getReader();while(!abort.signal.aborted){const next=await reader.read();if(next.done)break;res.write(Buffer.from(next.value));}await reader.cancel().catch(()=>{});}
      res.end();
    }catch(e){if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'local_server_failure'}));console.error(e.message);}
  }).listen(port,'127.0.0.1',()=>console.log(`Local ${port===8008?'control':'events'} service on port ${port}`));
}
