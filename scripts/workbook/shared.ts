import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Client } from 'pg';
import { QUALITY_VERSION } from '../quality/core';
export const lessons=['01-session-counts','02-driver-coverage','03-fastest-eligible','04-median-eligible','05-matched-comparison','06-stint-summaries','07-lag-changes','08-rolling-pace','09-event-timeline','10-exclusion-sensitivity'] as const;
export type Options={session:number;driverA:number;driverB:number;fromLap:number;toLap:number};
export const defaults:Options={session:9644,driverA:1,driverB:44,fromLap:1,toLap:1000};
export async function execute(client:Client,lesson:number,options:Options=defaults) {
 if(!Number.isInteger(lesson)||lesson<1||lesson>lessons.length)throw new Error('Lesson must be 1–10');
 const context=await readFile(resolve('sql/workbook/context.sql'),'utf8');
 const answer=await readFile(resolve(`sql/workbook/answers/${lessons[lesson-1]}.sql`),'utf8');
 return (await client.query(`${context}\n${answer}`,[options.session,options.driverA,options.driverB,options.fromLap,options.toLap,QUALITY_VERSION])).rows;
}
export async function requireCurrentReport(client:Client,session:number) {
 const result=await client.query(`SELECT d.data_version,q.quality_version,q.summary FROM f1.session_datasets d
 JOIN f1.quality_reports q ON q.session_key=d.session_key AND q.data_version=d.data_version
 WHERE d.session_key=$1 AND q.quality_version=$2`,[session,QUALITY_VERSION]);
 if(result.rowCount!==1)throw new Error('Current dataset/quality report missing; run Stage 5 data:quality for the ingested session');
 if(Number(result.rows[0].summary.hard_findings)!==0)throw new Error('Hard integrity findings block workbook analysis; inspect the quality report');
 return result.rows[0];
}
