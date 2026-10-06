process.env.ACT_LOCAL_MODE='1';
process.env.CONTROL_API_KEY='local-acceptance-only-key';
const [{runSteppedAcceptance},{pool}]=await Promise.all([import('../../tests/stepped-acceptance.mjs'),import('../../functions/shared/db.mjs')]);
try{console.log(JSON.stringify(await runSteppedAcceptance(),null,2));}finally{await pool.end();}
