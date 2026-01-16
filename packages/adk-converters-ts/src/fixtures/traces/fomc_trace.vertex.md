# FOMC Research Agent: Converter Snapshot

> This document shows how our converters transform real Vertex AI API data.
> Each step links to a detailed file showing the full conversion.

## Trace Overview

| Property | Value |
|----------|-------|
| Total API Calls | 22 |
| Unique Models | gemini-3-flash-preview |
| Unique Agents | root_agent, retrieve_meeting_data_agent, extract_page_data_agent, research_agent, summarize_meeting_agent, analysis_agent |
| Total Prompt Tokens | 284,165 |
| Total Completion Tokens | 3,008 |

## Conversion Flow

```
Vertex AI JSON (wire format)
       ↓
  vertexRequestToProto()
       ↓
GenerateContentRequest (proto)
       ↓
  protoToLlmRequest()
       ↓
   LlmRequest (ADK format)
```

## API Calls

| # | Agent | Contents | Tools | Tokens | Details |
|---|-------|----------|-------|--------|---------|
| 1 | root_agent | 1 | 2 | 587→27 | [step-01.md](fomc_trace.vertex/step-01.md) |
| 2 | root_agent | 3 | 2 | 617→19 | [step-02.md](fomc_trace.vertex/step-02.md) |
| 3 | retrieve_meeting_data_agent | 5 | 3 | 1166→46 | [step-03.md](fomc_trace.vertex/step-03.md) |
| 4 | retrieve_meeting_data_agent | 7 | 3 | 1215→287 | [step-04.md](fomc_trace.vertex/step-04.md) |
| 5 | extract_page_data_agent | 1 | 1 | 45338→182 | [step-05.md](fomc_trace.vertex/step-05.md) |
| 6 | extract_page_data_agent | 3 | 1 | 45523→0 | [step-06.md](fomc_trace.vertex/step-06.md) |
| 7 | retrieve_meeting_data_agent | 9 | 3 | 1506→158 | [step-07.md](fomc_trace.vertex/step-07.md) |
| 8 | extract_page_data_agent | 1 | 1 | 45215→182 | [step-08.md](fomc_trace.vertex/step-08.md) |
| 9 | extract_page_data_agent | 3 | 1 | 45400→216 | [step-09.md](fomc_trace.vertex/step-09.md) |
| 10 | retrieve_meeting_data_agent | 11 | 3 | 1884→60 | [step-10.md](fomc_trace.vertex/step-10.md) |
| 11 | retrieve_meeting_data_agent | 13 | 3 | 1947→72 | [step-11.md](fomc_trace.vertex/step-11.md) |
| 12 | extract_page_data_agent | 1 | 1 | 18809→42 | [step-12.md](fomc_trace.vertex/step-12.md) |
| 13 | extract_page_data_agent | 3 | 1 | 18854→46 | [step-13.md](fomc_trace.vertex/step-13.md) |
| 14 | retrieve_meeting_data_agent | 15 | 3 | 2069→46 | [step-14.md](fomc_trace.vertex/step-14.md) |
| 15 | research_agent | 17 | 5 | 2308→60 | [step-15.md](fomc_trace.vertex/step-15.md) |
| 16 | research_agent | 19 | 5 | 2371→31 | [step-16.md](fomc_trace.vertex/step-16.md) |
| 17 | research_agent | 21 | 5 | 2405→42 | [step-17.md](fomc_trace.vertex/step-17.md) |
| 18 | summarize_meeting_agent | 23 | 2 | 16266→335 | [step-18.md](fomc_trace.vertex/step-18.md) |
| 19 | summarize_meeting_agent | 25 | 2 | 16604→70 | [step-19.md](fomc_trace.vertex/step-19.md) |
| 20 | research_agent | 27 | 5 | 2962→38 | [step-20.md](fomc_trace.vertex/step-20.md) |
| 21 | research_agent | 29 | 5 | 3007→48 | [step-21.md](fomc_trace.vertex/step-21.md) |
| 22 | analysis_agent | 31 | 1 | 8112→1001 | [step-22.md](fomc_trace.vertex/step-22.md) |


## Tools Available

- `compare_statements_tool`
- `compute_rate_move_probability_tool`
- `extract_page_data_agent`
- `fetch_page_tool`
- `fetch_transcript_tool`
- `store_state_tool`
- `transfer_to_agent`
