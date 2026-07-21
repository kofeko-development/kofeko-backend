# Email Deliverability Audit — Kofeko Transactional Mail

**Date:** 2026-07-21  
**Scope:** Forgot-password and other transactional email via Resend (`kofeko-backend/src/common/email/emailProvider.ts`)

## Active provider

| Setting | Value |
|---------|--------|
| Provider | **Resend** (when `RESEND_API_KEY` is set) |
| Effective From | `env.RESEND_EFFECTIVE_FROM` — from `RESEND_FROM` or dev fallback `Kofeko <onboarding@resend.dev>` |
| Local `.env` | `RESEND_API_KEY` set; `RESEND_FROM=noreply@kofeko.com` |
| SMTP (Mailpit) | Configured but **bypassed** while Resend key is present |

## DNS lookup results (`kofeko.com`)

Checked via `nslookup` on 2026-07-21:

### SPF (`TXT kofeko.com`)

```
v=spf1 include:_spf.google.com ~all
```

- Includes **Google Workspace only**
- **Missing** `include:amazonses.com` or Resend's SPF include (`send.resend.com` / `include:resend.com` per Resend dashboard)

### DKIM (Resend selector `resend._domainkey.kofeko.com`)

```
No CNAME record found
```

- Resend DKIM CNAME records are **not published**
- Domain cannot be verified for sending `@kofeko.com` via Resend until DKIM (and usually SPF) are added in Cloudflare

### DMARC (`TXT _dmarc.kofeko.com`)

```
Non-existent domain
```

- No DMARC policy record
- Recommended for production deliverability and alignment

## Root cause

Sending from `noreply@kofeko.com` through Resend **fails or lands in spam** because:

1. `kofeko.com` is not verified in Resend (missing DKIM CNAMEs)
2. SPF authorizes Google, not Resend
3. No DMARC policy

Resend API errors typically include `domain is not verified` or `invalid_from` — see `emailProvider.ts` logging.

## Required fixes (DNS / Resend dashboard)

1. **Resend:** Add domain `kofeko.com` at [resend.com/domains](https://resend.com/domains)
2. **Cloudflare DNS:** Add the DKIM CNAME records Resend provides (e.g. `resend._domainkey` → Resend target)
3. **SPF:** Update TXT to include Resend, e.g.  
   `v=spf1 include:_spf.google.com include:amazonses.com ~all`  
   (use exact include shown in Resend dashboard)
4. **DMARC (recommended):**  
   `_dmarc.kofeko.com` TXT `v=DMARC1; p=none; rua=mailto:dmarc@kofeko.com`
5. **Wait** for Resend domain status = **Verified**
6. **Confirm** `RESEND_FROM=Kofeko <noreply@kofeko.com>` matches verified domain

### Development workaround (no DNS changes)

Unset `RESEND_FROM` in local `.env` while `NODE_ENV=development` — backend uses `onboarding@resend.dev` automatically (`env.RESEND_EFFECTIVE_FROM`).

For staging without verified domain:

```env
RESEND_FROM=Kofeko <onboarding@resend.dev>
```

## Live test procedure

### Option A — API (staff forgot-password)

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"<existing-staff@workspace-domain>","tenantSlug":"<slug>"}'
```

Note: API returns 200 even if email unknown (anti-enumeration). Use a **known existing** staff account.

### Option B — Ops script

```bash
cd kofeko-backend
npx ts-node scripts/send-test-password-reset-email.ts --email you@yourworkspace.com
```

### Option C — Superadmin forgot-password

```bash
curl -X POST http://localhost:3000/api/v1/superadmin/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"<superadmin@workspace-domain>"}'
```

## E2E re-test checklist (after DNS fix)

| Step | Staff | Superadmin |
|------|-------|------------|
| Request reset | `/forgot-password` | `/superadmin/forgot-password` |
| Email received | Workspace inbox (not spam) | Workspace inbox |
| Reset link works | `/reset-password?token=...` | `/superadmin/reset-password?token=...` |
| Old sessions revoked | Yes | Yes |
| Resend Activity | No bounce / domain errors | No bounce / domain errors |

## Test results (pre-fix)

| Test | Result | Notes |
|------|--------|-------|
| DNS SPF | Partial | Google only |
| DNS DKIM (Resend) | **Fail** | Missing CNAME |
| DNS DMARC | **Fail** | Missing record |
| Resend `@kofeko.com` | **Blocked** | Domain not verified |
| Dev `onboarding@resend.dev` | **Pass** | Use until DNS complete |

**Status:** Deliverability to Google Workspace from `@kofeko.com` requires DNS + Resend verification above. Code path is correct; configuration/DNS is the blocker.

## Post-fix verification

After DNS propagation:

1. Re-run `nslookup` for SPF, DKIM, DMARC
2. Confirm Resend dashboard shows **Verified**
3. Trigger forgot-password to a Workspace test inbox
4. Update the table above with pass/fail and Resend message IDs
