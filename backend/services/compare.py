"""
Alternative-product comparison service.

For a given reagent, runs a broad Tavily search (no site: filter) to find
the same product listed by competing suppliers, then uses GPT-4o-mini to
extract a structured alternatives list.
"""
import json
import logging
import os
import re

logger = logging.getLogger(__name__)

_SUPPLIER_ALIASES: dict[str, str] = {
    "milliporesigma":      "Sigma-Aldrich",
    "sigma aldrich":       "Sigma-Aldrich",
    "thermo fisher":       "ThermoFisher",
    "thermo scientific":   "ThermoFisher",
    "life technologies":   "ThermoFisher",
    "invitrogen":          "ThermoFisher",
    "bio rad":             "Bio-Rad",
    "fisher scientific":   "Fisher Scientific",
    "fishersci":           "Fisher Scientific",
    "new england biolabs": "NEB",
}

_SUPPLIER_URLS: dict[str, str] = {
    "Sigma-Aldrich":     "sigmaaldrich.com",
    "ThermoFisher":      "thermofisher.com",
    "Bio-Rad":           "bio-rad.com",
    "Fisher Scientific": "fishersci.com",
    "VWR":               "vwr.com",
    "NEB":               "neb.com",
    "ATCC":              "atcc.org",
}


def _norm(s: str) -> str:
    return _SUPPLIER_ALIASES.get(s.strip().lower(), s.strip())


def _gpt_alternatives(name: str, current_norm: str, quantity: str, snippets: str = "") -> list[dict]:
    """
    Use GPT-4o-mini to produce alternative supplier entries.
    When snippets are provided they guide the extraction; otherwise the model
    falls back to its own training-data knowledge.
    """
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser

    human_msg = (
        f"Reagent: {name}\n"
        f"Requested quantity: {quantity or 'standard pack'}\n"
        f"Current supplier (EXCLUDE from results): {current_norm}\n"
    )
    if snippets:
        human_msg += f"\nSearch snippets:\n{snippets}"
    else:
        human_msg += (
            "\nNo live search data available. "
            "Use your training knowledge to list realistic alternatives."
        )

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a lab procurement assistant. "
         "List up to 4 alternative suppliers for the requested reagent.\n\n"
         "For each supplier (EXCLUDING the current one), return:\n"
         "  - supplier: company name\n"
         "  - catalog_number: SKU/catalog number (or null)\n"
         "  - unit_price: realistic USD price for the closest pack size (numeric, no $)\n"
         "  - url: product page URL (or null)\n"
         "  - cas_number: CAS registry number e.g. '7732-18-5' (or null)\n"
         "  - purity: purity spec e.g. '≥99.5%' (or null)\n"
         "  - grade: quality grade e.g. 'Molecular Biology Grade' (or null)\n"
         "  - form: physical form e.g. 'Powder', 'Solution' (or null)\n\n"
         "Return ONLY valid JSON — an array of up to 4 objects. "
         "If genuinely nothing is known, return []."),
        ("human", human_msg),
    ])

    raw = (
        prompt | ChatOpenAI(model="gpt-4o-mini", temperature=0) | StrOutputParser()
    ).invoke({}).strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    data = json.loads(raw)
    return data if isinstance(data, list) else []


def _clean_alternatives(raw_list: list, current_norm: str) -> list[dict]:
    cleaned = []
    for alt in raw_list:
        sup = _norm(str(alt.get("supplier", "")))
        if not sup or sup.lower() == current_norm.lower():
            continue
        price = alt.get("unit_price")
        try:
            price = float(price) if price is not None else None
        except (TypeError, ValueError):
            price = None

        url = alt.get("url") or None
        if not url:
            domain = _SUPPLIER_URLS.get(sup)
            url = f"https://www.{domain}" if domain else None

        cleaned.append({
            "supplier":       sup,
            "catalog_number": alt.get("catalog_number") or "N/A",
            "unit_price":     price,
            "url":            url,
            "cas_number":     alt.get("cas_number") or None,
            "purity":         alt.get("purity") or None,
            "grade":          alt.get("grade") or None,
            "form":           alt.get("form") or None,
        })
    return cleaned


def find_alternatives(name: str, current_supplier: str, quantity: str = "") -> list[dict]:
    """
    Search for the same reagent offered by competing suppliers.

    Returns up to 4 dicts:
        { supplier, catalog_number, unit_price, url, cas_number, purity, grade, form }

    Tries Tavily search first; falls back to GPT knowledge if search fails or
    returns no usable results.
    """
    current_norm = _norm(current_supplier)
    snippets = ""

    if os.getenv("TAVILY_API_KEY"):
        try:
            from langchain_community.tools.tavily_search import TavilySearchResults
            query = f'"{name}" reagent lab buy catalog number price'
            results = TavilySearchResults(max_results=8).invoke(query)
            if results:
                snippets = "\n\n".join(
                    f"URL: {r.get('url', '')}\n{(r.get('content') or '')[:500]}"
                    for r in results[:7]
                )
        except Exception as exc:
            logger.warning("Tavily search failed for %r: %s", name, exc)

    try:
        raw_list = _gpt_alternatives(name, current_norm, quantity, snippets)
        cleaned = _clean_alternatives(raw_list, current_norm)
        logger.info("Found %d alternatives for %r (snippets=%s)", len(cleaned), name, bool(snippets))
        return cleaned[:4]
    except Exception as exc:
        logger.warning("GPT alternatives failed for %r: %s", name, exc)
        return []


def get_substance_details(name: str, supplier: str, catalog_number: str = "") -> dict:
    """
    Fetch CAS number, purity, grade, and physical form for the current product.
    Tries Tavily first; falls back to GPT knowledge if search fails or is unavailable.
    """
    sup     = _norm(supplier)
    snippets = ""

    if os.getenv("TAVILY_API_KEY"):
        try:
            from langchain_community.tools.tavily_search import TavilySearchResults
            query = f'"{name}" {sup} {catalog_number} CAS number purity grade specifications'.strip()
            results = TavilySearchResults(max_results=5).invoke(query)
            if results:
                snippets = "\n\n".join(
                    f"URL: {r.get('url', '')}\n{(r.get('content') or '')[:500]}"
                    for r in results[:4]
                )
        except Exception as exc:
            logger.warning("Tavily substance search failed for %r: %s", name, exc)

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        human_msg = f"Reagent: {name}\nSupplier: {sup}\nCatalog: {catalog_number or 'unknown'}\n"
        if snippets:
            human_msg += f"\nSearch snippets:\n{snippets}"
        else:
            human_msg += "\nNo live search data — use your training knowledge."

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are a lab procurement assistant. Return substance properties for the "
             "specified reagent.\n\n"
             "Output ONLY valid JSON with these fields (use null if genuinely unknown):\n"
             '{{"cas_number": "7732-18-5", "purity": "≥99.5%", '
             '"grade": "Molecular Biology Grade", "form": "Powder"}}'),
            ("human", human_msg),
        ])

        raw = (
            prompt | ChatOpenAI(model="gpt-4o-mini", temperature=0) | StrOutputParser()
        ).invoke({}).strip()

        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
        data = json.loads(raw)

        return {
            "cas_number": data.get("cas_number") or None,
            "purity":     data.get("purity") or None,
            "grade":      data.get("grade") or None,
            "form":       data.get("form") or None,
        }

    except Exception as exc:
        logger.warning("Substance details lookup failed for %r: %s", name, exc)
        return {}
