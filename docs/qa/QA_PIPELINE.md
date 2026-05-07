# QA — Pipeline Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 1d62cb9  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 6.1 | Add candidate to open job | 201, stage applied | 201, stage `applied` | PASS | Created pipeline `b4a039ae-a33d-49b0-8c26-d69cfc8f22c7`. |
| 6.2 | Add same candidate again | 409 already in pipeline | 409 | PASS | Response: `Candidate is already in this job's pipeline`. |
| 6.3 | Add to draft job | 400 job not open | 400 | PASS | Response: `Job must be open to create a pipeline`. |
| 6.4 | List pipelines by job | shows candidate info | 200 paginated | PASS | Includes nested `candidate` (name/email) + `job.title`. |
| 6.5 | Get pipeline by ID | full record | 200 | PASS | Returned pipeline with nested `candidate` + `job`. |
| 6.6 | Advance to screening | 200, candidate status updates | 200 | PASS | Stage became `screening`. |
| 6.7 | Illegal skip | 400 with allowed options | 400 | PASS | Message includes allowed transitions. |
| 6.8 | Advance to technical_interview | 200 | 200 | PASS | Stage became `technical_interview`. |
| 6.9 | Advance to hr_interview | 200 | 200 | PASS | Stage became `hr_interview`. |
| 6.10 | Advance to offer | 200 | 200 | PASS | Stage became `offer`. |
| 6.11 | Advance to hired | 200 | 200 | PASS | Stage became `hired`. |
| 6.12 | Advance from hired | 400 terminal | 400 | PASS | Message: `Pipeline is already hired - no further transitions allowed`. |
| 6.13 | Assign interviewer | 200 assignedTo set | 200 | PASS | `assignedTo` set to interviewer user id. |
| 6.14 | Set SLA past date | 400 | 400 | PASS | Message: `SLA deadline must be in the future`. |
| 6.15 | Set SLA future date | 200 | 200 | PASS | `slaDeadline` set. |
| 6.16 | List by candidateId | shows jobs applied | 200 paginated | PASS | Returned pipeline entry for candidate. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-pipe-20260507152353`

- **Illegal transition 6.7 (snippet)**:

```json
{"success":false,"message":"Invalid transition: screening → hired. Allowed: technical_interview, hr_interview, rejected","errorCode":"VALIDATION_ERROR","statusCode":400}
```

- **Advance from hired blocked 6.12 (snippet)**:

```json
{"success":false,"message":"Pipeline is already hired — no further transitions allowed","errorCode":"VALIDATION_ERROR","statusCode":400}
```

## Verdict: PASS

Commit: `qa: pipeline module testing complete [pass]`

