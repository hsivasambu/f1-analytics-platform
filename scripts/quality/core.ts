import type { Endpoint, Row } from '../openf1/core';

export const QUALITY_VERSION = 'quality-v1';
export const BOUNDARY_MS = 1000; // conservative review buffer, not a measured error bound
export const ENDPOINTS: Endpoint[] = ['sessions','drivers','laps','stints','pit','race_control'];
export type Data = Record<Endpoint, Row[]>;
export type Finding = { severity: 'hard' | 'warning' | 'info'; code: string; explanation: string; evidence: Row };
export type Assessment = {
  source_ordinal: number; driver_number: number | null; lap_number: number | null;
  lap_duration: number | null; interval_start: string | null; interval_end: string | null;
  interval_source: 'duration' | 'estimated_next_start' | 'unavailable';
  exclusions: string[]; warnings: string[]; evidence: Row[];
  pace_candidate: boolean; stint_candidate: boolean;
  control_state: 'neutralized_overlap' | 'yellow_warning' | 'possible_interruption' | 'no_known_interruption' | 'unmappable';
  green_flag_status: 'not_established';
};
const stamp = (value: unknown): number | null => {
  if(typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const ms = Date.parse(value); return Number.isFinite(ms) ? ms : null;
};
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const iso = (v: number | null) => v === null ? null : new Date(v).toISOString();
const scopeKey = (e: Row) => `${e.scope}:${e.scope === 'Sector' ? e.sector : e.scope === 'Driver' ? e.driver_number : 'all'}`;
type Window = { kind: string; start: number; end: number; event: Row; ordinal: number; closure: Row | null; open: boolean };

export function analyze(data: Data, expectedCounts?: Record<string, number>, typed?: Data) {
  const findings: Finding[] = [];
  const add = (severity: Finding['severity'], code: string, explanation: string, evidence: Row = {}) => findings.push({severity,code,explanation,evidence});
  const key = (r: Row, endpoint: Endpoint) => JSON.stringify([r.session_key,
    ...(['drivers','laps','stints'].includes(endpoint) ? [r.driver_number] : []),
    ...(endpoint === 'laps' ? [r.lap_number] : endpoint === 'stints' ? [r.stint_number] : [])]);
  const sessionKey = data.sessions[0]?.session_key;
  const counts = Object.fromEntries(ENDPOINTS.map(e => [e,data[e].length]));
  const drivers = new Set(data.drivers.map(r => r.driver_number));
  for(const endpoint of ENDPOINTS) {
    if(data[endpoint].length === 0) add('warning','endpoint_empty','No observations; absence does not establish that no events happened.',{endpoint});
    if(expectedCounts && expectedCounts[endpoint] !== counts[endpoint]) add('hard','archive_count_mismatch','Retained source count differs from the published version manifest.',{endpoint,expected:expectedCounts[endpoint],actual:counts[endpoint]});
    if(typed && ['sessions','drivers','laps','stints'].includes(endpoint) && new Set(typed[endpoint].map(r=>key(r,endpoint))).size !== typed[endpoint].length) add('hard','typed_duplicate_key','Duplicate typed natural keys.',{endpoint});
    if(typed && typed[endpoint].length !== counts[endpoint]) add('hard','projection_count_mismatch','Typed/source row counts differ.',{endpoint});
    const seen = new Set<string>();
    data[endpoint].forEach((r,ordinal) => {
      if(!integer(r.session_key) || r.session_key !== sessionKey) add('hard','session_reference_invalid','Missing or wrong source session key.',{endpoint,ordinal});
      if(['sessions','drivers','laps','stints'].includes(endpoint)) {
        const valid = endpoint === 'sessions' || integer(r.driver_number);
        if(!valid || (endpoint === 'laps' && !integer(r.lap_number)) || (endpoint === 'stints' && !integer(r.stint_number))) add('hard','natural_key_invalid','Required source key is missing or invalid.',{endpoint,ordinal});
        const id=key(r,endpoint);if(seen.has(id))add('hard','duplicate_key','Duplicate natural key; never silently combine observations.',{endpoint,ordinal,key:id});seen.add(id);
      }
      if(['laps','stints','pit','race_control'].includes(endpoint) && (['laps','stints'].includes(endpoint) || r.driver_number != null) && !drivers.has(r.driver_number))add('hard','driver_reference_broken','Source driver reference has no session entry.',{endpoint,ordinal,driver_number:r.driver_number});
      if(typed && ['sessions','drivers','laps','stints'].includes(endpoint) && !typed[endpoint].some(t=>key(t,endpoint)===key(r,endpoint)))add('hard','projection_key_mismatch','Source natural key is absent from typed projection.',{endpoint,ordinal});
    });
  }
  if(data.sessions.length !== 1) add('hard','session_count_invalid','A report must describe exactly one source session.');
  const sessionEnd=stamp(data.sessions[0]?.date_end);
  const lastLapEnd=Math.max(...data.laps.map(r => {const start=stamp(r.date_start);return start!==null&&typeof r.lap_duration==='number'&&Number.isFinite(r.lap_duration)&&r.lap_duration>0?start+r.lap_duration*1000:0;}),0);
  const horizon = Math.max(sessionEnd ?? 0,lastLapEnd);
  const windows: Window[]=[]; const active=new Map<string, Window>();
  const controls=data.race_control.map((event,ordinal)=>({event,ordinal,time:stamp(event.date)}));
  for(const {event,ordinal,time} of controls.sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||a.ordinal-b.ordinal)) {
    if(time===null) {add('warning','control_timestamp_missing','Race-control message cannot be assigned by time.',{ordinal,category:event.category});continue;}
    const message=String(event.message??'').toUpperCase();
    const flag=String(event.flag??'').toUpperCase();
    const identity=scopeKey(event);
    const close=(id:string)=>{const w=active.get(id);if(w){w.end=time;w.closure={ordinal,date:event.date,flag:event.flag,message:event.message,scope:event.scope};w.open=false;active.delete(id);}};
    const start=(id:string,kind:string)=>{if(time>=horizon){add('info','control_after_coverage','Event starts after observed session/lap coverage; do not extend it backward.',{ordinal});return;}if(!active.has(id)){const w:Window={kind,start:time,end:horizon,event,ordinal,closure:null,open:true};windows.push(w);active.set(id,w);}};
    // Only recognized category/scope/message combinations change inferred state.
    if(event.category==='SafetyCar') {
      const kind=message.includes('VIRTUAL SAFETY CAR')?'vsc':'safety_car';
      if(/\bDEPLOYED\b/.test(message)) start(kind,kind);
      else if(/\b(?:ENDED|WITHDRAWN)\b/.test(message))close(kind);
      else if(/\b(?:IN THIS LAP|ENDING)\b/.test(message))add('info','neutralization_end_pending','This message does not establish when neutralization ended.',{ordinal,message:event.message});
      else add('warning','unrecognized_safety_car_message','Safety-car state cannot be inferred from this message.',{ordinal,message:event.message});
    }
    if(event.category==='Flag' && flag==='RED' && event.scope==='Track')start('red_flag','red_flag');
    const trackGreen=event.category==='Flag' && event.scope==='Track' && flag==='GREEN' && !/PIT (?:EXIT|ENTRY)|PIT LANE/.test(message);
    const resumed=event.category==='SessionStatus' && /SESSION (?:RESUMED|RESTARTED|STARTED)/.test(message);
    if(trackGreen){close('safety_car');close('vsc');close('red_flag');close('yellow:Track:all');}
    if(resumed)close('red_flag');
    if(event.category==='Flag' && ['YELLOW','DOUBLE YELLOW'].includes(flag)) {
      if(!['Track','Sector','Driver'].includes(String(event.scope)) || (event.scope==='Sector'&&!integer(event.sector)) || (event.scope==='Driver'&&!integer(event.driver_number)))add('warning','yellow_scope_unknown','Yellow scope is missing; keep potential overlap visible.',{ordinal});
      start(`yellow:${identity}`,'yellow');
    }
    if(event.category==='Flag' && ['CLEAR','GREEN'].includes(flag) && !/PIT (?:EXIT|ENTRY)|PIT LANE/.test(message))close(`yellow:${identity}`);
    if(/\bDELETED\b/.test(message) && !/\bCAR \d+\b.*\bLAP \d+\b/.test(message))add('warning','deleted_lap_unresolved','Deletion notice lacks an unambiguous car/lap pair; announcement time is not the affected lap.',{ordinal,message:event.message});
  }
  for(const w of active.values())add('warning','control_window_open','No matching end event. Interval conservatively extends to source session/lap horizon.',{kind:w.kind,ordinal:w.ordinal,end:iso(w.end)});
  const maxLap=Math.max(...data.laps.map(r=>integer(r.lap_number)?r.lap_number:0),0);
  for(const driver of drivers) {
    const laps=data.laps.filter(r=>r.driver_number===driver&&integer(r.lap_number)).sort((a,b)=>Number(a.lap_number)-Number(b.lap_number));
    if(laps.length===0){add('warning','driver_no_laps','No source laps for this entry; absence is not proof of a retirement.',{driver_number:driver});continue;}
    if(laps[0].lap_number!==1)add('warning','leading_laps_missing','First recorded lap is not lap one; do not fabricate missing laps.',{driver_number:driver,first_lap:laps[0].lap_number});
    for(let i=1;i<laps.length;i++)if(Number(laps[i].lap_number)>Number(laps[i-1].lap_number)+1)add('warning','lap_sequence_gap','Interior lap numbers are absent; source gaps, interruptions or driver events may explain them.',{driver_number:driver,after: laps[i-1].lap_number,before:laps[i].lap_number});
    if(Number(laps.at(-1)!.lap_number)<maxLap){const retired=data.race_control.some(e=>e.driver_number===driver&&/\bRETIRED\b/i.test(String(e.message)));add(retired?'info':'warning','driver_coverage_ends_early',retired?'Source reports retirement; fewer recorded laps are not a broken reference.':'Recorded laps end earlier than session maximum; retirement, lapping or missing coverage is unresolved.',{driver_number:driver,last_lap:laps.at(-1)!.lap_number,retirement_observed:retired});}
  }
  for(const [ordinal,s] of data.stints.entries()) {
    if(!integer(s.lap_start)||!integer(s.lap_end)||Number(s.lap_start)>Number(s.lap_end))add('warning','stint_bounds_invalid','Missing, reversed or incomplete stint range; do not coerce to lap zero.',{ordinal,driver_number:s.driver_number,lap_start:s.lap_start??null,lap_end:s.lap_end??null});
    if(s.compound==null)add('warning','stint_compound_missing','Tyre compound is unknown.',{ordinal});
  }
  for(const driver of drivers) {
    const ranges=data.stints.filter(s=>s.driver_number===driver&&integer(s.lap_start)&&integer(s.lap_end)&&Number(s.lap_start)<=Number(s.lap_end)).sort((a,b)=>Number(a.lap_start)-Number(b.lap_start));
    for(let i=1;i<ranges.length;i++) {
      if(Number(ranges[i].lap_start)<=Number(ranges[i-1].lap_end))add('warning','stint_boundary_overlap','Inclusive ranges overlap; do not choose a tyre stint silently.',{driver_number:driver,previous_stint:ranges[i-1].stint_number,next_stint:ranges[i].stint_number});
      else if(Number(ranges[i].lap_start)>Number(ranges[i-1].lap_end)+1)add('warning','stint_boundary_gap','Stint ranges leave uncovered lap numbers; missing source records may be legitimate.',{driver_number:driver});
    }
  }
  for(const [ordinal,pit] of data.pit.entries()) {
    const lap=data.laps.find(l=>l.driver_number===pit.driver_number&&l.lap_number===pit.lap_number);
    if(!lap)add('warning','pit_lap_missing','Pit event has no matching source lap record; do not create a lap.',{ordinal,driver_number:pit.driver_number,lap_number:pit.lap_number??null});
    else {const t=stamp(pit.date),start=stamp(lap.date_start),d=lap.lap_duration;
      if(t!==null&&start!==null&&typeof d==='number'&&d>0&&(t<start-BOUNDARY_MS||t>=start+d*1000+BOUNDARY_MS))add('warning','pit_lap_time_disagreement','Pit lap number and approximate lap interval disagree; both remain inspectable.',{ordinal});
    }
  }
  for(const endpoint of ['pit','race_control'] as const){const signatures=data[endpoint].map(r=>JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b)))));const duplicates=signatures.length-new Set(signatures).size;
    if(duplicates)add('info','repeated_event_objects','Identical event occurrences are retained; repetition is not a natural-key integrity failure.',{endpoint,duplicates});}
  const assessments: Assessment[]=data.laps.map((lap,ordinal)=>{
    const exclusions:string[]=[],warnings:string[]=[],evidence:Row[]=[];
    const duration=typeof lap.lap_duration==='number'&&Number.isFinite(lap.lap_duration)?lap.lap_duration:null;
    if(lap.lap_duration==null){exclusions.push('duration_missing');add('warning','duration_missing','Missing duration is unknown, never zero.',{ordinal});}
    else if(duration===null||duration<=0){exclusions.push('duration_invalid');add('hard','duration_invalid','Duration must be a finite positive number for analysis; source zero is retained as zero.',{ordinal,value:lap.lap_duration});}
    if(lap.lap_number===1)exclusions.push('race_start_lap');
    if(lap.is_pit_out_lap===true){exclusions.push('pit_out_lap');evidence.push({endpoint:'laps',ordinal,field:'is_pit_out_lap',value:true});}
    else if(lap.is_pit_out_lap!==false) {exclusions.push('pit_out_status_unknown');warnings.push('pit_out_status_unknown');}
    const start=stamp(lap.date_start);let end=start!==null&&duration!==null&&duration>0?start+duration*1000:null;
    let intervalSource:Assessment['interval_source']=end===null?'unavailable':'duration';
    const next=data.laps.find(r=>r.driver_number===lap.driver_number&&r.lap_number===Number(lap.lap_number)+1);
    const nextStart=stamp(next?.date_start);
    if(end===null&&start!==null&&nextStart!==null&&nextStart>start){end=nextStart;intervalSource='estimated_next_start';warnings.push('interval_end_estimated');}
    if(start===null||end===null){exclusions.push('lap_interval_unknown');warnings.push('control_mapping_unavailable');}
    if(start!==null&&nextStart!==null&&nextStart<=start){warnings.push('nonmonotonic_lap_start');exclusions.push('lap_timing_inconsistent');add('warning','lap_time_discontinuity','Consecutive lap starts are not increasing.',{ordinal});}
    if(end!==null&&nextStart!==null&&end>nextStart+BOUNDARY_MS){warnings.push('lap_interval_overlap');exclusions.push('lap_timing_inconsistent');add('warning','lap_time_discontinuity','Duration-derived lap interval overlaps the next lap by more than the review buffer.',{ordinal});}
    if(end!==null&&nextStart!==null&&nextStart>end+BOUNDARY_MS)add('warning','lap_time_gap','Time between consecutive lap intervals may reflect a pause, pit activity or approximate source timestamps.',{ordinal,gap_seconds:(nextStart-end)/1000});
    for(const [pitOrdinal,p] of data.pit.entries())if(p.driver_number===lap.driver_number){
      const date=stamp(p.date);const numberMatch=p.lap_number===lap.lap_number;
      const timeMatch=start!==null&&end!==null&&date!==null&&date>=start-BOUNDARY_MS&&date<end+BOUNDARY_MS;
      if(numberMatch||timeMatch){exclusions.push(numberMatch?'pit_event_lap':'pit_event_time_overlap');evidence.push({endpoint:'pit',ordinal:pitOrdinal,match:numberMatch?'source_lap_number':'approximate_time',date:p.date??null,source_lap:p.lap_number??null});}
    }
    let neutral=false,yellow=false,possible=false;
    if(start!==null&&end!==null)for(const w of windows){
      if(w.event.scope==='Driver'&&integer(w.event.driver_number)&&w.event.driver_number!==lap.driver_number)continue;
      const strict=start<w.end&&end>w.start;
      const padded=start-BOUNDARY_MS<w.end&&end+BOUNDARY_MS>w.start;
      if(!padded)continue;
      const boundary=Math.abs(start-w.start)<=BOUNDARY_MS||Math.abs(end-w.start)<=BOUNDARY_MS||Math.abs(start-w.end)<=BOUNDARY_MS||Math.abs(end-w.end)<=BOUNDARY_MS;
      evidence.push({endpoint:'race_control',ordinal:w.ordinal,kind:w.kind,start:iso(w.start),end:iso(w.end),closure:w.closure,scope:w.event.scope??null,sector:w.event.sector??null,open:w.open,match:strict?'interval_overlap':'boundary_buffer'});
      if(boundary)warnings.push('control_boundary_uncertain');
      if(w.kind==='yellow'){yellow=true;warnings.push(w.event.scope==='Sector'?'sector_yellow_possible_overlap':'yellow_flag_overlap');exclusions.push('yellow_warning_policy');}
      else if(strict){neutral=true;exclusions.push(`${w.kind}_overlap`);}
      else {possible=true;exclusions.push('neutralization_boundary_possible');}
    }
    for(const {event,ordinal:eventOrdinal,time} of controls){
      if(event.category==='Flag'&&event.flag==='BLUE'&&event.driver_number===lap.driver_number&&start!==null&&end!==null&&time!==null&&time>=start&&time<end){warnings.push('driver_blue_flag');evidence.push({endpoint:'race_control',ordinal:eventOrdinal,flag:'BLUE'});}
      const deleted=String(event.message??'').match(/\bCAR (\d+)\b.*\bDELETED\b.*\bLAP (\d+)\b/i);
      if(deleted&&Number(deleted[1])===lap.driver_number&&Number(deleted[2])===lap.lap_number){exclusions.push('lap_time_deleted_notice');evidence.push({endpoint:'race_control',ordinal:eventOrdinal,match:'explicit_message_car_lap',announcement_date:event.date??null});}
    }
    const stints=data.stints.filter(s=>s.driver_number===lap.driver_number&&integer(s.lap_start)&&integer(s.lap_end)&&Number(s.lap_start)<=Number(lap.lap_number)&&Number(s.lap_end)>=Number(lap.lap_number));
    if(stints.length!==1){warnings.push(stints.length===0?'stint_unmatched':'stint_ambiguous');add('warning',stints.length===0?'stint_unmatched':'stint_ambiguous','Inclusive stint ranges do not assign this lap to exactly one stint.',{ordinal,matches:stints.length});}
    else evidence.push({endpoint:'stints',stint_number:stints[0].stint_number,lap_start:stints[0].lap_start,lap_end:stints[0].lap_end});
    return {source_ordinal:ordinal,driver_number:integer(lap.driver_number)?lap.driver_number:null,lap_number:integer(lap.lap_number)?lap.lap_number:null,lap_duration:duration,interval_start:iso(start),interval_end:iso(end),interval_source:intervalSource,
      exclusions:[...new Set(exclusions)],warnings:[...new Set(warnings)],evidence,pace_candidate:exclusions.length===0,stint_candidate:exclusions.length===0&&stints.length===1&&stints[0].compound!=null,
      control_state:start===null||end===null?'unmappable':neutral?'neutralized_overlap':yellow?'yellow_warning':possible?'possible_interruption':'no_known_interruption',green_flag_status:'not_established'};
  });
  const hard=findings.filter(f=>f.severity==='hard').length;
  if(hard)for(const a of assessments){a.pace_candidate=false;a.stint_candidate=false;a.exclusions.push('dataset_integrity_failure');}
  const frequency=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(v=>v===value).length]));
  return {quality_version:QUALITY_VERSION,policy:{boundary_review_ms:BOUNDARY_MS,green_flag_certification:false,yellow_excluded:true,raw_history_modified:false},
    counts,summary:{hard_findings:hard,warning_findings:findings.filter(f=>f.severity==='warning').length,lap_rows:assessments.length,pace_candidates:assessments.filter(a=>a.pace_candidate).length,stint_candidates:assessments.filter(a=>a.stint_candidate).length,
    excluded_laps:assessments.filter(a=>!a.pace_candidate).length,exclusion_counts:frequency(assessments.flatMap(a=>a.exclusions)),warning_counts:frequency(assessments.flatMap(a=>a.warnings)),control_states:frequency(assessments.map(a=>a.control_state))},
    findings,control_windows:windows.map(w=>({...w,start:iso(w.start),end:iso(w.end)})),laps:assessments};
}
