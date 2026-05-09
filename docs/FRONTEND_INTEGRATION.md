## 1. Base URL & Headers

- Base URL (dev): `http://localhost:3000`
- Base URL (prod): TBD

Required headers for all protected requests:

- `Authorization: Bearer <accessToken>`
- `Content-Type: application/json`

## 2. Authentication Flows

### Staff (Recruiter / HR / Admin)

1. Register new company
   - `POST /api/v1/auth/register-admin`
   - Body: `{ tenantName, tenantSlug, firstName, lastName, email, password }`
   - Returns: `{ accessToken, refreshToken, user, tenant }`

2. Login
   - `POST /api/v1/auth/login`
   - Body: `{ tenantSlug, email, password }`
   - Returns: `{ accessToken, refreshToken, user, tenant }`

3. Token refresh (call when you receive 401)
   - `POST /api/v1/auth/refresh`
   - Body: `{ refreshToken }`
   - Returns: `{ accessToken }`

4. Logout
   - `POST /api/v1/auth/logout`
   - Body: `{ refreshToken }`

5. Accept invite (new staff member sets password)
   - `POST /api/v1/auth/accept-invite`
   - Body: `{ token, password }`

6. Forgot password
   - `POST /api/v1/auth/forgot-password`
   - Body: `{ tenantSlug, email }`

7. Reset password
   - `POST /api/v1/auth/reset-password`
   - Body: `{ token, password }`

### Candidate (Portal)

1. Register
   - `POST /api/v1/portal/auth/registerCandidate`
   - Body: `{ tenantSlug, firstName, lastName, email, password }`

2. Login
   - `POST /api/v1/portal/auth/loginCandidate`
   - Body: `{ tenantSlug, email, password }`

3. Refresh
   - `POST /api/v1/portal/auth/refresh`
   - Body: `{ refreshToken }`

### Super Admin

1. Bootstrap (one time only)
   - `POST /api/v1/superadmin/auth/bootstrap`
   - Header: `x-setup-key: <SUPER_ADMIN_SETUP_KEY>`
   - Body: `{ email, password, firstName, lastName }`

2. Login
   - `POST /api/v1/superadmin/auth/login`
   - Body: `{ email, password }`

## 3. Token Types & Route Access

Token type | Issued by | Valid on
---|---|---
staff (default) | `/api/v1/auth/login` | `/api/v1/*` (except portal + superadmin)
candidate | `/api/v1/portal/auth/loginCandidate` | `/api/v1/portal/*` (authed routes only)
super_admin | `/api/v1/superadmin/auth/login` | `/api/v1/superadmin/*` only

Cross-use is rejected with **403** in all cases. `tenantId` is always embedded in the JWT — never send it in request bodies.

## 4. Multi-Tenancy

- **Staff requests**: scoped by `tenantId` in JWT automatically.
- **Public portal routes**: tenant is identified by `tenantSlug` in URL:
  - `GET /api/v1/portal/:tenantSlug/jobs`
  - `GET /api/v1/portal/:tenantSlug/jobs/:jobId`
  - `POST /api/v1/portal/:tenantSlug/jobs/:jobId/apply`

Portal responses must not expose internal `tenantId`.

## 5. Standard Response Shapes

Success:

```json
{
  "success": true,
  "message": "...",
  "data": { }
}
```

Paginated list:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Human readable message",
  "errorCode": "MACHINE_READABLE_CODE",
  "statusCode": 400
}
```

## 6. AI Evaluation Flow (end-to-end)

Step 1 — Create job with skill weights

- `POST /api/v1/jobs`
- Body:

```json
{
  "title": "Senior React Developer",
  "description": "...",
  "skillWeights": [
    { "skill": "React", "weight": 9 },
    { "skill": "Node.js", "weight": 8 },
    { "skill": "PostgreSQL", "weight": 6 }
  ]
}
```

Step 2 — Upload candidate resume

- `POST /api/v1/candidates/upload-resume`
- Body: `multipart/form-data` field name: `resume` (PDF/DOCX/TXT, max 8MB)
- Returns: `{ url, mimeType, filename }`

Step 3 — Create candidate with resume URL

- `POST /api/v1/candidates`
- Body: `{ firstName, lastName, email, resumeUrl, resumeMimeType }`

Step 4 — Add candidate to job pipeline

- `POST /api/v1/pipelines`
- Body: `{ jobId, candidateId }`

Step 5 — Trigger AI evaluation

- `POST /api/v1/evaluations/ai-evaluate`
- Body: `{ jobId, candidateId, pipelineId }`

Step 6 — View rankings

- `GET /api/v1/jobs/:jobId/rankings`

Step 7 (optional) — Batch evaluate all candidates

- `POST /api/v1/jobs/:jobId/evaluate-all`

## 7. File Upload

Resume upload endpoint: `POST /api/v1/candidates/upload-resume`

- Method: `multipart/form-data`
- Field name: `resume`
- Accepted: PDF, DOCX, TXT
- Max size: 8 MB
- Returns: `{ url, mimeType, filename }`

Store `url` → `candidate.resumeUrl` and `mimeType` → `candidate.resumeMimeType`.

Dev mode (`STORAGE_PROVIDER=local`): `http://localhost:3000/uploads/<filename>`
Prod mode (`STORAGE_PROVIDER=supabase`): `https://[ref].supabase.co/storage/v1/object/public/resumes/uploads/<uuid>-<filename>`
Legacy / optional (`STORAGE_PROVIDER=firebase`): Firebase Storage URL

## 8. Pipeline Stage Transitions

Valid stages (in order):

`applied → screening → technical_interview → hr_interview → offer → hired`

Any stage → `rejected` (terminal)

Advance stage:

- `POST /api/v1/pipelines/:id/advance`
- Body: `{ stage: "screening", note: "Good phone screen" }`

Terminal stages: `hired`, `rejected` — no further transitions.

Candidate status auto-syncs:

- `screening` → `candidate.status = 'screening'`
- `technical_interview` / `hr_interview` → `candidate.status = 'interview'`
- `offer` → `candidate.status = 'offer'`
- `hired` → `candidate.status = 'hired'`
- `rejected` → `candidate.status = 'rejected'`

## 9. Role Permissions Quick Reference

Role | Key permissions
---|---
company_admin | Everything
hr_manager | Users, jobs, candidates, pipelines, evaluations, analytics
recruiter | Jobs, candidates, pipelines, evaluations
interviewer | View candidates/pipelines, create/update evaluations

## 10. Common Error Codes

- `401 Unauthorized`: Missing/expired token. Refresh and retry.
- `403 Forbidden`: Wrong token type, insufficient permission, or tenant suspended.
- `404 Not Found`: Resource missing or belongs to different tenant.
- `409 Conflict`: Duplicate (email, pipeline entry, etc.)
- `413 Payload Too Large`: Resume > 8 MB
- `415 Unsupported Media`: Resume format not PDF/DOCX/TXT
- `502 Bad Gateway`: Replicate AI service error (retry evaluation)

