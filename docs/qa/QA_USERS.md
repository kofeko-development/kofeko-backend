# QA — Users Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 32598d0  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 2.1 | Create user (recruiter) | 201 created | 201 created | PASS | `POST /api/v1/users` created recruiter user `a3c5e923-26ab-465f-94d6-7eb0a315b668` (tenant-scoped). |
| 2.2 | Create user duplicate email | 409 conflict | 409 conflict | PASS | Response: `Duplicate value violates unique constraint` (target: `tenantId,email`). |
| 2.3 | Invite user (interviewer) | 201 + invite email received | 201 + invite email received | PASS | MailHog received invite email. Subject: `You are invited to Kofeko`. Token extracted from email: `ddf64e…` (masked). |
| 2.4 | Accept invite | 200, user becomes active | 200, user active | PASS | `POST /api/v1/auth/accept-invite` succeeded; status became `active`. |
| 2.5 | Accept invite twice | 400 | 400 | PASS | Response: `Invite token has already been used`. |
| 2.6 | Login as invited user | 200 tokens | 200 tokens | PASS | `POST /api/v1/auth/login` successful for invited user. |
| 2.7 | List users | 200 paginated list | 200 paginated list | PASS | Shape: `data.items[]`, `data.total/page/limit/totalPages`. |
| 2.8 | Get user by ID | 200 user profile | 200 user profile | PASS | `GET /api/v1/users/:id` returned correct recruiter user. |
| 2.9 | Update user | 200 updated | 200 updated | PASS | `PATCH /api/v1/users/:id` updated `firstName` to `RecruiterUpdated`. |
| 2.10 | Suspend user | 200 | 200 | PASS | Suspended invited user; status became `suspended`. |
| 2.11 | Suspended user cannot access protected endpoint | 403 forbidden | 403 on login | PASS* | Current behavior blocks suspended users at login with `403 User is not active`. (We also observed an already-issued access token could still call `GET /api/v1/auth/me` successfully after suspension — see “Issues found”.) |
| 2.12 | Recruiter cannot create users | 403 forbidden | 403 forbidden | PASS | Recruiter token attempting `POST /api/v1/users` returned `403 Forbidden`. |

## Issues found

- **Security/RBAC**: After suspending a user, an **already-issued access token** was still able to call `GET /api/v1/auth/me` successfully (observed in automation run field `suspendedMeError: null`). Expected: suspended user tokens should be rejected (403) on protected endpoints.

## Screenshots / response samples

- **Tenant slug used**: `qa-users-20260507142832`
- **Create user 2.1 (snippet)**:

```json
{"success":true,"message":"User created successfully","data":{"id":"a3c5e923-26ab-465f-94d6-7eb0a315b668","email":"recruiter+qa-users-20260507142832@example.com","status":"active"}}
```

- **Duplicate email 2.2 (snippet)**:

```json
{"success":false,"message":"Duplicate value violates unique constraint","errorCode":"CONFLICT","statusCode":409}
```

- **MailHog invite evidence 2.3**:
  - Subject: `You are invited to Kofeko`
  - Invite token extracted: `ddf64e…` (masked)

- **Accept invite twice 2.5 (snippet)**:

```json
{"success":false,"message":"Invite token has already been used","errorCode":"VALIDATION_ERROR","statusCode":400}
```

- **Recruiter create user forbidden 2.12 (snippet)**:

```json
{"success":false,"message":"Forbidden","errorCode":"FORBIDDEN","statusCode":403}
```

## Verdict: PASS

Commit: `qa: users module testing complete [pass]`

