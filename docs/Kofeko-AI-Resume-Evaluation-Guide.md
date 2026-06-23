# Kofeko AI Resume Evaluation — Simple Guide

**How resumes are parsed, how scores work, and what weight / skills / years mean**

Version: June 2026 · Kofeko hiring platform

---

## 1. Big picture (30-second summary)

When you click **Evaluate with AI** (or use **AI Evaluation Lab**), Kofeko does this:

1. **Reads** the resume file (PDF, DOCX, or TXT) and turns it into plain text.
2. **Sends** that text + the **job title**, **job description (JD)**, and **skill priorities (weights)** to the AI (Replicate).
3. The AI **compares** the resume to the job and returns a **match % (0–100)** plus a detailed breakdown.

There is **no fixed Excel-style formula** in code (like `score = weight × years`). The **AI follows written scoring rules** and produces numbers. Your **weights** tell the AI which skills matter most; the AI decides how much each section and skill affects the final %.

---

## 2. Two different “resume parsing” flows

| Flow | When it runs | Purpose |
|------|----------------|---------|
| **Profile parse** | Candidate uploads resume on **My Profile** (`/portal/parse-resume`) | Fill profile fields: skills, experience, education, projects |
| **Evaluation parse** | **Evaluate with AI** or **AI Lab** | Score resume against a specific job |

Both start by extracting **text** from the file, then use AI — but evaluation is much deeper (scoring + hiring intelligence).

### Step A — Extract text (not AI)

| File type | How text is extracted |
|-----------|------------------------|
| **TXT** | Read directly |
| **PDF** | `pdf-parse` library (with fallback if needed) |
| **DOCX** | `mammoth` library |

- Max file size: **8 MB**
- For evaluation, only the first **~14,000 characters** of resume text are sent to the AI (very long resumes may be truncated).

### Step B — AI understands the resume

The AI reads the text and builds structured data, for example:

- Professional summary  
- Skills list  
- Work experience (company, role, dates, bullet points)  
- Education  
- Projects and technologies  
- Hobbies (low impact on score)

---

## 3. What goes into an evaluation?

The AI receives:

1. **Job title** — e.g. “Senior MERN Stack Developer”  
2. **Job description (JD)** — full text of role, responsibilities, requirements  
3. **Company skill priorities** — list of skills with **weight 0–10** each  
4. **Resume text** — extracted from the candidate’s file  

**Important:** In the current system, only **skill name** and **weight** are sent to the evaluation AI. The **years of experience** field on each skill (from JD Creator / job posting) is **saved on the job** but **not yet passed** into the evaluation prompt. The AI still **infers** years from resume dates and experience section when scoring.

---

## 4. Skill weight — what it means

**Weight = how important this skill is for YOUR company on THIS job.**

| Weight | Meaning (typical use) |
|--------|---------------------|
| **9–10** | Must-have / deal-breaker (e.g. React for a React role) |
| **7–8** | Very important |
| **5–6** | Important but not mandatory |
| **3–4** | Nice to have |
| **1–2** | Bonus / minor |

- Scale: **0 to 10** (integers).  
- Set on the job when you create/edit a posting or generate a JD.  
- Higher weight → missing that skill hurts the score **more**.  
- Finding strong evidence for a **high-weight** skill helps the score **more**.

### How the AI uses weight (from system rules)

For each priority skill the AI returns a **skill match row**:

| Field | Meaning |
|-------|---------|
| **skill** | Skill name (e.g. “Node.js”) |
| **weight** | Your priority 0–10 |
| **matched** | `true` if resume shows evidence (synonyms OK, e.g. React / React.js) |
| **contribution** | How much this skill helped the score (0–100 scale per row; higher with strong evidence + higher weight) |
| **evidence** | Short quote or note from the resume |

**Rules the AI follows:**

- Skill **missing** → `matched: false`, `contribution: 0`  
- Skill **present with good evidence** → `matched: true`, contribution **proportional to weight and evidence strength**  
- If you list **no** skill weights, the AI infers priorities **only from the JD text**

---

## 5. Weight vs years of experience — what’s the difference?

| | **Weight (0–10)** | **Years of experience (on skill)** |
|--|-------------------|-------------------------------------|
| **What it is** | How much you **care** about this skill for the role | How many years you **expect** someone to have used it |
| **Set by** | Company on job / JD Creator | Suggested when AI generates JD; stored on job |
| **Used in evaluation today?** | **Yes** — sent to AI | **No** — not in evaluation prompt yet* |
| **Effect on score** | Direct — drives skill match rows | Indirect — AI reads actual years from resume timeline |

\*The AI can still compare resume experience dates to what the JD implies; it just doesn’t receive the numeric “expected years” per skill automatically yet.

### Example: same skill, different weights

Job: **Full Stack Developer**

| Skill | Weight | Candidate A | Candidate B |
|-------|--------|-------------|-------------|
| React | **10** | 3 years React on resume | No React |
| Python | **3** | Expert Python | Expert Python |

**Candidate A** likely scores **higher** — must-have React is matched.  
**Candidate B** has strong Python but **misses weight-10 React** → large penalty.

### Example: same skill name, different weights on two jobs

