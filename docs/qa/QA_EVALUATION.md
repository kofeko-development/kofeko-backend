# QA — Evaluation Module (Regression)

Date: 2026-06-01  
Tester: Cursor Agent  
Environment: development (localhost FE :3000, BE :5000)  
Backend branch: `rajdeep_dev` @ kofeko-development/kofeko-backend  

## Summary

| Category | Result |
|----------|--------|
| Typecheck | PASS |
| DB / seed / login | PASS |
| Live API regression (script) | **PARTIAL** — 9 PASS, 1 FAIL (Replicate 401), 3 SKIP |
| AI provider wiring | PASS — `aiJsonCompletion` uses Replicate when token set |
| Code review (routes + service + FE) | PASS |

## Regression script

```powershell
cd kofeko_backend
npm run seed:test
powershell -ExecutionPolicy Bypass -File .\scripts\qa-evaluation-regression.ps1
```

Output: `kofeko_backend/scripts/qa-evaluation-regression-results.json`

## Results (2026-06-01)

| ID | Test | Status | Notes |
|----|------|--------|-------|
| ENV | Staff login | PASS | |
| 6.0–6.0b | Job + pipeline + resume | PASS | Senior React Developer |
| 6.2–6.4 | Guards (weights / resume / 404) | PASS | |
| 6.1 | POST ai-evaluate | FAIL | Replicate 401 — refresh `REPLICATE_API_TOKEN` |
| 6.8–6.9 | List / GET / PATCH | SKIP | After 6.1 |
| 6.5–6.7 | Batch + rankings | PASS | |

## Issues

- **Env:** Invalid `REPLICATE_API_TOKEN` (401 from api.replicate.com). Replace in `.env` and restart `npm run dev`.

## Prior results (2026-05-07)

All 15 backend evaluation API cases **PASS** when DB and AI credentials were valid.
