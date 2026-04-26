# The AI Scientist — Progress & Feature Map

> This file is intended for LLMs and developers picking up this codebase.
> It explains what has been built, how it fits together, and what remains.

---

## Project Summary

An AI-powered tool that takes a natural language scientific hypothesis and returns
a complete, operationally grounded lab experiment plan. Built for the
Hack-Nation × World Bank Youth Summit Global AI Hackathon 2026, in collaboration
.

**Live stack:** FastAPI (Python) + React/Vite + Supabase (pgvector) + OpenAI GPT-4o + Semantic Scholar

---

## Architecture Overview

```
User (browser)
    │
    ▼
React SPA (Vite, port 3000)
    │  POST /literature-qc
    │  POST /generate-plan
    │  POST /feedback
    ▼
FastAPI Backend (port 8000)
    ├── /literature-qc  → Semantic Scholar search → GPT-4o-mini novelty classifier
    ├── /generate-plan  → Supabase similarity search → GPT-4o structured output
    └── /feedback       → OpenAI embedding → Supabase insert
            │
            ▼
    Supabase (PostgreSQL + pgvector)
        └── feedback table (corrections + 1536-dim embeddings)
```

---

## Completed Features

### Backend

| Feature | File | Status |
|---|---|---|
| FastAPI app with CORS | `backend/main.py` | ✅ Done |
| POST /literature-qc | `backend/routers/literature_qc.py` | ✅ Done |
| POST /generate-plan | `backend/routers/generate_plan.py` | ✅ Done |
| POST /feedback | `backend/routers/feedback.py` | ✅ Done |
| Semantic Scholar literature search | `backend/services/search.py` | ✅ Done |
| GPT-4o structured plan generation | `backend/services/planner.py` | ✅ Done |
| Novelty signal classification | `backend/services/search.py` | ✅ Done |
| Supabase feedback store | `backend/services/feedback.py` | ✅ Done |
| OpenAI embedding (text-embedding-3-small) | `backend/services/feedback.py` | ✅ Done |
| Vector similarity search (pgvector) | `backend/services/feedback.py` | ✅ Done |
| Few-shot correction injection into prompt | `backend/services/planner.py` | ✅ Done |
| Pydantic v2 schemas for all I/O | `backend/models/schemas.py` | ✅ Done |

### Frontend

| Feature | File | Status |
|---|---|---|
| Input screen (hypothesis entry) | `frontend/src/pages/InputPage.jsx` | ✅ Done |
| Literature QC interstitial screen | `frontend/src/pages/QCPage.jsx` | ✅ Done |
| Plan dashboard (protocol + tabs) | `frontend/src/pages/PlanPage.jsx` | ✅ Done |
| Protocol stepper (interactive, click to expand) | `PlanPage.jsx` | ✅ Done |
| Budget tab with Recharts donut chart | `PlanPage.jsx` | ✅ Done |
| Materials tab (SKU, supplier, price) | `PlanPage.jsx` | ✅ Done |
| Timeline tab (phased breakdown) | `PlanPage.jsx` | ✅ Done |
| Validation tab (success/failure criteria) | `PlanPage.jsx` | ✅ Done |
| Inline editing on every plan section | `frontend/src/components/InlineEdit.jsx` | ✅ Done |
| Toast notification on save | `frontend/src/components/Toast.jsx` | ✅ Done |
| Correction counter in top bar | `PlanPage.jsx` | ✅ Done |
| React Router v6 with state passing | `frontend/src/App.jsx` | ✅ Done |
| Vite proxy to backend | `frontend/vite.config.js` | ✅ Done |
| Light academic theme (Lora + Source Sans 3) | `frontend/src/index.css` | ✅ Done |

### Infrastructure

| Feature | File | Status |
|---|---|---|
| Supabase SQL setup (pgvector + match_feedback RPC) | `supabase_setup.sql` | ✅ Done |
| Python virtualenv in backend/.venv | `backend/.venv/` | ✅ Done |
| Justfile dev runner (just dev / backend / frontend) | `Justfile` | ✅ Done |
| Environment variable template | `backend/.env.example` | ✅ Done |

---

## Data Models

### ExperimentPlan (response from /generate-plan)
```python
class ExperimentPlan(BaseModel):
    protocol: list[str]                  # ordered steps
    materials: list[Material]            # name, catalog_number, supplier, unit_price, quantity
    budget: list[BudgetLine]             # item, cost
    total_budget: float
    timeline: list[TimelinePhase]        # phase, tasks[]
    validation: list[ValidationCriterion] # metric, method, success_threshold, failure_indicator
```

### Feedback (stored in Supabase)
```sql
feedback (
    id UUID,
    experiment_question TEXT,
    category TEXT,           -- protocol | material | budget | timeline | validation
    item_label TEXT,         -- e.g. "Step 3" or "GelMA"
    original_text TEXT,
    corrected_text TEXT,
    comment TEXT,
    embedding VECTOR(1536)   -- text-embedding-3-small on experiment_question
)
```

---

## The Feedback Loop (Stretch Goal — Implemented)

This is the key differentiator. How it works end-to-end:

1. Scientist views a generated plan and disagrees with a value (e.g. LAP concentration)
2. They hover a protocol step → click Edit → change the text → optionally add a comment → Save
3. `POST /feedback` is called → `experiment_question` is embedded via `text-embedding-3-small`
4. The embedding + correction is stored in Supabase's `feedback` table

5. Next time a *similar* question arrives at `/generate-plan`:
   - The question is embedded
   - `match_feedback()` Supabase RPC runs cosine similarity search (threshold: 0.70)
   - Matching corrections are formatted into a prompt block
   - Injected into GPT-4o's system prompt as expert few-shot examples
   - The new plan reflects the expert correction **without any re-prompting**

---

## Literature Search Source

```text
Semantic Scholar Academic Graph API
- query-based paper search
- top 5 papers returned
- title, URL, abstract, venue, year, citation count used for novelty review
```

---

## What's Not Built Yet

| Feature | Priority | Notes |
|---|---|---|
| User authentication | Medium | No login system — single-user only |
| Feedback history UI | Low | Corrections are stored but not viewable in the app |
| Export to PDF/Word | Medium | Plan is web-only, no download |
| Experiment type tagging | Low | Would improve similarity search precision |
| Rate limiting | Medium | No API rate limits on endpoints |
| Error boundary (frontend) | Low | No global error catching in React |
| Fine-tuning loop | Stretch | Few-shot is implemented; actual fine-tuning is not |

---

## Environment Variables

```env
OPENAI_API_KEY        # GPT-4o + text-embedding-3-small
SEMANTIC_SCHOLAR_API_KEY  # Literature search
SUPABASE_URL          # https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  # service_role key (legacy JWT format, starts with eyJ)
```

---

## Running Locally

```bash
just install   # set up venv + npm
just setup     # create backend/.env
just dev       # start both servers (backend: 8000, frontend: 3000)
```

API docs auto-generated at `http://localhost:8000/docs`
