import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
const url=process.env.DATABASE_URL;
if(!url)throw new Error('Set DATABASE_URL to an empty PostgreSQL 16+ database.');
const pool=new Pool({connectionString:url});
try{
  const existing=await pool.query("select to_regclass('public.agents') as agents");
  if(existing.rows[0].agents)throw new Error('Database already initialized; refusing to replace existing data.');
  const base=new URL('../../db/migrations/',import.meta.url);
  for(const name of ['01_control_plane_tables','02_simulated_system_tables','03_constraints_indexes_rules','04_guards_triggers_binding'])await pool.query(await readFile(new URL(`000_recovered_baseline/${name}.sql`,base),'utf8'));
  await pool.query(await readFile(new URL('006_authoritative_epoch_fence.sql',base),'utf8'));
  console.log('PostgreSQL bootstrap complete. Visitor sessions seed themselves.');
}finally{await pool.end();}
