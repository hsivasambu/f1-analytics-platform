# Initial product questions — proposed, not implemented

Likely primary source: [OpenF1 official documentation](https://openf1.org/docs/), whose historical data is documented as available from 2023 without authentication. Endpoints below use `https://api.openf1.org/v1/` and a fixed `session_key`; never `latest`. Validate coverage before selecting races. Shared discovery endpoints: `meetings`, `sessions`, `drivers`.

| Question | Likely endpoints | Proposed tables | Proposed calculation and chart |
| --- | --- | --- | --- |
| How does pace compare on matched race laps? | `laps` | `race_sessions`, `drivers`, `laps`, `lap_exclusions` | Inner join eligible drivers on session and lap number; signed lap-time difference and aggregate over the same sample. Line chart with sample count and accessible data table. |
| How does pace vary across tyre stints? | `laps`, `stints` | `laps`, `stints`, `lap_exclusions` | Join documented stint boundaries to laps; group eligible pace by driver/stint and show compound, stint length and sample count. Lap-time line chart segmented by stint. Do not infer causal tyre degradation. |
| When did pit events occur? | `pit`, `laps`, `stints` | `pit_events`, `laps`, `stints` | Align recorded event timestamps/lap references with driver laps. Pit-event timeline with source-specific duration labels; pit-lane duration must not be called stationary service time. |
| Where do lap times change significantly? | `laps`, `race_control`, optionally `weather` | `laps`, `race_control_events`, optional `weather_observations` | Adjacent eligible lap differences and an explicitly defined threshold. Change plot with event annotations. A nearby event is context, not proven cause; missing prior laps must not be treated as adjacent. |
| How do exclusions affect a comparison? | `laps`, `pit`, `race_control`, `stints` | `laps`, `lap_exclusions`, `pit_events`, `race_control_events` | Recompute the same matched-lap metric with named filter sets; display retained/excluded counts and before/after chart. Missing or uncertain flags remain visible. |

Potential cross-check: [Jolpica endpoint documentation](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md), including `/ergast/f1/{season}/{round}/laps/`, `/pitstops/` and `/results/`. It is not a substitute for tyre compound/stint records. Do not silently merge sources: source identifiers, units and event meanings require reconciliation. No endpoint has been called for race ingestion in Stage 1.
