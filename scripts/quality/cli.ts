import { mkdir,writeFile,readdir,stat,unlink } from 'node:fs/promises';
import { configuration,connection,environment,safeError } from '../db/shared';
import { recordQuality } from './service';
async function main(){
 const [key,...flags]=process.argv.slice(2);if(key!=='9644')throw new Error('Usage: npm run data:quality -- 9644 [--env development|production]');
 const env=environment(flags),{values}=await configuration(env),client=connection(values.INGESTION_DATABASE_URL);
 let begun=false;
 try{await client.connect();await client.query('SELECT pg_advisory_lock(713004,$1)',[Number(key)]);
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');begun=true;
  const report=await recordQuality(client,Number(key));await client.query('COMMIT');begun=false;
  const folder='data/reports';await mkdir(folder,{recursive:true});
  const file=`${folder}/quality-${env}-${key}-${report.data_version}-${report.quality_version}.json`;
  await writeFile(file,JSON.stringify(report,null,2)+'\n');
  const prefix=`quality-${env}-${key}-`;
  const previous=await Promise.all((await readdir(folder)).filter(name=>name.startsWith(prefix)&&/^quality-(development|production)-9644-[a-f0-9]{64}-quality-v\d+\.json$/.test(name)).map(async name=>({name,mtime:(await stat(`${folder}/${name}`)).mtimeMs})));
  previous.sort((a,b)=>b.mtime-a.mtime);
  for(const old of previous.slice(20))await unlink(`${folder}/${old.name}`);
  console.log(JSON.stringify({report_id:report.report_id,data_version:report.data_version,quality_version:report.quality_version,counts:report.counts,summary:report.summary},null,2));
  console.log(`Full findings and per-lap evidence: ${file}`);
 }catch(error){if(begun)await client.query('ROLLBACK').catch(()=>undefined);throw error;}
 finally{await client.query('SELECT pg_advisory_unlock(713004,$1)',[Number(key)]).catch(()=>undefined);await client.end();}
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
