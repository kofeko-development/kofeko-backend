# Kofeko — Frontend Integration Guide (V2)
### Complete Flow Reference for UI Developers

> **Base URL (dev):** `http://localhost:3000`  
> **Base URL (prod):** your deployed backend URL  
> **API Docs (dev):** `http://localhost:3000/api/v1/docs` (Swagger UI)

---

## Table of Contents

1. [Setup & Configuration](#1-setup--configuration)  
2. [Token System](#2-token-system)  
3. [Staff Auth Flows](#3-staff-auth-flows)  
4. [Company Onboarding Flow](#4-company-onboarding-flow)  
5. [User Management Flows](#5-user-management-flows)  
6. [Job Management Flows](#6-job-management-flows)  
7. [Candidate Management Flows](#7-candidate-management-flows)  
8. [Pipeline Flows](#8-pipeline-flows)  
9. [AI Evaluation Flows](#9-ai-evaluation-flows)  
10. [Communication](#10-communication)  
11. [Analytics & Audit](#11-analytics--audit)  
12. [Super Admin Flows](#12-super-admin-flows)  
13. [Candidate Portal Flows](#13-candidate-portal-flows)  
14. [Standard Response Shapes](#14-standard-response-shapes)  
15. [Error Handling](#15-error-handling)  
16. [Role Permissions Reference](#16-role-permissions-reference)

---

## 1. Setup & Configuration

### Required headers for every protected request

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### For file uploads only

```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data   ← browser sets this automatically when using FormData
```

### Token storage recommendation

Store tokens in memory (React state / Zustand / Redux) or `httpOnly` cookies. Avoid `localStorage` for security.

### Axios / Fetch interceptor pattern

```typescript
// Set up a global interceptor that:
// 1. Attaches Authorization header to every request
// 2. On 401 response → calls refresh endpoint → retries original request
// 3. On second 401 → clears tokens and redirects to login

let isRefreshing = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {
          refreshToken: getStoredRefreshToken(),
        });
        setAccessToken(data.data.accessToken);
        error.config.headers['Authorization'] = `Bearer ${data.data.accessToken}`;
        return axiosInstance(error.config);
      } catch {
        clearTokens();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 2. Token System

Kofeko has three completely separate token types. Using the wrong token on the wrong route returns **403**.

| Token type | Issued by | Valid on | Set in header as |
|---|---|---|---|
| `staff` (default) | `POST /api/v1/auth/login` | All `/api/v1/*` routes except `/portal` and `/superadmin` | `Authorization: Bearer <token>` |
| `candidate` | `POST /api/v1/portal/auth/loginCandidate` | `/api/v1/portal/*` authenticated routes only | `Authorization: Bearer <token>` |
| `super_admin` | `POST /api/v1/superadmin/auth/login` | `/api/v1/superadmin/*` only | `Authorization: Bearer <token>` |

**`tenantId` is embedded in every token — never send it in request bodies on protected routes.**

---

## 3. Staff Auth Flows

### 3.1 Register a new company (first-time onboarding)

```
POST /api/v1/auth/register-admin

Body:
{
  "tenantName": "Acme Corp",
  "tenantSlug": "acme-corp",      ← unique, URL-safe, used for login
  "firstName": "Priya",
  "lastName": "Sharma",
  "email": "priya@acme.com",
  "password": "StrongPass@123"
}
```

Response 201 (shape):

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "firstName": "Priya", "lastName": "Sharma", "email": "priya@acme.com", "roleName": "company_admin" },
    "tenant": { "id": "uuid", "name": "Acme Corp", "slug": "acme-corp" }
  }
}
```

**After this call:** store both tokens, redirect to company profile setup (Section 4).

---

### 3.2 Login

```
POST /api/v1/auth/login

Body:
{
  "tenantSlug": "acme-corp",
  "email": "priya@acme.com",
  "password": "StrongPass@123",
  "otp": "123456"                 ← optional (only when OTP is required)
}
```

**Errors:**
- `404` — tenant slug not found  
- `401` — wrong password  

---

### 3.3 Refresh access token

Call this when any request returns `401`:

```
POST /api/v1/auth/refresh

Body: { "refreshToken": "eyJ..." }
```

Response 200:

```json
{ "success": true, "data": { "accessToken": "eyJ..." } }
```

---

### 3.4 Logout

```
POST /api/v1/auth/logout

Body: { "refreshToken": "eyJ..." }
```

Clear both tokens from storage after this call.

---

### 3.5 Get current user

```
GET /api/v1/auth/me
```

---

### 3.6 Forgot password flow

**Step 1 — Request reset email:**

```
POST /api/v1/auth/forgot-password

Body: { "tenantSlug": "acme-corp", "email": "priya@acme.com" }
```

**Step 2 — Reset password:**

```
POST /api/v1/auth/reset-password

Body: { "token": "<from URL>", "password": "NewStrongPass@123" }
```

---

## 4. Company Onboarding Flow

### 4.1 Create company profile

```
POST /api/v1/company

Body:
{
  "companyName": "Acme Corp",
  "industry": "Technology",
  "companySize": "51-200",          ← enum: 1-10 | 11-50 | 51-200 | 201-500 | 501-1000 | 1000+
  "companyType": "startup",         ← enum: startup | enterprise | agency | non_profit
  "foundedYear": 2018,
  "companyWebsite": "https://acme.com",
  "officialCompanyAddress": "123 Main St, Mumbai, India",
  "phoneNumber": "+91-9876543210",
  "companyLogo": "https://...",
  "shortDescription": "We build great software products for enterprises.",
  "linkedinUrl": "https://linkedin.com/company/acme",
  "twitterUrl": "https://twitter.com/acme",
  "termsAccepted": true
}
```

**Errors:**
- `409` — company already created for this tenant

---

### 4.2 Get company

```
GET /api/v1/company
```

---

### 4.3 Update company

```
PATCH /api/v1/company
```

---

## 5. User Management Flows

### 5.1 Invite a team member (recommended flow)

```
POST /api/v1/users/invite

Body:
{
  "firstName": "Rahul",
  "lastName": "Shah",
  "email": "rahul@acme.com",
  "roleName": "recruiter"            ← recruiter | interviewer | hr_manager | company_admin
}
```

Invite email link example: `<APP_FRONTEND_URL>/accept-invite?token=xxx`

Accept invite:

```
POST /api/v1/auth/accept-invite

Body: { "token": "<from URL>", "password": "NewPass@123" }
```

---

### 5.2 Create user directly (admin creates with password)

```
POST /api/v1/users

Body:
{
  "firstName": "Asha",
  "lastName": "Patel",
  "email": "asha@acme.com",
  "password": "StrongPass@123",
  "roleName": "interviewer"
}
```

---

### 5.3 List users

```
GET /api/v1/users?page=1&limit=20
```

---

### 5.4 Update user

```
PATCH /api/v1/users/:id

Body: { "firstName"?, "lastName"?, "status"? }
status values: active | invited | suspended
```

---

## 6. Job Management Flows

### 6.1 Complete job creation flow

```
POST /api/v1/jobs

Body:
{
  "title": "Senior React Developer",
  "description": "We are looking for...",   ← min 10 characters
  "requirements": "5+ years React experience...",
  "niceToHave": "GraphQL experience is a plus...",
  "department": "Engineering",
  "experienceMin": 3,
  "experienceMax": 7,
  "hiringPriority": "high",
  "screeningQuestions": [
    "Describe your experience with React hooks.",
    "Have you worked with TypeScript before?"
  ],
  "skillWeights": [
    { "skill": "React", "weight": 9 },
    { "skill": "TypeScript", "weight": 8 },
    { "skill": "Node.js", "weight": 7 },
    { "skill": "PostgreSQL", "weight": 5 }
  ]
}
```

Publish:

```
POST /api/v1/jobs/:id/publish
```

Status transitions:

```
draft -> open (publish)
open  -> paused (pause)
open  -> closed (close)
paused -> open (publish)
closed -> terminal
```

---

## 7. Candidate Management Flows

### 7.1 Full candidate creation flow

**Step 1 — Upload resume first:**

```
POST /api/v1/candidates/upload-resume
Content-Type: multipart/form-data

FormData field: resume = <File> (PDF, DOCX, or TXT, max 8MB)
```

Response 200 (shape):

```json
{
  "success": true,
  "data": {
    "url": "https://<ref>.supabase.co/storage/v1/object/public/resumes/uploads/<uuid>-<filename>",
    "mimeType": "application/pdf",
    "filename": "<uuid>-<filename>"
  }
}
```

**Storage providers (how `url` is formed):**

- Dev (`STORAGE_PROVIDER=local`): `http://localhost:3000/uploads/<filename>`
- Prod (`STORAGE_PROVIDER=supabase`): `https://<ref>.supabase.co/storage/v1/object/public/resumes/uploads/<uuid>-<filename>`
- Legacy / optional (`STORAGE_PROVIDER=firebase`): Firebase Storage URL

**Step 2 — Create candidate with resume URL:**

```
POST /api/v1/candidates

Body:
{
  "firstName": "Amit",
  "lastName": "Kumar",
  "email": "amit@email.com",
  "phoneNumber": "+91-9876543210",
  "resumeUrl": "<url from step 1>",
  "resumeMimeType": "application/pdf",
  "linkedinUrl": "https://linkedin.com/in/amit",
  "portfolioUrl": "https://amit.dev",
  "expectedSalary": 1500000,
  "noticePeriod": 30,
  "skills": ["React", "TypeScript", "Node.js"],
  "location": "Bangalore, India",
  "source": "linkedin"
}
```

---

### 7.2 List and filter candidates

```
GET /api/v1/candidates?status=screening&skills=React,Node.js&page=1&limit=20
```

---

### 7.3 Update candidate status manually

```
PATCH /api/v1/candidates/:id/status

Body: { "status": "screening" }
Valid values: new | screening | interview | offer | hired | rejected
```

---

## 8. Pipeline Flows

### 8.1 Add candidate to job pipeline

```
POST /api/v1/pipelines

Body: { "jobId": "uuid", "candidateId": "uuid" }
```

---

### 8.2 Advance pipeline stage

```
POST /api/v1/pipelines/:id/advance

Body:
{
  "stage": "screening",
  "note": "Strong phone screen, good cultural fit"    ← optional
}
```

Valid stage transitions:

```
applied -> screening -> technical_interview -> hr_interview -> offer -> hired
any -> rejected
```

---

### 8.3 Assign interviewer

```
POST /api/v1/pipelines/:id/assign

Body: { "userId": "interviewer-user-uuid" }
```

---

### 8.4 Set SLA deadline

```
POST /api/v1/pipelines/:id/sla

Body: { "deadline": "2026-06-15T18:00:00.000Z" }
```

---

### 8.5 List pipelines

```
GET /api/v1/pipelines?jobId=uuid&page=1&limit=20
GET /api/v1/pipelines?candidateId=uuid
```

---

## 9. AI Evaluation Flows

Single:

```
POST /api/v1/evaluations/ai-evaluate

Body: { "jobId": "uuid", "candidateId": "uuid", "pipelineId": "uuid" }
```

Batch:

```
POST /api/v1/jobs/:jobId/evaluate-all
```

Rankings:

```
GET /api/v1/jobs/:jobId/rankings
```

Override:

```
PATCH /api/v1/evaluations/:id
```

---

## 10. Communication

Manual send:

```
POST /api/v1/communication/send
Body: { "to": "...", "subject": "...", "html": "..." }
```

List messages:

```
GET /api/v1/communication/messages?page=1&limit=20
```

List notifications:

```
GET /api/v1/communication/notifications?page=1&limit=20
```

---

## 11. Analytics & Audit

```
GET /api/v1/analytics/summary
GET /api/v1/analytics/pipeline-funnel?jobId=uuid
GET /api/v1/analytics/time-to-decision?jobId=uuid
GET /api/v1/analytics/score-distribution?jobId=uuid
GET /api/v1/analytics/recent-activity?limit=10
GET /api/v1/analytics/hiring-velocity

GET /api/v1/audit/logs?page=1&limit=20
GET /api/v1/audit/logs/:id
```

---

## 12. Super Admin Flows

Bootstrap:

```
POST /api/v1/superadmin/auth/bootstrap
Header: x-setup-key: <SUPER_ADMIN_SETUP_KEY>
```

Login:

```
POST /api/v1/superadmin/auth/login
```

Tenants:

```
GET /api/v1/superadmin/tenants?status=active&page=1&limit=20
GET /api/v1/superadmin/tenants/:id
POST /api/v1/superadmin/tenants/:id/suspend
POST /api/v1/superadmin/tenants/:id/activate
```

---

## 13. Candidate Portal Flows

Browse jobs (public):

```
GET /api/v1/portal/:tenantSlug/jobs?page=1&limit=20
GET /api/v1/portal/:tenantSlug/jobs/:jobId
```

Register candidate (public):

```
POST /api/v1/portal/auth/registerCandidate
Body: { "tenantSlug", "firstName", "lastName", "email", "password" }
```

Login candidate (public):

```
POST /api/v1/portal/auth/loginCandidate
Body: { "tenantSlug", "email", "password" }
```

Candidate profile:

```
GET /api/v1/portal/auth/me
PATCH /api/v1/portal/profile
```

Apply:

```
POST /api/v1/portal/:tenantSlug/jobs/:jobId/apply
```

My applications:

```
GET /api/v1/portal/my-applications?page=1&limit=10
GET /api/v1/portal/my-applications/:pipelineId
```

---

## 14. Standard Response Shapes

### Success — single item

```json
{
  "success": true,
  "message": "Created successfully",
  "data": {}
}
```

### Success — paginated list

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Human readable description",
  "errorCode": "MACHINE_READABLE_CODE",
  "statusCode": 400
}
```

---

## 15. Error Handling

### HTTP status codes

| Status | Meaning | Common causes |
|---|---|---|
| `200` | OK | Successful GET / PATCH |
| `201` | Created | Successful POST (new resource) |
| `400` | Bad Request | Validation error, illegal transition, past date |
| `401` | Unauthorized | Missing/expired token |
| `403` | Forbidden | Wrong token type, insufficient role, tenant suspended |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate email, already in pipeline |
| `413` | Payload Too Large | Resume > 8 MB |
| `415` | Unsupported Media Type | Resume not PDF/DOCX/TXT |

---

## 16. Role Permissions Reference

| Permission | company_admin | hr_manager | recruiter | interviewer |
|---|---|---|---|---|
| `company:read` | ✅ | ✅ | ✅ | ✅ |
| `company:update` | ✅ | ✅ | ❌ | ❌ |
| `user:create` | ✅ | ✅ | ❌ | ❌ |
| `user:invite` | ✅ | ✅ | ❌ | ❌ |
| `job:create` | ✅ | ✅ | ✅ | ❌ |
| `candidate:create` | ✅ | ✅ | ✅ | ❌ |
| `pipeline:update` | ✅ | ✅ | ✅ | ❌ |
| `analytics:read` | ✅ | ✅ | ✅ | ❌ |

---

## Quick Reference: Key ID Flow

```
Register admin          → tenantId (in JWT)
Create company          → companyId
Invite/create user      → userId
Create job              → jobId
Upload resume           → resumeUrl (store on candidate)
Create candidate        → candidateId
Add to pipeline         → pipelineId
```

---

## Known gotchas

- Supabase storage example URL is:  
  `https://<ref>.supabase.co/storage/v1/object/public/resumes/uploads/<uuid>-<filename>`  
  (where bucket name is `resumes` and key prefix is `uploads/`).
- If your bucket name differs, the URL is:  
  `https://<ref>.supabase.co/storage/v1/object/public/<SUPABASE_STORAGE_BUCKET>/uploads/<uuid>-<filename>`
- Supabase DB passwords with special characters (like `@`) must be URL-encoded in `DATABASE_URL`/`DIRECT_URL`.
- Supabase “RLS disabled” warnings: enable RLS on all `public` tables (see migration `20260623120000_enable_supabase_rls`). Prisma/server access is unchanged; only direct Supabase Data API + anon key access is blocked.

---

*Kofeko Phase 1 — Frontend Integration Guide (V2)*  
*Backend: TypeScript + Express + Prisma + Supabase (PostgreSQL + Storage) + Replicate AI*  
*Last updated: May 2026*  

