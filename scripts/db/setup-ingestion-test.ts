import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {connection,safeError} from './shared';
import {migrate} from './migrate';
async function main(){
const v=parseEnv(await readFile('.env.docker.local','utf8'));
const root=new URL('postgresql://127.0.0.1:15432/postgres?sslmode=disable');root.username=v.POSTGRES_USER!;root.password=v.POSTGRES_PASSWORD!;
const admin=connection(root.toString());await admin.connect();
try {if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='f1_stage4_test'")).rowCount)await admin.query('CREATE DATABASE f1_stage4_test');}finally{await admin.end();}
root.pathname='/f1_stage4_test';const owner=connection(root.toString());await owner.connect();
try {
 await migrate(owner);
 let existing:Record<string,string | undefined>={};try{existing=parseEnv(await readFile('.env.ingestion-test.local','utf8'));}catch{}
 const out:Record<string,string>={MIGRATION_DATABASE_URL:root.toString()};
 for(const [role,group,key] of [['f1_stage4_test_reader','f1_app_reader','APP_DATABASE_URL'],['f1_stage4_test_writer','f1_ingestor','INGESTION_DATABASE_URL']]){
  if((await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount){if(!existing[key])throw new Error('Existing test role URL missing; refusing password reset');out[key]=existing[key];}
  else{const pw=randomBytes(32).toString('hex');await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${pw}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);await owner.query(`GRANT ${group} TO ${role}`);const u=new URL(root);u.username=role;u.password=pw;out[key]=u.toString();}
 }
 await writeFile('.env.ingestion-test.local',Object.entries(out).map(([k,value])=>`${k}=${value}`).join('\n')+'\n',{mode:0o600});
 console.log('Dedicated local f1_stage4_test migrated; generated test credentials saved only in ignored env file');
}finally{await owner.end();}

}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