| Job | React weight | Who wins on React fit? |
|-----|--------------|-------------------------|
| Job 1 “React Lead” | 10 | Candidate with deep React evidence |
| Job 2 “Java Backend” | 2 | React matters little; Java weight matters more |

Same skill on resume → **different impact** depending on job weights.

### If two candidates have the same skills but different years on resume

The AI looks at **experience section scores** and **role fit**, not a simple `years × weight` formula:

- More **relevant** years in the right role → higher **experience** section score → helps **overall %**  
- Junior vs senior for the same stack → reflected in section scores and **roleFitNotes**  
- **Weight** still says *which* skills matter; **resume dates** say *how long* they’ve done it  

**Who scores higher?** Usually the person who matches **high-weight skills with strong, recent evidence** and whose **overall career story fits the JD** (title, domain, seniority).

---

## 6. The match % (overall score) — 0 to 100

**Overall score** = single number shown as **NN% match**.

- Integer from **0 to 100**  
- Same value as **relevanceToRole.matchScorePercent** in the detailed report  
- **Not** a simple average of section scores — AI weighs toward **skills, experience, and projects** for technical roles  

### Section scores (each 0–100)

| Section | What it reflects |
|---------|------------------|
| **skills** | Alignment with required/preferred skills |
| **experience** | Relevant roles, tenure, progression |
| **projects** | Portfolio / project work vs job needs |
| **education** | Degrees, fields, relevance |
| **professionalSummary** | Summary / headline fit |
| **hobbies** | **Minimal** — should barely move overall |

### What pushes the score **up**

- High-weight skills **matched** with clear evidence  
- Experience in **same domain** and similar seniority as JD  
- Strong **projects** using stack from JD  
- JD keywords and responsibilities reflected in resume  
- Clear career progression (**high_growth** / **steady_progression**)

### What pushes the score **down**

- Missing **high-weight (8–10)** skills  
- Wrong specialty (e.g. data science resume for frontend role)  
- Thin or unrelated experience  
- Gaps or weak evidence for must-haves  
- Listed in **matchScoreBreakdown.deductions** (factor + approximate points + reason)

### Hobbies rule

Explicit rule: hobbies must have **negligible** influence on overall score.

---

## 7. Other outputs you see after evaluation

| Output | Purpose |
|--------|---------|
| **rankingSummary** | 2–4 sentences for recruiter shortlist |
| **roleFitNotes** | Honest fit commentary |
| **keyStrengths / areasForGrowth / riskFlags** | Quick scan |
| **interviewRecommendation** | strong_interview · possible_interview · low_priority · reject |
| **suggestedInterviewQuestions** | 8–10 tailored questions |
| **matchScoreBreakdown** | Why score isn’t 100 — deductions list |

When you **Evaluate all** on a job, candidates are ranked by this **overall** score.

---

## 8. End-to-end flow (diagram)

```
Resume file (PDF/DOCX/TXT)
        ↓
Extract plain text (pdf-parse / mammoth)
        ↓
Job title + JD + skill weights (0–10 each)
        ↓
AI (Replicate) — hiring analyst prompt
        ↓
JSON result:
  • parsedResume (structured fields)
  • scores.overall (0–100 %)
  • scores.sections (education, experience, skills, …)
  • scores.skillMatches (per skill: matched, contribution, evidence)
  • hiringIntelligence (strengths, risks, interview rec, …)
        ↓
Saved as Evaluation on candidate (production) or shown in AI Lab (test only)
```

---

## 9. Practical tips for testing (AI Evaluation Lab)

1. **Always set skill weights** before comparing resumes — without them, scoring relies only on JD text.  
2. Put **must-haves at 9–10**, nice-to-haves at 3–5.  
3. Use a **clear, complete JD** — vague JDs produce vague scores.  
4. Compare multiple resumes on the **same JD and weights** to see ranking differences.  
5. Open **Show full analysis** to read deductions and skill match evidence.  
6. Remember: scores are **AI-judged** with rules, not a rigid calculator — re-running can vary slightly.

---

## 10. Quick reference card

| Question | Answer |
|----------|--------|
| What is **weight**? | Importance of a skill for this job (0–10). Higher = bigger impact on score. |
| What is **years** on skill row? | Expected years (JD Creator); **not** sent to evaluator yet — AI reads years from resume. |
| Same skills, different weights? | Higher weight skills drive score more when matched or missed. |
| Same weight, different years on resume? | More relevant experience → higher experience section → usually higher overall. |
| Is score a formula? | No fixed formula in code; AI applies documented rules. |
| Max resume size? | 8 MB; ~14k chars used for AI. |
| AI provider? | Replicate (`REPLICATE_API_TOKEN` required). |

---

## 11. Where this lives in the product

| Feature | Route / location |
|---------|------------------|
| Generate JD + skill suggestions | JD Creator, `POST /api/v1/ai/jd` |
| Evaluate one candidate | Job posting → applicant → **Evaluate with AI** |
| Evaluate all on job | Job posting → **Evaluate all** |
| Test without saving | Sidebar → **AI Lab** (`/ai-evaluation-lab`) |
| Parse resume for profile only | Candidate **My Profile** upload |

---

*This document describes behavior implemented in Kofeko backend (`analyzeResume.ts`, `parseResume.ts`, `evaluation.service.ts`) as of June 2026.*
