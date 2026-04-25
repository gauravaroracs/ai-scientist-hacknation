# The AI Scientist
### From Hypothesis to Runnable Experiment — Powered by Fulcrum Science

> Hack-Nation × World Bank Youth Summit · Global AI Hackathon 2026

---

## What It Does

Paste a scientific hypothesis. Get back a complete, operationally grounded lab experiment plan — in under 60 seconds.

**Three stages:**

1. **Literature QC** — domain-restricted search across Nature Protocols, protocols.io, JoVE, Bio-protocol, and OpenWetWare. Returns a novelty signal (`not found` / `similar work exists` / `exact match found`) and up to 3 reference URLs.

2. **Experiment Plan** — GPT-4o with structured output generates:
   - Step-by-step protocol (8–15 steps)
   - Materials list with realistic catalog numbers (Sigma-Aldrich, ThermoFisher, etc.)
   - Itemised budget with USD cost estimates
   - Phased timeline
   - Validation criteria with quantitative success/failure thresholds

3. **Scientist Feedback Loop** *(stretch goal)* — Every plan section is inline-editable. Corrections are embedded and stored in Supabase. The next similar experiment plan automatically reflects those expert corrections via few-shot prompt injection — no retraining required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Python 3.13 |
| LLM | GPT-4o via LangChain |
| Literature Search | Tavily API (domain-restricted) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Feedback Store | Supabase (PostgreSQL + pgvector) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Charts | Recharts |

---

## Project Structure

```
mvp/
├── backend/
│   ├── main.py                   # FastAPI app + CORS + logging
│   ├── routers/
│   │   ├── literature_qc.py      # POST /literature-qc
│   │   ├── generate_plan.py      # POST /generate-plan
│   │   └── feedback.py           # POST /feedback
│   ├── services/
│   │   ├── search.py             # Tavily search + novelty classifier
│   │   ├── planner.py            # LLM plan generation + correction injection
│   │   └── feedback.py           # Supabase store + vector similarity search
│   ├── models/
│   │   └── schemas.py            # All Pydantic models
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── InputPage.jsx     # Hypothesis entry screen
│   │   │   ├── QCPage.jsx        # Literature QC interstitial
│   │   │   └── PlanPage.jsx      # Dashboard (protocol + budget + materials)
│   │   └── components/
│   │       ├── InlineEdit.jsx    # Hover-to-edit with feedback POST
│   │       └── Toast.jsx         # Save confirmation notification
│   ├── vite.config.js
│   └── package.json
├── supabase_setup.sql            # Run once in Supabase SQL Editor
├── Justfile                      # Dev runner
└── README.md
```

---

## Setup

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- [`just`](https://github.com/casey/just) command runner (`brew install just`)
- API keys for OpenAI and Tavily
- A free [Supabase](https://supabase.com) project *(for the feedback loop)*

### 2. Clone and install

```bash
git clone <repo-url>
cd mvp
just install     # creates backend/.venv + pip install + npm install
```

### 3. Configure environment

```bash
just setup       # creates backend/.env from .env.example
```

Edit `backend/.env`:

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...

# For the feedback / learning loop (optional but recommended)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service_role key (legacy JWT format)
```

### 4. Set up Supabase *(feedback loop only)*

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the full contents of `supabase_setup.sql` → **Run**
3. Go to **Settings → API Keys → Legacy anon, service_role API keys**
4. Copy the `service_role` key into `SUPABASE_SERVICE_KEY` in your `.env`
5. Disable RLS on the feedback table (run in SQL Editor):
   ```sql
   ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
   ```

### 5. Run

```bash
just dev         # starts both backend (port 8000) and frontend (port 3000)
```

Or separately:

```bash
just backend     # FastAPI on http://localhost:8000
just frontend    # Vite on http://localhost:3000
```

API docs: `http://localhost:8000/docs`

---

## API Endpoints

### `POST /literature-qc`
```json
{ "question": "Does CRISPR-Cas9 efficiently edit plant cell genomes?" }
```
Returns:
```json
{
  "novelty_signal": "similar work exists",
  "references": ["https://www.nature.com/nprot/..."],
  "context_summary": "..."
}
```

### `POST /generate-plan`
```json
{
  "question": "...",
  "literature_context": "...",
  "references": ["..."]
}
```
Returns: full `ExperimentPlan` with `protocol`, `materials`, `budget`, `timeline`, `validation`.

### `POST /feedback`
```json
{
  "experiment_question": "...",
  "category": "protocol",
  "item_label": "Step 3",
  "original_text": "Use 0.5% LAP photoinitiator",
  "corrected_text": "Use 0.1% LAP photoinitiator",
  "comment": "0.5% causes cell death in GelMA bioinks"
}
```

---

## The Feedback Loop — How It Works

```
CORRECTION SAVED
Scientist edits Step 3: "0.5% LAP" → "0.1% LAP"
    └─ OpenAI embeds the experiment question → 1536-dim vector
    └─ Stored in Supabase: original, corrected, comment, embedding

NEXT SIMILAR EXPERIMENT
New question arrives → /generate-plan
    └─ Embed new question → cosine similarity search (threshold: 0.70)
    └─ Match found → inject into GPT-4o system prompt:
       "Expert correction: use 0.1% LAP, not 0.5% (causes cell death)"
    └─ GPT-4o generates plan with correction already applied
```

No fine-tuning. No retraining. Expert knowledge compounds automatically.

---

## Sample Hypotheses to Test

```
A paper-based electrochemical biosensor functionalized with anti-CRP antibodies
will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L
within 10 minutes, matching laboratory ELISA sensitivity.

Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will
reduce intestinal permeability by at least 30% compared to controls, measured
by FITC-dextran assay.

Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw
viability of HeLa cells by at least 15 percentage points compared to the
standard DMSO protocol.
```

---

## Contact

Built for Hack-Nation × World Bank Youth Summit 2026.
Challenge by [Fulcrum Science](mailto:arun@fulcrum.science).
