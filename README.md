# Kofeko Backend Boilerplate

Advanced Node.js + TypeScript backend boilerplate for Kofeko platform.

## Docs

- Authentication & Authorization (RBAC): `docs/auth-authorization.md`
- User onboarding (create vs invite): `docs/user-onboarding.md`

## Features

- Express API with versioned routes (`/api/v1`)
- Custom error handler and standard API response shape
- Request validation with Zod
- Prisma with PostgreSQL
- Layer-first architecture: routes, controllers, services, repositories, validations, types
- Company module (registration/profile)
- Auth module (register admin, login, refresh, logout, me)
- Tenant module
- User module
- RBAC module (roles, permissions, assignment)
- Security middleware (`helmet`, `cors`, `compression`)
- Graceful shutdown support
- Nodemon + ts-node development workflow

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create environment file

```bash
cp .env.example .env
```

3. Generate Prisma client

```bash
npm run prisma:generate
```

4. Run migrations

```bash
npm run prisma:migrate -- --name phase_auth_tenant_user_rbac
```

5. Seed default data

```bash
npm run prisma:seed
```

This seed now does two things:

- If there are zero tenants, it creates a bootstrap tenant and admin user.
- It syncs default permissions and admin role mappings for all tenants.

Default bootstrap credentials (customizable via `.env`):

- tenant slug: `demo-tenant`
- admin email: `admin@demo.com`
- admin password: `Admin@12345`

6. Run dev server

```bash
npm run dev
```

Server runs at `http://localhost:5000`.

## API Endpoints (Company)

- `POST /api/v1/companies/register`
- `GET /api/v1/companies/:id`
- `PATCH /api/v1/companies/:id`
- `GET /health`

## API Endpoints (New Phases)

- `GET /api/v1/system/seed-status`
- `POST /api/v1/auth/register-admin`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/tenants`
- `GET /api/v1/tenants/:id`
- `PATCH /api/v1/tenants/:id`
- `POST /api/v1/users`
- `GET /api/v1/users?tenantId=...`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`
- `POST /api/v1/rbac/roles`
- `POST /api/v1/rbac/permissions`
- `POST /api/v1/rbac/roles/:roleId/permissions/:permissionId`
- `POST /api/v1/rbac/users/:userId/roles/:roleId`
- `GET /api/v1/rbac/users/:userId/permissions?tenantId=...`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs?tenantId=...`
- `GET /api/v1/jobs/:id`
- `PATCH /api/v1/jobs/:id`
- `POST /api/v1/candidates`
- `GET /api/v1/candidates?tenantId=...`
- `GET /api/v1/candidates/:id`
- `PATCH /api/v1/candidates/:id`
- `POST /api/v1/pipelines`
- `GET /api/v1/pipelines?tenantId=...`
- `GET /api/v1/pipelines/:id`
- `PATCH /api/v1/pipelines/:id`
- `POST /api/v1/evaluations`
- `GET /api/v1/evaluations?tenantId=...`
- `GET /api/v1/evaluations/:id`
- `PATCH /api/v1/evaluations/:id`

## Company Registration Payload

```json
{
  "companyName": "Acme Inc",
  "companyAddress": {
    "country": "India",
    "state": "Gujarat",
    "city": "Ahmedabad",
    "fullAddress": "123 Business Park",
    "zipCode": "380001"
  },
  "industry": "Recruitment Tech",
  "companySize": "51-200",
  "companyType": "startup",
  "foundedYear": 2020,
  "companyWebsite": "https://acme.com",
  "officialCompanyAddress": "Head Office, Ahmedabad",
  "phoneNumber": "+919999999999",
  "companyLogo": "https://cdn.acme.com/logo.png",
  "shortDescription": "We help companies hire faster with structured interview workflows.",
  "linkedinUrl": "https://www.linkedin.com/company/acme",
  "twitterUrl": "https://x.com/acme",
  "termsAccepted": true
}
```
