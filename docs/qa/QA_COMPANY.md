# QA — Company Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 19225b3  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 3.1 | Create company | 201 | 201 | PASS | `POST /api/v1/company` → `Company registered successfully`, company id `e570c79d-8a08-4558-b97c-662a0389cc26`. |
| 3.2 | Create company again | 409 already exists | 409 | PASS | Response: `Company already exists for tenant`. |
| 3.3 | Get company | 200 | 200 | PASS | `GET /api/v1/company` returned tenant + company profile. |
| 3.4 | Update company | 200 updated | 200 updated | PASS | Updated `shortDescription`. |
| 3.5 | Get company without auth | 401 | 401 | PASS | Response: `Missing or invalid authorization header`. |
| 3.6 | HR manager updates company | 200 (has permission) | 200 | PASS | HR token successfully updated company profile. |
| 3.7 | Recruiter updates company | 403 forbidden | 403 | PASS | Recruiter token blocked with `Forbidden`. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-company-20260507144415`
- **Create company 3.1 (snippet)**:

```json
{"success":true,"message":"Company registered successfully","data":{"tenant":{"id":"8cc65969-1227-47b2-8e33-9894b9922ef2","slug":"qa-company-20260507144415"},"company":{"id":"e570c79d-8a08-4558-b97c-662a0389cc26","companyName":"Acme"}}}
```

- **Create company again 3.2 (snippet)**:

```json
{"success":false,"message":"Company already exists for tenant","errorCode":"CONFLICT","statusCode":409}
```

- **Recruiter update forbidden 3.7 (snippet)**:

```json
{"success":false,"message":"Forbidden","errorCode":"FORBIDDEN","statusCode":403}
```

## Verdict: PASS

Commit: `qa: company module testing complete [pass]`

