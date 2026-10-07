import type { Data } from '../quality/core';
// Fictional values in the real schema; not a reconstruction of session 9644.
export function workbookFixture():Data {
 const date=(s:number)=>new Date(Date.UTC(2024,0,1,0,0,s)).toISOString();
 const lap=(driver_number:number,lap_number:number,seconds:number|null,start:number,is_pit_out_lap=false)=>({session_key:9644,driver_number,lap_number,lap_duration:seconds,date_start:date(start),is_pit_out_lap});
 const stint=(driver_number:number,stint_number:number,lap_start:number,lap_end:number,compound:string)=>({session_key:9644,driver_number,stint_number,lap_start,lap_end,compound,tyre_age_at_start:0});
 return {
  sessions:[{session_key:9644,session_name:'Race',year:2024,date_start:date(0),date_end:date(800)}],
  drivers:[1,44,99].map(driver_number=>({session_key:9644,driver_number,full_name:`SYNTHETIC ${driver_number}`})),
  laps:[lap(1,1,100,0),lap(1,2,90,100),lap(1,3,92,190),lap(1,4,120,282),lap(1,5,94,402,true),lap(1,6,null,496),lap(1,7,96,590),
        lap(44,1,110,0),lap(44,2,91,110),lap(44,3,95,201),lap(44,4,93,296),lap(44,5,101,389),lap(44,7,99,490)],
  stints:[stint(1,1,1,3,'HARD'),stint(1,2,4,7,'MEDIUM'),stint(44,1,1,7,'HARD')],
  pit:[{session_key:9644,driver_number:1,lap_number:4,date:date(330),lane_duration:20,pit_duration:20,stop_duration:null}],
  race_control:[{session_key:9644,date:date(15),category:'Other',message:'SYNTHETIC NOTICE'},
                {session_key:9644,date:null,category:'Other',message:'SYNTHETIC MISSING TIMESTAMP'}],
 };
}
