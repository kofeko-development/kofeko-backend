# User Onboarding — Create User vs Invite User (Simple Guide)

This document explains how the backend currently handles **adding internal users** to a tenant (company workspace):

- **Create User** (admin/HR creates an account with a password)
- **Invite User** (admin/HR creates an “invited” account)

It also explains how **roles** are assigned during onboarding.

## Key idea (plain English)

- A **Tenant** is a company workspace.
- A **User** belongs to a tenant.
- A **Role** (like recruiter/interviewer) controls what the user can do.
- The backend assigns a role immediately when a user is created/invited.

## What’s already implemented

### 1) Create user endpoint (direct creation)

- Endpoint: `POST /api/v1/users`
- Security:
  - Requires authentication (access token)
  - Requires permission: `user:create`

What it does:

- Creates the user with the provided password
- Assigns a role to the user in the same tenant
- This is done **atomically** (in one database transaction)
  - So you won’t end up with a user without a role

Default role behavior:

- If `roleName` is not provided, the system assigns **`recruiter`** by default.

Status behavior:

- If status isn’t provided, the user becomes **`active`**.

Payload (example):

```json
{
  "tenantId": "<tenant-uuid>",
  "firstName": "Asha",
  "lastName": "Patel",
  "email": "asha@company.com",
  "password": "StrongPass@123",
  "roleName": "recruiter"
}
```

### 2) Invite user endpoint (creates an invited account)

- Endpoint: `POST /api/v1/users/invite`
- Security:
  - Requires authentication (access token)
  - Requires permission: `user:invite`

What it does today:

- Creates the user in the database
- Assigns a role
- Sets the user status to **`invited`**
- Prevents duplicate email within the same tenant

Default role behavior:

- If `roleName` is not provided, the system assigns **`recruiter`** by default.

Payload (example):

```json
{
  "tenantId": "<tenant-uuid>",
  "firstName": "Rahul",
  "lastName": "Shah",
  "email": "rahul@company.com",
  "roleName": "interviewer"
}
```

Important note (current limitation):

- The backend currently generates a temporary password internally, but it **does not email it** and it **does not provide an invite acceptance link** yet.
- So the “invite” flow is only half-complete until we implement the acceptance + email delivery.

### 3) Read/list/update user endpoints

- `GET /api/v1/users?tenantId=...` requires `user:read`
- `GET /api/v1/users/:id` requires `user:read`
- `PATCH /api/v1/users/:id` requires `user:update`

Update currently supports:

- `firstName` (optional)
- `lastName` (optional)
- `status` (optional): `active | invited | suspended`

## Role assignment rules (current code)

During both create and invite:

- The service resolves the role by `(tenantId, roleName)`
- If the role does not exist in that tenant, it returns a validation error

Role names supported:

- `company_admin`
- `hr_manager`
- `recruiter`
- `interviewer`

Those roles are created automatically by the seed/bootstrap process.

## Where this lives in code (for developers)

- Routes: [src/routes/user/user.routes.ts](../src/routes/user/user.routes.ts)
- Controller: [src/controllers/user/user.controller.ts](../src/controllers/user/user.controller.ts)
- Service: [src/services/user/user.service.ts](../src/services/user/user.service.ts)
- Repository: [src/repositories/user/user.repository.ts](../src/repositories/user/user.repository.ts)
- Validation: [src/validations/user/user.validation.ts](../src/validations/user/user.validation.ts)
- Role names: [src/common/constants/roles.ts](../src/common/constants/roles.ts)
- Permissions: [src/common/constants/permissions.ts](../src/common/constants/permissions.ts)

## What’s missing / future steps (flows to design)

### A) Complete invitation flow (most important)

Right now, “invite” creates an invited user but doesn’t complete the real-world onboarding.

Flow to design and implement:

1) HR/Admin invites a user (email + role)
2) System generates an **invite token** (with expiry)
3) System sends an email with an **invite link**
4) User opens link and sets a password
5) User status becomes **active**
6) User can login normally

This needs:

- A database model/fields for invite tokens (or a dedicated table)
- Email provider integration
- New endpoint, for example:
  - `POST /api/v1/auth/accept-invite` (token + password)

### B) Password reset (forgot password)

Flow:

- Request reset → email token → set new password

### C) Role change + role assignment management

Today users get a role at creation time.

Future flows:

- Change user’s role safely (and audit it)
- Support multiple roles per user (already possible in schema) with clear business rules

### D) Row-level access rules (who can see which candidates)

Even with roles, you typically need record-level scoping:

- Example: interviewer only sees assigned interviews/pipelines

This requires:

- Assignment relationships (interviewer ↔ pipeline/evaluation)
- Filtering in list/get queries

---

If you want, I can also add a short “Business-friendly flow diagram” section (steps only, no extra features) that matches your org flow: Company Admin → HR Manager → Recruiter → Interviewer.
