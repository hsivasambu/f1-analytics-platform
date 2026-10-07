import { configuration,connection,safeError } from '../db/shared';
import { defaults,execute,lessons,requireCurrentReport,type Options } from './shared';
async function main(){
 const args=process.argv.slice(2),options:Options={...defaults};let lesson='all',env:'development'|'production'='development',limit=12;
 const numbers:Record<string,keyof Options>={'--session':'session','--driver-a':'driverA','--driver-b':'driverB','--from-lap':'fromLap','--to-lap':'toLap'};
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];if(value===undefined)throw new Error(`Missing value for ${flag}`);
  if(numbers[flag]){if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error(`${flag} requires a positive integer`);options[numbers[flag]]=Number(value);}
  else if(flag==='--query'&&(value==='all'||/^(?:[1-9]|10)$/.test(value)))lesson=value;
  else if(flag==='--env'&&(value==='development'||value==='production'))env=value;
  else if(flag==='--limit'&&/^[1-9]\d*$/.test(value)&&Number(value)<=2000)limit=Number(value);
  else throw new Error('Use --query all|1..10, --session N, --driver-a N, --driver-b N, --from-lap N, --to-lap N, --limit 1..2000, --env development|production');
 }
 if(options.driverA===options.driverB||options.fromLap>options.toLap)throw new Error('Choose distinct drivers and an increasing lap range');
 const {values}=await configuration(env),client=connection(values.APP_DATABASE_URL);
 try{await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const report=await requireCurrentReport(client,options.session);
  const drivers=await client.query('SELECT driver_number FROM f1.session_entries WHERE session_key=$1 AND driver_number=ANY($2::integer[])',[options.session,[options.driverA,options.driverB]]);
  if(drivers.rowCount!==2)throw new Error('Both selected driver numbers must exist in this session');
  console.log(JSON.stringify({environment:env,...options,data_version:report.data_version,quality_version:report.quality_version,green_flag_status:'not_established'},null,2));
  for(const n of lesson==='all'?lessons.map((_,i)=>i+1):[Number(lesson)]){
   const rows=await execute(client,n,options);console.log(`\n${lessons[n-1]}: ${rows.length} result rows`);
   console.table(rows.slice(0,limit).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date?value.toISOString():value&&typeof value==='object'?JSON.stringify(value):value]))));
   if(rows.length>limit)console.log(`Showing ${limit}/${rows.length}; increase --limit to inspect more rows.`);
  }
  await client.query('COMMIT');
 }finally{await client.query('ROLLBACK').catch(()=>undefined);await client.end();}
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
