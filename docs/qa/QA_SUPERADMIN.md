# QA — Super Admin Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: e80dc36  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 10.1 | Bootstrap | 201 created | 201 | PASS | `POST /superadmin/auth/bootstrap` created super admin `superadmin+20260507160442@example.com`. |
| 10.2 | Bootstrap again | 409 already bootstrapped | 409 | PASS | Message: `Super admin already bootstrapped`. |
| 10.3 | Bootstrap wrong key | 403 | 403 | PASS | Message: `Invalid setup key`. |
| 10.4 | Login | 200 tokens | 200 | PASS | Access + refresh tokens returned. |
| 10.5 | Super admin token on staff route | 403 | 403 | PASS | Message: `Super admin tokens are not valid on staff routes`. |
| 10.6 | Staff token on super admin route | 403 | 403 | PASS | Message: `Tenant tokens are not valid on super admin routes`. |
| 10.7 | List tenants | list returned | 200 paginated | PASS | Shape: `data.items[]`, `data.total/page/limit/totalPages`. |
| 10.8 | Filter tenants by status | only active | filtered | PASS | `status=active` returned active tenants. |
| 10.9 | Get tenant detail | full detail | 200 | PASS | Includes `_count` for users/jobs/candidates. |
| 10.10 | Suspend tenant | 200 suspended | 200 | PASS | Tenant status set to `suspended`. |
| 10.11 | Staff login on suspended tenant | 403 tenant suspended | 403 | PASS | Message: `This account has been suspended. Contact support.` (`errorCode=TENANT_SUSPENDED`). |
| 10.12 | Any API call on suspended tenant | 403 | 403 | PASS | Existing token blocked by auth middleware. |
| 10.13 | Activate tenant | 200 active | 200 | PASS | Tenant status set back to `active`. |
| 10.14 | Staff login after activation | 200 tokens | 200 | PASS | Login successful again. |
| 10.15 | Platform analytics | all keys present | 200 | PASS | Platform analytics fetched successfully. |
| 10.16 | Refresh super admin token | new access token | 200 | PASS | Returned `{ accessToken }`. |
| 10.17 | Logout | 200 + token revoked | 200 | PASS | Refresh after logout returned 401 invalid refresh token. |

## Issues found
- None observed after fixing suspended-tenant login enforcement.

## Screenshots / response samples

- **Tenant slug used**: `qa-sa-20260507160442`

- **Suspend tenant 10.10 (snippet)**:

```json
{"success":true,"message":"Tenant suspended","data":{"status":"suspended"}}
```

- **Login blocked on suspended tenant 10.11 (snippet)**:

```json
{"success":false,"message":"This account has been suspended. Contact support.","errorCode":"TENANT_SUSPENDED","statusCode":403}
```

## Verdict: PASS

Commit: `qa: superadmin module testing complete [pass]`

