"""
Experiment plan generation — staged LLM calls with real progress.

Stage 1: Fetch expert corrections from Supabase (vector search)
Stage 2: Generate protocol (GPT call 1)
Stage 3: Generate materials (GPT call 2)
Stage 4: Generate budget + timeline + validation (GPT call 3)
"""
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from models.schemas import (
    ExperimentPlan,
    ProtocolStep,
    ProtocolOnly,
    MaterialsOnly,
    OverheadOnly,
    BudgetTimelineValidation,
)
from services.feedback import get_relevant_corrections, format_corrections_for_prompt


def _llm():
    return ChatOpenAI(model="gpt-4o-mini", temperature=0.3)


def _steps_text(protocol: list[ProtocolStep]) -> str:
    """Stringify protocol steps for downstream prompts."""
    return "\n".join(f"{i+1}. {s.step}" for i, s in enumerate(protocol))


# ── Stage 2: Protocol ──────────────────────────────────────────────────────────

_PROTOCOL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert experimental scientist. Generate a precise, step-by-step lab protocol "
        "for the given hypothesis. Produce 8-15 specific, actionable steps grounded in published methods. "
        "Each step should be a single clear instruction a lab technician can follow directly.\n\n"
        "CITATIONS — this is mandatory:\n"
        "- You are given a list of reference URLs below.\n"
        "- For EVERY step, assign the most relevant reference URL(s) from that list to the 'citations' field.\n"
        "- Distribute citations across steps — do not concentrate them all on one step.\n"
        "- If a step is a general lab technique, cite the reference whose method is closest.\n"
        "- Only use URLs from the provided list — do not invent URLs.\n"
        "- Aim for at least 80% of steps to have at least one citation."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Literature context:\n{literature_context}\n\n"
        "References (you MUST cite these across protocol steps):\n{references}"
    )),
])


def generate_protocol(
    question: str,
    literature_context: str,
    refs_text: str,
    corrections_block: str,
) -> list[ProtocolStep]:
    chain = _PROTOCOL_PROMPT | _llm().with_structured_output(ProtocolOnly)
    result: ProtocolOnly = chain.invoke({
        "question": question,
        "literature_context": literature_context or "No prior literature found.",
        "references": refs_text,
        "corrections_block": corrections_block,
    })
    return result.protocol


# ── Stage 3: Materials ─────────────────────────────────────────────────────────

_MATERIALS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a lab procurement expert. Given a protocol, generate a realistic materials list. "
        "Use real catalog numbers: Sigma-Aldrich format (e.g. 'A1978'), ThermoFisher (e.g. 'AM9738'), "
        "VWR (e.g. '89125-162'), Bio-Rad (e.g. '1610177'). Include 5-12 items with accurate unit prices in USD."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Protocol steps:\n{protocol}"
    )),
])


def generate_materials(
    question: str,
    protocol: list[ProtocolStep],
    corrections_block: str,
) -> list[dict]:
    chain = _MATERIALS_PROMPT | _llm().with_structured_output(MaterialsOnly)
    result: MaterialsOnly = chain.invoke({
        "question": question,
        "protocol": _steps_text(protocol),
        "corrections_block": corrections_block,
    })
    return [m.model_dump() for m in result.materials]


# ── Stage 4: Overhead + Timeline + Validation ─────────────────────────────────
# Material costs come directly from the enriched materials list (deterministic).
# The LLM only estimates additional overhead: equipment, services, consumables.

_OVERHEAD_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a scientific project manager. The reagent costs are already fixed — do NOT include them.\n"
        "Your job is to estimate ADDITIONAL overhead costs only:\n"
        "  • Equipment rental / depreciation (e.g. centrifuge time, flow cytometer)\n"
        "  • Core facility / sequencing services\n"
        "  • Consumables not in the materials list (gloves, tubes, plates, tips)\n"
        "  • Safety / waste disposal\n"
        "Produce 2–5 overhead line items with realistic USD costs.\n"
        "Also produce the timeline (2-4 phases) and validation criteria (2-4 items)."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Protocol:\n{protocol}\n\n"
        "Fixed reagent costs (already accounted for — do not repeat):\n{materials}"
    )),
])


def generate_budget_timeline_validation(
    question: str,
    protocol: list[ProtocolStep],
    materials: list[dict],
    corrections_block: str,
) -> dict:
    materials_text = "\n".join(
        f"- {m['name']} ({m.get('catalog_number','')}, {m.get('supplier','')}): ${m['unit_price']} / {m.get('quantity','')}"
        for m in materials
    )

    chain = _OVERHEAD_PROMPT | _llm().with_structured_output(OverheadOnly)
    result: OverheadOnly = chain.invoke({
        "question":          question,
        "protocol":          _steps_text(protocol),
        "materials":         materials_text,
        "corrections_block": corrections_block,
    })

    # Build budget deterministically: material lines (exact prices) + LLM overhead
    material_lines = [
        {"item": m["name"], "cost": round(float(m.get("unit_price", 0)), 2)}
        for m in materials
        if m.get("unit_price", 0) > 0
    ]
    overhead_lines = [o.model_dump() for o in result.overhead]
    all_lines      = material_lines + overhead_lines
    total          = round(sum(line["cost"] for line in all_lines), 2)

    return {
        "budget":       all_lines,
        "total_budget": total,
        "timeline":     [p.model_dump() for p in result.timeline],
        "validation":   [v.model_dump() for v in result.validation],
    }


# ── Single-shot (legacy, used by non-streaming endpoint) ──────────────────────

_PLAN_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert experimental scientist and lab planner. "
        "Generate a complete, realistic experiment plan.\n\n"
        "Guidelines:\n"
        "- Protocol: 8-15 specific, actionable steps, each with citations from provided references\n"
        "- Materials: 5-12 items with real catalog numbers and USD prices\n"
        "- Budget: line items + total\n"
        "- Timeline: 2-4 phases with concrete tasks\n"
        "- Validation: 2-4 criteria with quantitative thresholds\n"
        "Be scientifically accurate and practically useful."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Literature context:\n{literature_context}\n\n"
        "References (cite in protocol steps where relevant):\n{references}"
    )),
])


def generate_experiment_plan(
    question: str,
    literature_context: str,
    references: list[str],
) -> ExperimentPlan:
    corrections = get_relevant_corrections(question)
    corrections_block = format_corrections_for_prompt(corrections)

    chain = _PLAN_PROMPT | _llm().with_structured_output(ExperimentPlan)
    refs_text = "\n".join(f"- {u}" for u in references) if references else "None"

    return chain.invoke({
        "question": question,
        "literature_context": literature_context or "No prior literature found.",
        "references": refs_text,
        "corrections_block": corrections_block,
    })
