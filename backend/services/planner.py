"""
Experiment plan generation service using LLM with structured output.
Injects relevant past expert corrections via few-shot prompting.
"""
from functools import lru_cache

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from models.schemas import ExperimentPlan
from services.feedback import get_relevant_corrections, format_corrections_for_prompt


SYSTEM_BASE = (
    "You are an expert experimental scientist and lab planner. "
    "Given a scientific question and relevant literature context, generate a complete, "
    "realistic experiment plan.\n\n"
    "Guidelines:\n"
    "- Protocol: 8-15 numbered steps, specific and actionable\n"
    "- Materials: 5-12 reagents/equipment; use realistic catalog numbers "
    "  (e.g., Sigma-Aldrich catalog format: 'A1978', ThermoFisher: 'AM9738', "
    "  VWR: '89125-162', Bio-Rad: '1610177')\n"
    "- Budget: line items matching materials + consumables + equipment rental; "
    "  prices in USD realistic for academic labs\n"
    "- Total budget: sum of all budget lines\n"
    "- Timeline: 2-4 phases (e.g., 'Week 1', 'Week 2-3', 'Week 4') "
    "  each with 2-5 concrete tasks\n"
    "- Validation: 2-4 criteria defining how success or failure will be measured. "
    "  Each criterion must include: the metric being measured, the method used to measure it, "
    "  a quantitative success threshold, and what a failed result looks like.\n"
    "Be specific, scientifically accurate, and practically useful."
)

HUMAN_TEMPLATE = (
    "Scientific question: {question}\n\n"
    "Literature context:\n{literature_context}\n\n"
    "Reference protocols:\n{references}"
    "{corrections_block}"
)


@lru_cache(maxsize=256)
def _generate_cached_plan(
    question: str,
    literature_context: str,
    references_text: str,
    corrections_block: str,
) -> ExperimentPlan:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_BASE),
            ("human", HUMAN_TEMPLATE),
        ]
    )

    # Keep generation deterministic for identical inputs.
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = prompt | llm.with_structured_output(ExperimentPlan)

    return chain.invoke(
        {
            "question": question,
            "literature_context": literature_context,
            "references": references_text,
            "corrections_block": corrections_block,
        }
    )


def generate_experiment_plan(
    question: str,
    literature_context: str,
    references: list[str],
) -> ExperimentPlan:
    # ── Retrieve relevant past expert corrections ──────────────────────────
    corrections = get_relevant_corrections(question)
    corrections_block = format_corrections_for_prompt(corrections)

    refs_text = "\n".join(f"- {url}" for url in references) if references else "None"
    normalized_context = literature_context or "No prior literature found."

    result = _generate_cached_plan(
        question=question,
        literature_context=normalized_context,
        references_text=refs_text,
        corrections_block=corrections_block,
    )
    return result
