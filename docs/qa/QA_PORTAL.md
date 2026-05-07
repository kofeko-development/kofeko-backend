# QA — Candidate Portal Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 0e63be5  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 11.1 | Browse open jobs (no auth) | 200 list | 200 | PASS | `GET /portal/:tenantSlug/jobs` returned 1 open job. |
| 11.2 | No skillWeights in portal job response | skillWeights absent | absent | PASS | Keys include `title, department, description...` (no `skillWeights`). |
| 11.3 | Get single open job (no auth) | 200 | 200 | PASS | `GET /portal/:tenantSlug/jobs/:jobId` OK. |
| 11.4 | Get closed job (no auth) | 404 | 404 | PASS | Message: `Job not found`. |
| 11.5 | Register candidate | 201 + welcome email | 201 + welcome email | PASS | Candidate created; MailHog subject: `Welcome to QA Portal Tenant's hiring portal`. |
| 11.6 | Register duplicate email | 409 | 409 | PASS | Message: `Candidate with this email already exists`. |
| 11.7 | Register on suspended tenant | 403 | 403 | PASS | Message: `This account has been suspended. Contact support.` |
| 11.8 | Login candidate | 200 tokens | 200 | PASS | `POST /portal/auth/loginCandidate` returned access+refresh. |
| 11.9 | Candidate token on staff route | 403 | 403 | PASS | Message: `Candidate tokens are not valid on staff routes`. |
| 11.10 | Staff token on portal route | 403 | 403 | PASS | Message: `Staff tokens are not valid on candidate routes`. |
| 11.11 | Get own profile | 200 | 200 | PASS | `GET /portal/auth/me` returned candidate profile. |
| 11.12 | Apply to open job | 201 pipeline created | 201 | PASS | Returned `pipelineId` and stage `applied`. |
| 11.13 | Apply twice | 409 | 409 | PASS | Message: `You have already applied to this job`. |
| 11.14 | Apply to closed job | 400 | 400 | PASS | Message: `Job is not open for applications`. |
| 11.15 | View applications | list with job title + stage | 200 paginated | PASS | Returned `items[]` with `pipelineId`, `job`, `stage`. |
| 11.16 | Stage updated by recruiter | portal reflects new stage | reflected | PASS | After staff advanced pipeline to `screening`, portal list shows `stage=screening`. |
| 11.17 | Update profile | 200 updates | 200 | PASS | Updated `location` + `skills`. |
| 11.18 | Change email via portal | 400 not allowed | 400 | PASS | Strict schema rejects `email` field (`Unrecognized key: "email"`). |
| 11.19 | Staff sees portal application | visible in pipelines list | visible | PASS | `GET /pipelines?jobId=...` returned pipeline with candidate email. |
| 11.20 | Refresh candidate token | new access token | 200 | PASS | `POST /portal/auth/refresh` returned `{ accessToken }`. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-portal-20260507162819`

- **Apply 11.12 (snippet)**:

```json
{"success":true,"message":"Application submitted","data":{"pipelineId":"7ccf7ca2-c3c0-4103-89c3-5b9e1c52e272","stage":"applied"}}
```

- **Email update blocked 11.18 (snippet)**:

```json
{"success":false,"message":"Validation failed","errorCode":"VALIDATION_ERROR","statusCode":400}
```

## Verdict: PASS

Commit: `qa: portal module testing complete [pass]`

