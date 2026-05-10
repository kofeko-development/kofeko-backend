# QA — Jobs Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 7785625  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 4.1 | Create job with skillWeights | 201, status draft | 201, status `draft` | PASS | Created job `6770b0fd-a760-4955-a6fd-d0175514d04e` with skillWeights. |
| 4.2 | Get job | 200, skillWeights intact | 200 | PASS | `GET /api/v1/jobs/:id` returned skillWeights unchanged. |
| 4.3 | List jobs | 200 paginated | 200 paginated | PASS | Shape: `data.items[]`, `data.total/page/limit/totalPages`. |
| 4.4 | Filter by status | only draft jobs | only `draft` jobs | PASS | `GET /api/v1/jobs?status=draft` returned the created job. |
| 4.5 | Filter by department | filtered results | filtered results | PASS | `GET /api/v1/jobs?department=Engineering` returned the created job. |
| 4.6 | Update job (skillWeights replaced) | 200, weights replaced | 200, weights replaced | PASS | Updated skillWeights to include `TypeScript` and React weight=10. |
| 4.7 | Publish job | 200, status open | 200, status `open` | PASS | Response message: `Job published successfully`. |
| 4.8 | Pause job | 200, status paused | 200, status `paused` | PASS | Response message: `Job paused successfully`. |
| 4.9 | Publish paused job | 200, status open | 200, status `open` | PASS | Re-publish worked from `paused`. |
| 4.10 | Close job | 200, status closed | 200, status `closed` | PASS | Response message: `Job closed successfully`. |
| 4.11 | Publish closed job | 400 terminal state | 400 | PASS | Response: `Closed jobs cannot be reopened`. |
| 4.12 | Update closed job | 400 blocked | 400 | PASS | Response: `Closed jobs cannot be updated`. |
| 4.13 | Interviewer tries to create job | 403 forbidden | 403 | PASS | Interviwer token blocked with `Forbidden`. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-jobs-20260507145059`
- **Create job 4.1 (snippet)**:

```json
{"success":true,"message":"Job created successfully","data":{"id":"6770b0fd-a760-4955-a6fd-d0175514d04e","status":"draft","skillWeights":[{"skill":"React","weight":9},{"skill":"Node.js","weight":8}]}}
```

- **Publish closed job 4.11 (snippet)**:

```json
{"success":false,"message":"Closed jobs cannot be reopened","errorCode":"VALIDATION_ERROR","statusCode":400}
```

- **Interviewer create job forbidden 4.13 (snippet)**:

```json
{"success":false,"message":"Forbidden","errorCode":"FORBIDDEN","statusCode":403}
```

## Verdict: PASS

Commit: `qa: jobs module testing complete [pass]`

