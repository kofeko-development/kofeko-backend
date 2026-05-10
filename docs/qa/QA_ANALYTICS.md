# QA — Analytics + Audit Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 9dcace3  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 9.1 | Summary | all keys present | present | PASS | `totalJobs=2`, `openJobs=1`, `aiEvaluations=1`, `hiredCandidates=1`. |
| 9.2 | Verify openJobs count | matches DB | matches | PASS | One job open (job1), one closed (job2). |
| 9.3 | Verify aiEvaluations count | matches aiGenerated evals | matches | PASS | `aiEvaluations=1`. |
| 9.4 | Pipeline funnel | all 7 stage keys present | present | PASS | `hired=1` in this dataset. |
| 9.5 | Funnel filtered by jobId | only that job distribution | filtered | PASS | `jobId=139fb95f-...` returned `hired=1`. |
| 9.6 | Time to decision | number or null | number | PASS | Returned `0` (very fast test progression). |
| 9.7 | Score distribution | 4 buckets present | present | PASS | Buckets returned: `0-49`, `50-69`, `70-84`, `85-100`. |
| 9.8 | Recent activity | limit=5 newest first with actorName | 5 items + actorName | PASS | Items include `ai_evaluate` and pipeline stage updates. |
| 9.9 | Hiring velocity | exactly 6 items includes zero months | 6 items | PASS | Returned 6 months with `2026-05 hired=1`. |
| 9.10 | Audit logs list | paginated newest first | paginated | PASS | Returned 12 items. |
| 9.11 | Filter by entityType=job | only job audits | only job | PASS | Returned job `create/update` entries. |
| 9.12 | Filter by action=ai_evaluate | only AI eval audits | only ai_evaluate | PASS | Returned 1 entry with `metadata.aiGenerated=true`. |
| 9.13 | Get single audit log | full entry | full entry | PASS | `GET /audit/logs/:id` returned audit details + metadata. |
| 9.14 | Tenant isolation | cannot see other tenant logs | isolated | PASS | Second tenant querying first tenantId returned empty list. |
| 9.15 | Interviewer access | interviewer token forbidden | 403 | PASS | Analytics summary blocked with `403 Forbidden`. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-ana-20260507155303`

- **Summary 9.1 (snippet)**:

```json
{"success":true,"data":{"totalJobs":2,"openJobs":1,"totalCandidates":1,"totalEvaluations":1,"aiEvaluations":1}}
```

- **Score distribution 9.7 (snippet)**:

```json
{"success":true,"data":{"0-49":1,"50-69":0,"70-84":0,"85-100":0}}
```

- **Interviewer forbidden 9.15 (snippet)**:

```json
{"success":false,"message":"Forbidden","errorCode":"FORBIDDEN","statusCode":403}
```

## Verdict: PASS

Commit: `qa: analytics module testing complete [pass]`

