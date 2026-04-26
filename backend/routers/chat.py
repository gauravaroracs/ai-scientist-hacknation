import logging
from typing import Any
from openai import AsyncOpenAI
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)
client = AsyncOpenAI()


# ── Request models ─────────────────────────────────────────────────────────────

class MessagePart(BaseModel):
    type: str
    text: str | None = None


class ChatMessage(BaseModel):
    role: str
    # v2 SDK: content is a plain string
    content: str | None = None
    # v3 SDK: content is parts array
    parts: list[MessagePart] | None = None
    # v3 extra fields — ignored
    id: str | None = None

    def get_text(self) -> str:
        """Extract plain text regardless of SDK version."""
        if self.parts:
            return "".join(p.text or "" for p in self.parts if p.type == "text")
        return self.content or ""


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict = {}
    # v3 extra top-level fields — ignored
    id: str | None = None
    trigger: str | None = None


# ── System prompt ──────────────────────────────────────────────────────────────

def _build_system_prompt(context: dict) -> str:
    question  = context.get("question", "")
    protocol  = context.get("protocol", [])
    materials = context.get("materials", [])
    budget    = context.get("total_budget", "")
    timeline  = context.get("timeline", [])
    papers    = context.get("papers", [])
    novelty   = context.get("novelty_signal", "")
    refs      = context.get("references", [])

    # Plan context (PlanPage chat)
    protocol_text = "\n".join(
        f"  {i+1}. {s['step'] if isinstance(s, dict) else s}"
        for i, s in enumerate(protocol[:8])
    )
    materials_text = "\n".join(
        f"  - {m['name']} ({m.get('catalog_number','')}, {m.get('supplier','')}): ${m.get('unit_price','')}"
        for m in materials[:6]
    )
    timeline_text = "\n".join(
        f"  {p['phase']}: {', '.join(p['tasks'][:2])}"
        for p in timeline
    )

    # Literature context (QCPage chat)
    papers_text = "\n".join(
        f"  [{i+1}] {p.get('title','')} ({p.get('year','')}, {p.get('venue','')})"
        f" — {p.get('citation_count',0)} citations\n"
        f"      Abstract: {(p.get('abstract') or '')[:300]}"
        for i, p in enumerate(papers[:8])
    )
    refs_text = "\n".join(f"  {i+1}. {r}" for i, r in enumerate(refs[:8]))

    has_plan      = bool(protocol or materials or timeline)
    has_literature = bool(papers or refs)

    if has_plan:
        return f"""You are an expert scientific advisor embedded in The AI Scientist platform.
You are helping a researcher understand and refine their experiment plan.

HYPOTHESIS:
{question}

GENERATED PROTOCOL (first 8 steps):
{protocol_text or "Not available"}

KEY MATERIALS:
{materials_text or "Not available"}

ESTIMATED BUDGET: ${budget}

TIMELINE:
{timeline_text or "Not available"}

Your role:
- Answer questions about the protocol steps, reagent choices, concentrations, and methodology
- Explain the scientific reasoning behind each step
- Suggest alternatives if asked (e.g. different suppliers, reagent substitutions)
- Flag potential risks or failure modes in specific steps
- Be concise and precise — this is a professional scientific context
- If asked something outside the scope of this experiment, gently redirect

Do NOT make up catalog numbers or prices not already in the plan."""

    if has_literature:
        return f"""You are an expert scientific literature analyst embedded in The AI Scientist platform.
A researcher has submitted the following hypothesis and retrieved relevant papers. Help them understand the literature.

HYPOTHESIS:
{question}

NOVELTY SIGNAL: {novelty}

RETRIEVED PAPERS:
{papers_text or "No papers available"}

REFERENCE URLS:
{refs_text or "None"}

Your role:
- Summarise key findings across the retrieved papers
- Assess how the hypothesis relates to existing work
- Identify methodological approaches used in similar research
- Point out gaps, contradictions, or opportunities in the literature
- Be specific — cite paper titles or years when relevant
- Be concise and precise — this is a professional scientific context"""

    return f"""You are an expert scientific advisor in The AI Scientist platform.
The researcher's hypothesis is: {question}
Answer their questions about scientific methodology, literature, and experimental design."""


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(body: ChatRequest):
    """Streams an OpenAI response grounded in the experiment plan or literature context."""

    system_prompt = _build_system_prompt(body.context)
    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m.role, "content": m.get_text()}
        for m in body.messages
        if m.role in ("user", "assistant") and m.get_text()
    ]

    async def generate():
        try:
            stream = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True,
                max_tokens=600,
                temperature=0.4,
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content or ""
                if text:
                    yield text
        except Exception as exc:
            logger.error("Chat stream failed: %s", exc)
            yield f"\n\n[Error: {exc}]"

    return StreamingResponse(generate(), media_type="text/plain")
