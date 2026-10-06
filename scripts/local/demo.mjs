import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const secret=process.env.ACT_WORKLOAD_SECRET??'local-only-development-secret-never-used-for-production-43bytes';
const siteId=process.env.ACT_SITE_ID??'local-control-tower';
const vars=`ACT_SITE_ID=${siteId}\nACT_WORKLOAD_SECRET=${secret}\nCONTROL_API_URL=http://127.0.0.1:8008/\nEVENTS_API_URL=http://127.0.0.1:8009/\n`;
await writeFile(new URL('../../sites/.dev.vars',import.meta.url),vars,{mode:0o600});
const backend=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{stdio:'inherit',env:{...process.env,ACT_WORKLOAD_SECRET:secret,ACT_SITE_ID:siteId}});
const frontend=spawn('npm',['--prefix','sites','run','dev','--','--port','5173'],{stdio:'inherit'});
function stop(){backend.kill('SIGTERM');frontend.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);backend.on('exit',stop);frontend.on('exit',stop);
