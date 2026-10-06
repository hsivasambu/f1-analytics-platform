import type { Endpoint, Row } from '../openf1/core';
export function fixtureRows(): Record<Endpoint, Row[]> {
  const base={session_key:9644,driver_number:1};
  return {
    sessions:[{session_key:9644,session_name:'Race',date_end:'2024-11-24T12:00:00Z',year:2024}],
    drivers:[{...base,full_name:'SYNTHETIC TEST DRIVER'}],
    laps:[{...base,lap_number:1,lap_duration:90.125,date_start:'2024-11-24T13:00:00+01:00'},
      {...base,lap_number:2,lap_duration:null}],
    stints:[{...base,stint_number:1,lap_start:1,lap_end:2,tyre_age_at_start:0,compound:'FIXTURE'}],
    pit:[{...base,lap_number:1,date:'2024-11-24T12:01:00Z',lane_duration:20},
      {...base,lap_number:1,date:'2024-11-24T12:01:00Z',lane_duration:20}],
    race_control:[{session_key:9644,date:'2024-11-24T12:01:00Z',category:'Flag',message:'FIXTURE',scope:'Track'}],
  };
}
