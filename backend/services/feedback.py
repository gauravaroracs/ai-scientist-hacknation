"""
Feedback store — saves scientist corrections to Supabase with vector embeddings
and retrieves similar corrections for few-shot prompt injection.

For material price corrections, also updates the material_prices cache directly
so the corrected price is used immediately on next plan generation.
"""
import os
import re
import logging

logger = logging.getLogger(__name__)

# Matches the InlineEdit format for materials:
# "{name} | SKU: {catalog} | Supplier: {supplier} | Price: ${price} | Qty: {qty}"
_SKU_RE     = re.compile(r'SKU:\s*([^\s|]+)')
_SUP_RE     = re.compile(r'Supplier:\s*([^|]+)')
_PRICE_RE   = re.compile(r'Price:\s*\$?([\d,.]+)')


def _parse_material_text(text: str) -> dict:
    """Extract structured fields from a material InlineEdit string."""
    out = {}
    if m := _SKU_RE.search(text):
        out["catalog_number"] = m.group(1).strip()
    if m := _SUP_RE.search(text):
        out["supplier"] = m.group(1).strip()
    if m := _PRICE_RE.search(text):
        try:
            out["unit_price"] = float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    parts = text.split("|")
    if parts:
        out["name"] = parts[0].strip()
    return out


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
    """Embed the experiment question and store the correction in Supabase.

    For material corrections, also updates the material_prices cache so the
    corrected price takes effect immediately on the next plan generation.
    """
    if not _supabase_configured():
        logger.warning("Supabase not configured — correction not saved.")
        return

    # ── Material price cache update ────────────────────────────────────────────
    if category == "material":
        _update_price_cache(original_text, corrected_text, item_label)

    # ── Persist correction with embedding for few-shot retrieval ───────────────
    logger.info("Generating embedding for question: %.80s", experiment_question)
    embedding = _embed(experiment_question)
    logger.info("Embedding generated (%d dims). Inserting into Supabase...", len(embedding))

    client = _get_client()
    try:
        response = client.table("feedback").insert(
            {
                "experiment_question": experiment_question,
                "category":            category,
                "item_label":          item_label,
                "original_text":       original_text,
                "corrected_text":      corrected_text,
                "comment":             comment,
                "embedding":           embedding,
            }
        ).execute()
        logger.info("Supabase insert OK: %s", response.data)
    except Exception as exc:
        logger.error("Supabase insert FAILED: %s", exc, exc_info=True)
        raise


def _update_price_cache(original_text: str, corrected_text: str, item_label: str) -> None:
    """
    Parse catalog number, supplier, and new price from a corrected material string
    and upsert them into the material_prices cache as a manual correction.
    """
    try:
        from services.prices import upsert_price
        orig = _parse_material_text(original_text)
        corr = _parse_material_text(corrected_text)

        catalog  = corr.get("catalog_number") or orig.get("catalog_number", "")
        supplier = corr.get("supplier")       or orig.get("supplier", "")
        name     = corr.get("name")           or orig.get("name") or item_label
        price    = corr.get("unit_price")

        if catalog and supplier and price is not None:
            upsert_price(catalog, supplier, name, price, source="manual")
            logger.info("Price cache updated from correction: %s/%s = $%.2f", catalog, supplier, price)
        else:
            logger.debug(
                "Price cache not updated — missing fields (catalog=%r, supplier=%r, price=%r)",
                catalog, supplier, price,
            )
    except Exception as exc:
        logger.warning("Price cache update failed: %s", exc)


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
