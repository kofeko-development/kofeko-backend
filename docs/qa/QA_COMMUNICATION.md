# QA — Communication Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: 111d301  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 8.1 | Advance pipeline stage | stage advances + email arrives | 200 + email received | PASS | Advanced to `screening`; MailHog subject: `Your application for QA Comm Job has been updated`. |
| 8.2 | Verify email content | contains candidate/job/stage/company | present | PASS | HTML body includes candidate name, job title, stage and portal link. |
| 8.3 | Advance to offer | offer template used | offer email received | PASS | MailHog subject decoded to `Congratulations - You've received an offer for QA Comm Job`. |
| 8.4 | Advance to rejected | rejection template used | rejection email received | PASS | MailHog subject: `Your application for QA Comm Job at QA Communication Tenant`. |
| 8.5 | Assign interviewer | interviewer receives assignment email | email received | PASS | MailHog subject: `Interview assignment: Cand One for QA Comm Job`. |
| 8.6 | Verify interviewer email | has candidate/job/stage | present | PASS | Body includes candidate + job and link to dashboard. |
| 8.7 | Message record created | message row exists | present | PASS | `GET /communication/messages` returned message types: `stage_advance`, `offer`, `rejection`, `interview_assignment`, `manual`. |
| 8.8 | Notification record created | notification row exists | present | PASS | `GET /communication/notifications` returned corresponding notification entries with `status=sent`. |
| 8.9 | Manual send | 200 + email received | 200 + email received | PASS | `POST /communication/send` sent `QA Manual Send` to `manual+...`. |
| 8.10 | List messages paginated | correct pagination | correct | PASS | `totalPages` and `items[]` returned with limit 5. |
| 8.11 | Messages tenant-scoped | other tenant cannot see | isolated | PASS | Second tenant querying first tenantId returned empty list. |

## Issues found
- **Minor (encoding)**: Offer email subject in MailHog appeared RFC2047 encoded (`=?UTF-8?Q?...?=`) in the raw headers, but decodes correctly to the expected text.
- **Potential behavior to confirm**: `notifications/unread` returned `0` after sending notifications (suggesting notifications are created as already-read, or unread logic is not tracking these email notifications).

## Screenshots / response samples

- **Tenant slug used**: `qa-comm-20260507153852`
- **Screening stage email subject 8.1**: `Your application for QA Comm Job has been updated`
- **Offer email subject 8.3**: `Congratulations - You've received an offer for QA Comm Job`
- **Rejection email subject 8.4**: `Your application for QA Comm Job at QA Communication Tenant`
- **Interviewer assignment subject 8.5**: `Interview assignment: Cand One for QA Comm Job`

- **Manual send 8.9 (snippet)**:

```json
{"success":true,"message":"Message sent successfully","data":{"type":"manual","subject":"QA Manual Send","recipient":"manual+qa-comm-20260507153852@example.com","status":"sent"}}
```

## Verdict: PASS

Commit: `qa: communication module testing complete [pass]`

