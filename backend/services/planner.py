"""
Experiment plan generation — staged LLM calls with real progress.

Stage 1: Fetch expert corrections from Supabase (vector search)
Stage 2: Generate protocol (GPT call 1)
Stage 3: Generate materials (GPT call 2)
Stage 4: Generate budget + timeline + validation (GPT call 3)
"""
from functools import lru_cache

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from models.schemas import (
    ExperimentPlan,
    ProtocolStep,
    ProtocolOnly,
    MaterialsOnly,
    BudgetTimelineValidation,
)
from services.feedback import get_relevant_corrections, format_corrections_for_prompt


def _llm():
    return ChatOpenAI(model="gpt-5-mini", temperature=1)


def _steps_text(protocol: list[ProtocolStep]) -> str:
    """Stringify protocol steps for downstream prompts."""
    return "\n".join(f"{i+1}. {s.step}" for i, s in enumerate(protocol))


# ── Stage 2: Protocol ──────────────────────────────────────────────────────────

_PROTOCOL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert experimental scientist. Generate a precise, step-by-step lab protocol "
        "for the given hypothesis. Produce 8-15 specific, actionable steps grounded in published methods. "
        "Each step should be a single clear instruction a lab technician can follow directly.\n\n"
        "IMPORTANT: For each step, populate the 'citations' field with any reference URLs (from the "
        "References section below) that directly support or ground that step. Only cite URLs that were "
        "provided — do not invent URLs. If no reference applies to a step, leave citations empty."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Literature context:\n{literature_context}\n\n"
        "References (cite these URLs in relevant steps):\n{references}"
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


# ── Stage 4: Budget + Timeline + Validation ────────────────────────────────────

_BTW_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a scientific project manager. Given a protocol and materials list, produce:\n"
        "- Budget: line items (materials + consumables + equipment rental) with USD costs. "
        "  Total must equal sum of all line items.\n"
        "- Timeline: 2-4 phases (e.g. 'Week 1', 'Week 2-3') each with 2-5 concrete tasks.\n"
        "- Validation: 2-4 criteria — each with a metric, measurement method, "
        "  quantitative success threshold, and failure indicator."
        "{corrections_block}"
    )),
    ("human", (
        "Hypothesis: {question}\n\n"
        "Protocol:\n{protocol}\n\n"
        "Materials:\n{materials}"
    )),
])


def generate_budget_timeline_validation(
    question: str,
    protocol: list[ProtocolStep],
    materials: list[dict],
    corrections_block: str,
) -> dict:
    materials_text = "\n".join(
        f"- {m['name']} ({m['catalog_number']}, {m['supplier']}): ${m['unit_price']} / {m['quantity']}"
        for m in materials
    )
    chain = _BTW_PROMPT | _llm().with_structured_output(BudgetTimelineValidation)
    result: BudgetTimelineValidation = chain.invoke({
        "question": question,
        "protocol": _steps_text(protocol),
        "materials": materials_text,
        "corrections_block": corrections_block,
    })
    return result.model_dump()


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


@lru_cache(maxsize=256)
def _generate_cached_plan(
    question: str,
    literature_context: str,
    references_text: str,
    corrections_block: str,
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
