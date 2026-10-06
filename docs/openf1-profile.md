# OpenF1 investigation profile

Generated: 2026-10-06T02:49:24.656Z

Selected: Las Vegas, session 9644; drivers 1, 4.

Two drivers, at most 100 laps each. Coverage probes use laps 1–5 for all drivers. Low-volume drivers/stints/pit/race_control are whole-session responses, not guaranteed complete source coverage.

## Candidate access and coverage

| Session | Circuit | drivers | laps 1–5 | stints | pit | race_control | Passed |
|---|---|---:|---:|---:|---:|---:|---|
| 9644 | Las Vegas | 20 | 100 | 59 | 39 | 37 | true |
| 9655 | Lusail | 20 | 92 | 82 | 60 | 112 | true |
| 9662 | Yas Marina Circuit | 20 | 96 | 48 | 28 | 131 | true |

Nonempty endpoint responses establish access and observed coverage, not completeness.

## drivers: 20 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| broadcast_name | string | 0 | 0 | 0 | "M VERSTAPPEN"; "L NORRIS"; "P GASLY" |
| country_code | string | 0 | 0 | 0 | "NED"; "GBR"; "FRA" |
| driver_number | number | 0 | 0 | 0 | 1; 4; 10 |
| first_name | string | 0 | 0 | 0 | "Max"; "Lando"; "Pierre" |
| full_name | string | 0 | 0 | 0 | "Max VERSTAPPEN"; "Lando NORRIS"; "Pierre GASLY" |
| headshot_url | null, string | 0 | 2 | 0 | "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png"; "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png"; "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png" |
| last_name | string | 0 | 0 | 0 | "Verstappen"; "Norris"; "Gasly" |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| name_acronym | string | 0 | 0 | 0 | "VER"; "NOR"; "GAS" |
| session_key | number | 0 | 0 | 0 | 9644 |
| team_colour | string | 0 | 0 | 0 | "3671C6"; "FF8000"; "0093cc" |
| team_name | string | 0 | 0 | 0 | "Red Bull Racing"; "McLaren"; "Alpine" |

## laps: 100 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| date_start | string | 0 | 0 | 0 | "2024-11-24T06:03:40.010000+00:00"; "2024-11-24T06:05:26.379000+00:00"; "2024-11-24T06:07:06.185000+00:00" |
| driver_number | number | 0 | 0 | 0 | 1; 4 |
| duration_sector_1 | null, number | 0 | 1 | 0 | 34.923; 29.082; 28.787 |
| duration_sector_2 | number | 0 | 0 | 0 | 34.022; 33.747; 33.51 |
| duration_sector_3 | number | 0 | 0 | 0 | 37.425; 37.032; 37.048 |
| i1_speed | null, number | 0 | 15 | 0 | 173; 177; 176 |
| i2_speed | null, number | 0 | 1 | 0 | 204; 205; 201 |
| is_pit_out_lap | boolean | 0 | 0 | 0 | false; true |
| lap_duration | number | 0 | 0 | 0 | 106.37; 99.861; 99.345 |
| lap_number | number | 0 | 0 | 0 | 1; 2; 3 |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| segments_sector_1 | array | 0 | 0 | 0 | [null,2049,2049,2049,2049,2049]; [2049,2049,2049,2049,2049,2049]; [2048,2049,2049,2049,2049,2049] |
| segments_sector_2 | array | 0 | 0 | 0 | [2049,2049,2049,2049,2049,2049,2049]; [2048,2049,2048,2048,2049,2049,2049]; [2049,2049,2049,2049,2048,2048,2048] |
| segments_sector_3 | array | 0 | 0 | 0 | [2049,2049,2049,2049,2049,2049,2049,2051]; [2048,2049,2048,2048,2049,2048,2048,2048]; [2049,2049,2049,2049,2049,2048,2048] |
| session_key | number | 0 | 0 | 0 | 9644 |
| st_speed | number | 0 | 0 | 0 | 269; 276; 278 |

## stints: 59 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| compound | string | 0 | 0 | 0 | "HARD"; "MEDIUM"; "SOFT" |
| driver_number | number | 0 | 0 | 0 | 77; 63; 1 |
| lap_end | number | 0 | 0 | 0 | 17; 12; 11 |
| lap_start | number | 0 | 0 | 0 | 1; 5; 10 |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| session_key | number | 0 | 0 | 0 | 9644 |
| stint_number | number | 0 | 0 | 0 | 1; 2; 3 |
| tyre_age_at_start | number | 0 | 0 | 48 | 0; 1; 4 |

## pit: 39 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| date | string | 0 | 0 | 0 | "2024-11-24T06:10:57.685000+00:00"; "2024-11-24T06:19:06.266000+00:00"; "2024-11-24T06:19:07.617000+00:00" |
| driver_number | number | 0 | 0 | 0 | 14; 16; 4 |
| lane_duration | number | 0 | 0 | 0 | 21.407; 21.329; 21.194 |
| lap_number | number | 0 | 0 | 0 | 4; 9; 10 |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| pit_duration | number | 0 | 0 | 0 | 21.407; 21.329; 21.194 |
| session_key | number | 0 | 0 | 0 | 9644 |
| stop_duration | null, number | 0 | 1 | 0 | 2.6; 2.5; 3.3 |

