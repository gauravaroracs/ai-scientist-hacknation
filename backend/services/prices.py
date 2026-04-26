"""
Price lookup and caching.

Priority per material:
  1. Supabase material_prices cache (manual corrections always win)
  2. Tavily web search for current supplier price
  3. LLM-generated price (kept and cached so future runs are deterministic)

Required Supabase table:
  CREATE TABLE material_prices (
      catalog_number TEXT NOT NULL,
      supplier       TEXT NOT NULL,
      name           TEXT,
      unit_price     FLOAT NOT NULL,
      source         TEXT DEFAULT 'llm',   -- 'llm' | 'tavily' | 'manual'
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (catalog_number, supplier)
  );
"""
import asyncio
import logging
import os
import re
from functools import partial

logger = logging.getLogger(__name__)

_PRICE_RE = re.compile(r'\$\s*([\d,]+(?:\.\d{1,2})?)')


def _supabase_ok() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"))


def _db():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


# ── Cache helpers ──────────────────────────────────────────────────────────────

def lookup_cached_price(catalog_number: str, supplier: str, name: str = "") -> float | None:
    """
    Return the cached price for a material, or None.

    Lookup order:
      1. catalog_number + supplier  (exact, most specific)
      2. name + supplier            (fallback when LLM invents a different SKU)
    """
    if not _supabase_ok():
        return None
    db = _db()
    try:
        # 1. Exact catalog + supplier match
        if catalog_number.strip():
            row = (
                db.table("material_prices")
                .select("unit_price")
                .eq("catalog_number", catalog_number.strip().upper())
                .eq("supplier", supplier.strip())
                .limit(1)
                .execute()
            )
            if row.data:
                return float(row.data[0]["unit_price"])

        # 2. Name + supplier fallback (catches same reagent with different SKU)
        if name.strip() and supplier.strip():
            row = (
                db.table("material_prices")
                .select("unit_price")
                .ilike("name", name.strip())
                .ilike("supplier", supplier.strip())
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            if row.data:
                logger.info("Price cache hit (by name) for %r/%r", name, supplier)
                return float(row.data[0]["unit_price"])

    except Exception as exc:
        logger.warning("Price cache lookup failed: %s", exc)
    return None


def upsert_price(
    catalog_number: str,
    supplier: str,
    name: str,
    unit_price: float,
    source: str = "tavily",
) -> None:
    """Upsert a price into the Supabase material_prices cache."""
    if not _supabase_ok() or not catalog_number.strip():
        return
    try:
        _db().table("material_prices").upsert(
            {
                "catalog_number": catalog_number.strip().upper(),
                "supplier":       supplier.strip(),
                "name":           name,
                "unit_price":     round(unit_price, 2),
                "source":         source,
            },
            on_conflict="catalog_number,supplier",
        ).execute()
        logger.info("Cached price %s/%s = $%.2f (%s)", catalog_number, supplier, unit_price, source)
    except Exception as exc:
        logger.error("Price cache upsert failed for %s/%s: %s", catalog_number, supplier, exc, exc_info=True)


# ── Tavily price search ────────────────────────────────────────────────────────

def _extract_price(text: str) -> float | None:
    """Pull the first plausible USD price from a text string."""
    for m in _PRICE_RE.finditer(text):
        try:
            val = float(m.group(1).replace(",", ""))
            if 0.50 < val < 50_000:
                return val
        except ValueError:
            pass
    return None


def search_price_tavily(name: str, catalog_number: str, supplier: str) -> float | None:
    """
    Query Tavily for the current list price of a reagent.
    Returns None if Tavily is not configured or no price found.
    """
    if not os.getenv("TAVILY_API_KEY"):
        return None

    query = f"{supplier} {catalog_number} {name} price USD buy"
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults
        results = TavilySearchResults(max_results=3, include_answer=True).invoke(query)

        # 1. Try the answer field first (most concise)
        for r in results:
            if price := _extract_price(r.get("answer") or ""):
                logger.info("Tavily price (answer) for %s: $%.2f", catalog_number, price)
                return price

        # 2. Try result content
        for r in results:
            if price := _extract_price(r.get("content") or ""):
                logger.info("Tavily price (content) for %s: $%.2f", catalog_number, price)
                return price

        # 3. Fallback: ask GPT to interpret the snippets
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        snippets = "\n".join(
            f"[{r.get('title', '')}] {(r.get('content') or '')[:300]}"
            for r in results[:3]
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "Extract the USD unit price for the specified lab reagent from these search results. "
             "Reply with ONLY a plain number like 45.99 or the word 'unknown'. No symbols, no text."),
            ("human",
             f"Reagent: {name} (catalog: {catalog_number}, supplier: {supplier})\n\n{snippets}"),
        ])
        raw = (
            prompt | ChatOpenAI(model="gpt-4o-mini", temperature=0) | StrOutputParser()
        ).invoke({}).strip()

        if raw.lower() != "unknown":
            try:
                val = float(raw.replace("$", "").replace(",", ""))
                if 0.50 < val < 50_000:
                    logger.info("Tavily price (llm-extract) for %s: $%.2f", catalog_number, val)
                    return val
            except ValueError:
                pass

    except Exception as exc:
        logger.warning("Tavily price search failed for %s: %s", catalog_number, exc)

    return None


# ── Per-material enrichment ────────────────────────────────────────────────────

def enrich_material_price(material: dict) -> dict:
    """
    Resolve the real price for a single material.
    Priority: Supabase cache → Tavily → LLM price (cached for determinism).
    """
    cat       = material.get("catalog_number", "")
    sup       = material.get("supplier", "")
    name      = material.get("name", "")
    llm_price = float(material.get("unit_price") or 0)

    # 1. Supabase cache (includes manual corrections from scientists)
    cached = lookup_cached_price(cat, sup, name)
    if cached is not None:
        return {**material, "unit_price": cached}

    # 2. Tavily live search
    tavily_price = search_price_tavily(name, cat, sup)
    if tavily_price is not None:
        upsert_price(cat, sup, name, tavily_price, source="tavily")
        return {**material, "unit_price": tavily_price}

    # 3. Keep LLM price — cache it so the same catalog number is deterministic next time
    if llm_price > 0:
        upsert_price(cat, sup, name, llm_price, source="llm")

    return material


async def enrich_materials_with_prices(materials: list[dict]) -> list[dict]:
    """Enrich all materials with real prices, running lookups in parallel."""
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, partial(enrich_material_price, m))
        for m in materials
    ]
    return list(await asyncio.gather(*tasks))
