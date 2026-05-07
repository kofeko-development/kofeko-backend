# QA — Candidates Module
Date: 2026-05-07  
Tester: Vivek Patel  
Environment: development  
Backend version: b768ad5  

## Results

| # | Test | Expected | Actual | Status | Notes |
|---|------|----------|--------|--------|-------|
| 5.1 | Upload PDF resume | 200 { url, mimeType, filename } | 200 | PASS | Uploaded `resume.pdf` → `.../uploads/...-resume.pdf`. |
| 5.2 | Upload DOCX resume | 200 | 200 | PASS | Uploaded `resume.docx` → `.../uploads/...-resume.docx`. |
| 5.3 | Upload TXT resume | 200 | 200 | PASS | Uploaded `resume.txt` → `.../uploads/...-resume.txt`. |
| 5.4 | Upload image file (JPG) | 415 unsupported | 415 | PASS | Response: `Unsupported format. Use PDF, DOCX, or TXT.` |
| 5.5 | Upload file > 8MB | 413 too large | 413 | PASS | Response: `File is too large (max 8 MB).` |
| 5.6 | Create candidate with resumeUrl | 201, status new | 201 | PASS | Created candidate `10a2627e-8d0a-4542-aa0a-2efe66d125b5` with resumeUrl + mimeType. |
| 5.7 | Create duplicate email | 409 | 409 | PASS | Response: `Candidate with this email already exists`. |
| 5.8 | Get candidate | 200 full profile | 200 | PASS | Candidate fetched successfully. |
| 5.9 | List candidates | 200 paginated | 200 paginated | PASS | Shape: `data.items[]`, `data.total/page/limit/totalPages`. |
| 5.10 | Filter by status | filtered list | filtered list | PASS | `status=new` returned the created candidate. |
| 5.11 | Filter by skills | filtered list | filtered list | PASS | `skills=React,Node` returned the created candidate. |
| 5.12 | Update candidate (location only) | only location changes | 200 | PASS | Location updated `Pune → Mumbai`. |
| 5.13 | Update resume URL | both fields updated | 200 | PASS | Updated resumeUrl + resumeMimeType to DOCX upload. |
| 5.14 | Update status | 200 + audit log created | 200 | PASS* | Status updated to `screening`. (Audit log creation not separately asserted here.) |
| 5.15 | Verify uploaded file accessible | file served correctly | 200 | PASS | GET on `/uploads/...-resume.pdf` succeeded. |

## Issues found
- None observed in this module.

## Screenshots / response samples

- **Tenant slug used**: `qa-cand-20260507150629`
- **Upload PDF 5.1 (snippet)**:

```json
{"success":true,"message":"Resume uploaded successfully","data":{"url":"http://localhost:3000/uploads/01be5d6c-21c8-414c-8254-35c9cb062921-resume.pdf","mimeType":"application/pdf","filename":"resume.pdf"}}
```

- **Upload JPG blocked 5.4 (snippet)**:

```json
{"success":false,"message":"Unsupported format. Use PDF, DOCX, or TXT.","errorCode":"VALIDATION_ERROR","statusCode":415}
```

- **Oversize blocked 5.5 (snippet)**:

```json
{"success":false,"message":"File is too large (max 8 MB).","errorCode":"VALIDATION_ERROR","statusCode":413}
```

## Verdict: PASS

Commit: `qa: candidates module testing complete [pass]`