## race_control: 37 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| category | string | 0 | 0 | 0 | "Other"; "Flag"; "Drs" |
| date | string | 0 | 0 | 0 | "2024-11-24T05:10:02+00:00"; "2024-11-24T05:20:01+00:00"; "2024-11-24T05:30:01+00:00" |
| driver_number | null, number | 0 | 32 | 0 | 77 |
| flag | null, string | 0 | 27 | 0 | "GREEN"; "BLUE"; "CHEQUERED" |
| lap_number | number | 0 | 0 | 0 | 1; 2; 3 |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| message | string | 0 | 0 | 0 | "PINK HEAD PADDING MATERIAL MUST BE USED"; "GREEN LIGHT - PIT EXIT OPEN"; "PIT EXIT CLOSED" |
| qualifying_phase | null | 0 | 37 | 0 |  |
| scope | null, string | 0 | 27 | 0 | "Track"; "Driver"; "Sector" |
| sector | null, number | 0 | 35 | 0 | 6 |
| session_key | number | 0 | 0 | 0 | 9644 |

## sessions: 1 rows

| Field | Observed types | Absent | Null | Zero | Examples |
|---|---|---:|---:|---:|---|
| circuit_key | number | 0 | 0 | 0 | 152 |
| circuit_short_name | string | 0 | 0 | 0 | "Las Vegas" |
| country_code | string | 0 | 0 | 0 | "USA" |
| country_key | number | 0 | 0 | 0 | 19 |
| country_name | string | 0 | 0 | 0 | "United States" |
| date_end | string | 0 | 0 | 0 | "2024-11-24T07:59:59+00:00" |
| date_start | string | 0 | 0 | 0 | "2024-11-24T06:00:00+00:00" |
| gmt_offset | string | 0 | 0 | 0 | "-08:00:00" |
| is_cancelled | boolean | 0 | 0 | 0 | false |
| location | string | 0 | 0 | 0 | "Las Vegas" |
| meeting_key | number | 0 | 0 | 0 | 1250 |
| session_key | number | 0 | 0 | 0 | 9644 |
| session_name | string | 0 | 0 | 0 | "Race" |
| session_type | string | 0 | 0 | 0 | "Race" |
| year | number | 0 | 0 | 0 | 2024 |

## Candidate keys and join checks

```json
{
  "keys": {
    "laps": {
      "fields": [
        "session_key",
        "driver_number",
        "lap_number"
      ],
      "missing": 0,
      "duplicates": 0
    },
    "drivers": {
      "fields": [
        "session_key",
        "driver_number"
      ],
      "missing": 0,
      "duplicates": 0
    },
    "stints": {
      "fields": [
        "session_key",
        "driver_number",
        "stint_number"
      ],
      "missing": 0,
      "duplicates": 0
    },
    "pit": {
      "fields": [
        "session_key",
        "driver_number",
        "date"
      ],
      "missing": 0,
      "duplicates": 0
    },
    "race_control": {
      "fields": [
        "session_key",
        "date",
        "category",
        "message"
      ],
      "missing": 0,
      "duplicates": 0
    }
  },
  "joins": {
    "lapDriverOrphans": 0,
    "lapStintMatches": {
      "1": 100
    }
  },
  "observations": {
    "raceControlCategories": {
      "Drs": 2,
      "Flag": 10,
      "Other": 23,
      "SessionStatus": 2
    },
    "raceControlScopes": {
      "Driver": 5,
      "Sector": 2,
      "Track": 3,
      "null": 27
    },
    "raceControlDateRange": [
      "2024-11-24T05:10:02+00:00",
      "2024-11-24T07:30:35+00:00"
    ],
    "raceControlInvalidDates": 0,
    "pitLaneAliasMismatches": 0
  }
}
```

Lap grain: one driver’s numbered lap within one session. Candidate key: session_key + driver_number + lap_number; uniqueness here is a sample observation.
Join laps to drivers on session_key + driver_number; to stints on those keys plus inclusive lap_start/lap_end. Pit lap_number is an event association, not an automatic exclusion rule.
Race-control date is a UTC message timestamp. Preserve category, scope and nullable driver/lap/sector fields; one timestamp can have multiple messages. Do not assume every message targets every driver.

## Semantics and limits

[Official documentation](https://openf1.org/docs/): lane_duration is pit-lane time in seconds; deprecated pit_duration is its alias. stop_duration is stationary stop time, documented from the 2024 US GP onward. Missing is not zero.
Lap date_start is approximate. Recorded lap times do not establish fuel load, traffic effect, driver intent, tyre degradation causality or counterfactual outcomes. Do not fill missing values silently.
Raw payloads and URL/retrieval-time/SHA-256 provenance are retained in the run directory. Re-running creates a new run rather than overwriting evidence.
