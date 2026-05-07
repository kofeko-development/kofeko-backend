# QA — Auth Module
Date: 2026-05-07
Tester: Vivek
Environment: development
Backend version: 73dc128

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 1.1 | Register admin | 201 with accessToken + refreshToken + user + tenant | 201, tokens returned | PASS | Tenant slug: `qa-auth-20260507140149` |
| 1.2 | Register duplicate slug | 409 conflict | 409 `CONFLICT` | PASS | Unique constraint on `Tenant.slug` |
| 1.3 | Login valid | 200 with tokens | 200, tokens returned | PASS |  |
| 1.4 | Login wrong password | 401 | 401 `UNAUTHORIZED` | PASS |  |
| 1.5 | Login wrong tenant slug | 404 | 404 `NOT_FOUND` | PASS |  |
| 1.6 | /auth/me with access token | 200 with user profile | 200, profile returned | PASS |  |
| 1.7 | /auth/me with expired token | 401 | Not executed | PARTIAL | Requires issuing an intentionally expired access token (needs very short `JWT_ACCESS_EXPIRES_IN` + server restart or a pre-baked expired JWT). |
| 1.8 | Refresh token valid | 200 with new accessToken | 200, new access token returned | PASS |  |
| 1.9 | Refresh invalid token | 401 | 401 `UNAUTHORIZED` | PASS |  |
| 1.10 | Logout valid refresh token | 200 | 200 | PASS |  |
| 1.11 | Refresh after logout | 401 | 401 `UNAUTHORIZED` | PASS |  |
| 1.12 | Forgot password | 200 + email received | 200 + MailHog email received | PASS | Subject: “Reset your Kofeko password” |
| 1.13 | Reset password | 200 | 200 “Password reset successfully” | PASS | Token extracted from MailHog body |
| 1.14 | Reset with same token again | 400 token already used | 400 “Reset token has already been used” | PASS |  |
| 1.15 | Login with new password | 200 | 200, tokens returned | PASS | Password changed to `AdminA1bbbb` for this QA user |

## Issues found
- **Expired token test (1.7) not executed** in this run (see notes above). All other cases passed.

## Screenshots / response samples

### 1.1 Register admin (201)
Key fields returned:
- `data.accessToken` (JWT)
- `data.refreshToken` (JWT)
- `data.user.email = admin+qa-auth-20260507140149@example.com`
- `data.tenant.slug = qa-auth-20260507140149`

### 1.2 Duplicate slug (409)

```json
{"success":false,"message":"Duplicate value violates unique constraint","errorCode":"CONFLICT","statusCode":409,"details":{"modelName":"Tenant","target":["slug"]}}
```

### 1.12 Forgot password (200) + MailHog proof
- Email delivered to: `admin+qa-auth-20260507140149@example.com`
- Subject: `Reset your Kofeko password`
- Reset link format observed in body: `http://localhost:3000/reset-password?token=<token>`

### 1.14 Reset token reuse (400)

```json
{"success":false,"message":"Reset token has already been used","errorCode":"VALIDATION_ERROR","statusCode":400}
```

## Verdict: PARTIAL
Commit: `qa: auth module testing complete [partial]`

