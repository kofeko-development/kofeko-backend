    # Authentication & Authorization (RBAC) — What’s Done + Next Steps

    This document explains, in simple terms, what the backend already supports for **login/security** (Authentication) and **who can do what** (Authorization / RBAC).

    ## What this module is for

    - **Authentication** answers: “Who are you?”
    - Example: You log in and get a token that proves you are a valid user.
    - **Authorization (RBAC)** answers: “What are you allowed to do?”
    - Example: A Recruiter can create candidates, but an Interviewer can’t.

    The system is **multi-tenant** (each company = one tenant). Roles and permissions are stored **per tenant**, so one company’s roles do not affect another company.

    ## What’s already implemented (current code)

    ### 1) Admin registration creates the company/tenant + admin user

    - Endpoint: `POST /api/v1/auth/register-admin`
    - What happens:
    - Creates a **Tenant** (company workspace)
    - Creates all **Permission** records for that tenant
    - Creates default **Roles** for that tenant
    - Assigns the new admin user the `company_admin` role
    - Returns `accessToken` + `refreshToken`

    Why this matters: one API call can bring a brand-new tenant to a “working state” with roles/permissions ready.

    ### 2) Login, refresh, logout, and “me” are working

    - `POST /api/v1/auth/login`
    - You send: tenant slug + email + password
    - You receive: `accessToken` + `refreshToken`
    - `POST /api/v1/auth/refresh`
    - You send: refresh token
    - You receive: a new access token
    - `POST /api/v1/auth/logout`
    - You send: refresh token
    - That session is revoked
    - `GET /api/v1/auth/me`
    - You send: access token
    - You receive: your user profile

    ### 3) Access token authentication middleware is implemented

    For protected routes, the API expects:

    - Header: `Authorization: Bearer <accessToken>`

    If the token is valid, the backend sets `req.user` with:

    - `userId`
    - `tenantId`
    - `email`

    (Implementation: [src/common/middlewares/authenticate.ts](../src/common/middlewares/authenticate.ts))

    ### 4) RBAC authorization middleware is implemented

    Protected routes can require permissions like `user:create` or `job:update`.

    - The middleware loads the user’s roles in that tenant
    - Collects all permissions attached to those roles
    - Checks that the user has **every required permission**

    (Implementation: [src/common/middlewares/authorize.ts](../src/common/middlewares/authorize.ts))

    ### 5) Sessions exist (refresh token tracking)

    - Refresh tokens are stored as **hashes** in a `session` table
    - Refresh tokens can be revoked on logout
    - Expired sessions are rejected

    (Implementation lives in auth service/repository)

    ### 6) Seed script syncs permissions + default roles for all tenants

    `npm run prisma:seed` does:

    - If the database has **zero tenants**: creates a demo tenant + demo admin user
    - For **every tenant**:
    - Ensures all permissions exist
    - Ensures all default roles exist
    - Ensures role-permission mappings exist

    (Implementation: [src/scripts/seed.ts](../src/scripts/seed.ts))

    ## Seeded roles (default internal roles)

    These roles are created for every tenant automatically:

    - `company_admin`
    - `hr_manager`
    - `recruiter`
    - `interviewer`

    (Source of truth: [src/common/constants/roles.ts](../src/common/constants/roles.ts))

    ### What each role can do (plain English)

    The exact permission mapping is defined here:

    - [src/common/constants/rolePermissionMatrix.ts](../src/common/constants/rolePermissionMatrix.ts)

    Summary:

    - **company_admin**
    - Can do everything in the tenant (all permissions)
    - **hr_manager**
    - Can manage company profile
    - Can create/update/read users and invite users
    - Can manage jobs and candidates
    - Can move/manage pipelines (read/update)
    - Can view evaluations, communications, analytics, and audit logs
    - **recruiter**
    - Can create/update jobs and candidates
    - Can create/update pipelines
    - Can create/read evaluations
    - Can create/read communications
    - Can view analytics
    - **interviewer**
    - Can view candidates and pipelines
    - Can create/read/update evaluations
    - Can view communications

    ## How to use it (developer-facing, still simple)

    ### Step 1: Register an admin (new tenant)

    - Call `POST /api/v1/auth/register-admin`
    - Save the returned `accessToken` and `refreshToken`

    ### Step 2: Call protected endpoints

    - Add header: `Authorization: Bearer <accessToken>`

    ### Step 3: When access token expires

    - Call `POST /api/v1/auth/refresh` using the refresh token
    - Replace your access token with the new one

    ## What is NOT implemented yet (important gaps)

    This is the “future steps” list for making Auth/RBAC production-ready.

    ### A) Invite acceptance flow (currently partial)

    Today the backend has an “invite” concept (creates an invited user), but **no full acceptance workflow**.

    Flow to design and implement:

    - HR/Admin invites a user (email)
    - System sends an email with an **invite link** (token)
    - Invited user opens link and sets password
    - User becomes `active` and can log in

    This requires:

    - Invite token generation + storage + expiry
    - Email delivery provider integration
    - `POST /auth/accept-invite` endpoint (or similar)

    ### B) Forgot password / reset password

    Flow to design:

    - User requests password reset
    - System emails a reset link/token
    - User sets a new password

    ### C) Email verification (optional but recommended)

    If you want verified accounts:

    - Register/invite creates `pending` user
    - Email verification link activates the account

    ### D) Row-level access ("who can see which record")

    Current RBAC is **route-level permission** based.

    Missing part for “full RBAC”:

    - Example rule: “Interviewer can only see candidates assigned to them.”
    - This requires assignment relationships and query filtering.

    ### E) Security hardening (recommended)

    - Rate-limit login attempts (anti brute-force)
    - Track auth events in audit logs (login, logout, refresh)
    - Session management endpoints (list sessions, revoke other sessions)
    - Optional MFA (later)

    ## Next flows to design (Auth + RBAC only)

    If we focus strictly on Authentication/Authorization, the next UX/API flows are:

    1) **Tenant onboarding**: `register-admin` → admin lands in app
    2) **Login**: tenant slug + email + password → tokens
    3) **Refresh**: refresh token → new access token
    4) **Logout**: revoke refresh token/session
    5) **Invite user**: HR/Admin invites user + chooses role
    6) **Accept invite**: invited user sets password → becomes active
    7) **Forgot password**: reset token flow
    8) **Role governance**: (optional) UI/API to customize roles per tenant
    9) **Row-level policies**: interviewer assignment + filtered reads

    ---

    If you want, I can create the next document after this one for the **User module onboarding** (create user vs invite user vs assign role), but I’ll keep those separate so the docs don’t become “overall everything.”
