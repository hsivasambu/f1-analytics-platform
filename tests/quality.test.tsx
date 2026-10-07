import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, type Data } from '../scripts/quality/core';
const time=(seconds:number)=>new Date(Date.UTC(2024,0,1,0,0,seconds)).toISOString();
function fixture():Data{return {
 sessions:[{session_key:9644,date_end:time(300)}],drivers:[{session_key:9644,driver_number:1}],
 laps:[1,2,3,4].map(n=>({session_key:9644,driver_number:1,lap_number:n,date_start:time((n-1)*60),lap_duration:60,is_pit_out_lap:false})),
 stints:[{session_key:9644,driver_number:1,stint_number:1,lap_start:1,lap_end:4,compound:'HARD'}],pit:[],race_control:[]};}
const event=(seconds:number,values:Record<string,unknown>)=>({session_key:9644,date:time(seconds),...values});
test('missing stays null; zero and invalid durations block analysis; no green certification',()=>{
 const d=fixture();d.laps[1].lap_duration=null;d.laps[2].lap_duration=0;d.laps[3].lap_duration=-2;
 const r=analyze(d);assert.equal(r.laps[1].lap_duration,null);assert.equal(r.laps[2].lap_duration,0);
 assert.equal(r.laps[1].interval_source,'estimated_next_start');assert.ok(r.laps[1].exclusions.includes('duration_missing'));
 assert.equal(r.summary.hard_findings,2);assert.ok(r.laps.every(l=>!l.pace_candidate&&l.green_flag_status==='not_established'));
});
test('duplicate keys, broken references and projection/manifest counts are hard failures',()=>{
 const d=fixture();d.laps.push({...d.laps[1]});d.stints[0].driver_number=99;
 const r=analyze(d,{sessions:1,drivers:1,laps:4,stints:1,pit:0,race_control:0});
 for(const code of ['duplicate_key','driver_reference_broken','archive_count_mismatch'])assert.ok(r.findings.some(f=>f.code===code&&f.severity==='hard'));
 const typed=fixture();typed.laps.pop();assert.ok(analyze(fixture(),undefined,typed).findings.some(f=>f.code==='projection_count_mismatch'));
});
test('lap gaps and early driver endings warn without asserting retirement or fabricating rows',()=>{
 const d=fixture();d.laps.splice(1,1);d.drivers.push({session_key:9644,driver_number:2});d.laps.push({session_key:9644,driver_number:2,lap_number:1,lap_duration:60,date_start:time(0),is_pit_out_lap:false});
 const r=analyze(d);assert.equal(r.summary.hard_findings,0);assert.ok(r.findings.some(f=>f.code==='lap_sequence_gap'));
 const short=r.findings.find(f=>f.code==='driver_coverage_ends_early');assert.equal(short?.evidence.retirement_observed,false);
 assert.equal(r.laps.length,d.laps.length);
});
test('retirement message explains early endings but is not proof of complete source coverage',()=>{
 const d=fixture();d.drivers.push({session_key:9644,driver_number:2});d.laps.push({...d.laps[0],driver_number:2});
 d.race_control=[event(40,{category:'CarEvent',driver_number:2,message:'CAR RETIRED'})];
 assert.equal(analyze(d).findings.find(f=>f.code==='driver_coverage_ends_early')?.severity,'info');
});
test('stint overlap/unmatched/unknown compound prevents stint eligibility without erasing pace',()=>{
 const d=fixture();d.stints[0].lap_end=2;d.stints.push({...d.stints[0],stint_number:2,lap_start:2,lap_end:3,compound:null});
 const r=analyze(d);assert.ok(r.laps[1].warnings.includes('stint_ambiguous'));assert.equal(r.laps[1].pace_candidate,true);assert.equal(r.laps[1].stint_candidate,false);
 assert.ok(r.laps[3].warnings.includes('stint_unmatched'));assert.equal(r.laps[3].stint_candidate,false);
 assert.ok(r.findings.some(f=>f.code==='stint_boundary_overlap'));
});
test('pit source number and approximate timestamp retain distinct exclusion evidence; out-lap flag preserved',()=>{
 const d=fixture();d.pit=[event(90,{driver_number:1,lap_number:2})];d.laps[2].is_pit_out_lap=true;
 const r=analyze(d);assert.ok(r.laps[1].exclusions.includes('pit_event_lap'));assert.ok(r.laps[2].exclusions.includes('pit_out_lap'));
 assert.equal(d.laps.length,4);assert.equal(r.laps[1].evidence.find(e=>e.endpoint==='pit')?.match,'source_lap_number');
});
test('SC deployment and actual track green define half-open windows; adjacent boundaries remain uncertain',()=>{
 const d=fixture();d.race_control=[event(60,{category:'SafetyCar',message:'SAFETY CAR DEPLOYED'}),event(120,{category:'Flag',flag:'GREEN',scope:'Track',message:'GREEN FLAG'})];
 const r=analyze(d);assert.equal(r.laps[1].control_state,'neutralized_overlap');
 assert.equal(r.laps[0].control_state,'possible_interruption');assert.equal(r.laps[2].control_state,'possible_interruption');
 assert.ok(r.laps[2].warnings.includes('control_boundary_uncertain'));assert.equal(r.laps[3].pace_candidate,true);
});
test('pit-exit green and SC in-this-lap do not clear neutralization; unmatched end stays open',()=>{
 const d=fixture();d.race_control=[event(70,{category:'SafetyCar',message:'SAFETY CAR DEPLOYED'}),event(110,{category:'SafetyCar',message:'SAFETY CAR IN THIS LAP'}),event(120,{category:'Flag',flag:'GREEN',scope:'Track',message:'GREEN LIGHT - PIT EXIT OPEN'})];
 const r=analyze(d);assert.equal(r.laps[3].control_state,'neutralized_overlap');assert.ok(r.control_windows[0].open);
});
test('VSC ending is pending; red closes on explicit session resume, never DRS enabled',()=>{
 const d=fixture();d.race_control=[event(70,{category:'SafetyCar',message:'VIRTUAL SAFETY CAR DEPLOYED'}),event(100,{category:'SafetyCar',message:'VIRTUAL SAFETY CAR ENDING'}),event(120,{category:'Drs',message:'DRS ENABLED'}),event(150,{category:'SafetyCar',message:'VIRTUAL SAFETY CAR ENDED'}),event(170,{category:'Flag',flag:'RED',scope:'Track'}),event(200,{category:'SessionStatus',message:'SESSION RESUMED'})];
 const r=analyze(d);assert.ok(r.laps[2].exclusions.includes('vsc_overlap'));assert.ok(r.laps[3].exclusions.includes('red_flag_overlap'));
});
test('sector yellow is potential whole-lap warning, not neutralization; matching clear closes only that scope',()=>{
 const d=fixture();d.race_control=[event(70,{category:'Flag',flag:'YELLOW',scope:'Sector',sector:6}),event(90,{category:'Flag',flag:'CLEAR',scope:'Sector',sector:7}),event(150,{category:'Flag',flag:'CLEAR',scope:'Sector',sector:6})];
 const r=analyze(d);assert.equal(r.laps[1].control_state,'yellow_warning');assert.equal(r.laps[2].control_state,'yellow_warning');
 assert.ok(r.laps[1].warnings.includes('sector_yellow_possible_overlap'));assert.ok(!r.laps[1].exclusions.includes('safety_car_overlap'));assert.equal(r.laps[3].pace_candidate,true);
});
test('driver flags apply only to that driver; post-finish yellow never maps backward',()=>{
 const d=fixture();d.drivers.push({session_key:9644,driver_number:2});d.laps.push({...d.laps[1],driver_number:2});
 d.race_control=[event(70,{category:'Flag',flag:'YELLOW',scope:'Driver',driver_number:2}),event(100,{category:'Flag',flag:'CLEAR',scope:'Driver',driver_number:2}),event(310,{category:'Flag',flag:'YELLOW',scope:'Sector',sector:6})];
 const r=analyze(d);assert.equal(r.laps[1].control_state,'no_known_interruption');assert.equal(r.laps[4].control_state,'yellow_warning');
});
test('deleted lap is mapped by explicit car/lap, never delayed announcement timestamp',()=>{
 const d=fixture();d.race_control=[event(200,{category:'Other',message:'CAR 1 TIME 1:00.000 DELETED - TRACK LIMITS LAP 2'}),event(210,{category:'Other',message:'CAR 1 LAP DELETED - NEXT LAP PIT'})];
 const r=analyze(d);assert.ok(r.laps[1].exclusions.includes('lap_time_deleted_notice'));assert.ok(!r.laps[3].exclusions.includes('lap_time_deleted_notice'));
 assert.ok(r.findings.some(f=>f.code==='deleted_lap_unresolved'));
});
test('missing timestamps prevent flag assignment and do not create normal measurements',()=>{
 const d=fixture();delete d.laps[1].date_start;d.race_control=[{session_key:9644,category:'Flag',flag:'RED',scope:'Track'}];
 const r=analyze(d);assert.equal(r.laps[1].control_state,'unmappable');assert.ok(r.laps[1].exclusions.includes('lap_interval_unknown'));
 assert.ok(r.findings.some(f=>f.code==='control_timestamp_missing'));assert.equal(r.laps[1].green_flag_status,'not_established');
});
