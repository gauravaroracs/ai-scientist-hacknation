"""
Feedback store — saves scientist corrections to Supabase with vector embeddings
and retrieves similar corrections for few-shot prompt injection.
"""
import os
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


def _supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"))


def _get_client():
    from supabase import create_client
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


def _embed(text: str) -> list[float]:
    from langchain_openai import OpenAIEmbeddings
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")
    return embedder.embed_query(text)


def save_correction(
    experiment_question: str,
    category: str,
    item_label: str,
    original_text: str,
    corrected_text: str,
    comment: str = "",
) -> None:
    """Embed the experiment question and store the correction in Supabase."""
    if not _supabase_configured():
        logger.warning("Supabase not configured — correction not saved.")
        return

    logger.info("Generating embedding for question: %.80s", experiment_question)
    embedding = _embed(experiment_question)
    logger.info("Embedding generated (%d dims). Inserting into Supabase...", len(embedding))

    client = _get_client()
    try:
        response = client.table("feedback").insert(
            {
                "experiment_question": experiment_question,
                "category": category,
                "item_label": item_label,
                "original_text": original_text,
                "corrected_text": corrected_text,
                "comment": comment,
                "embedding": embedding,
            }
        ).execute()
        logger.info("Supabase insert OK: %s", response.data)
    except Exception as exc:
        logger.error("Supabase insert FAILED: %s", exc, exc_info=True)
        raise


def get_relevant_corrections(experiment_question: str, limit: int = 6) -> list[dict]:
    """
    Vector-similarity search: return past expert corrections relevant to this question.
    Returns empty list if Supabase is not configured or search fails.
    """
    if not _supabase_configured():
        return []

    try:
        embedding = _embed(experiment_question)
        client = _get_client()
        result = client.rpc(
            "match_feedback",
            {
                "query_embedding": embedding,
                "match_threshold": 0.70,
                "match_count": limit,
            },
        ).execute()
        return result.data or []
    except Exception as exc:
        logger.error("Feedback retrieval failed: %s", exc)
        return []


def format_corrections_for_prompt(corrections: list[dict]) -> str:
    """Format retrieved corrections into an LLM-injectable block."""
    if not corrections:
        return ""

    lines = [
        "\n\n--- EXPERT SCIENTIST CORRECTIONS FROM SIMILAR PAST EXPERIMENTS ---",
        "Apply these evidence-based corrections when generating the plan:",
    ]
    for c in corrections:
        label = f"[{c['category'].upper()}]"
        if c.get("item_label"):
            label += f" {c['item_label']}"
        orig = c["original_text"][:120].replace("\n", " ")
        fixed = c["corrected_text"][:120].replace("\n", " ")
        line = f'  • {label}: Change "{orig}" → "{fixed}"'
        if c.get("comment"):
            line += f' (Expert note: {c["comment"]})'
        lines.append(line)
    lines.append("--- END OF CORRECTIONS ---")
    return "\n".join(lines)
