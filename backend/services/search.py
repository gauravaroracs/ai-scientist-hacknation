"""
Literature QC service — Semantic Scholar (primary) + Tavily web search (fallback).

Uses Semantic Scholar when SEMANTIC_SCHOLAR_API_KEY is set (or even without a key
at 1 req/s). Falls back to Tavily restricted to protocol repositories when
SEMANTIC_SCHOLAR_API_KEY is absent and TAVILY_API_KEY is present.
"""
import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

logger = logging.getLogger(__name__)

# ── Semantic Scholar ───────────────────────────────────────────────────────────

SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_FIELDS  = ["title", "url", "abstract", "year", "venue", "citationCount"]

# ── Tavily fallback domains ────────────────────────────────────────────────────

TAVILY_DOMAINS = [
    "nature.com/nprot",
    "protocols.io",
    "jove.com",
    "bio-protocol.org",
    "openwetware.org",
]

# ── Novelty classifier prompt ──────────────────────────────────────────────────

NOVELTY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a scientific literature analyst. Given a research question and "
        "search results, classify the novelty:\n"
        "- 'exact match found': an existing paper or protocol describes this exact experiment\n"
        "- 'similar work exists': related or adjacent papers/protocols exist\n"
        "- 'not found': no relevant scholarly work found\n"
        "Reply with ONLY one of those three phrases, nothing else."
    )),
    ("human", "Question: {question}\n\nSearch results:\n{search_results}"),
])


# ── Search backends ────────────────────────────────────────────────────────────

def _search_semantic_scholar(question: str) -> list[dict]:
    api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
    params  = urlencode({
        "query":  question,
        "limit":  10,
        "fields": ",".join(SEMANTIC_SCHOLAR_FIELDS),
    })
    headers = {"Accept": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    req = Request(
        f"{SEMANTIC_SCHOLAR_API_URL}?{params}",
        headers=headers,
        method="GET",
    )
    with urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    results = data.get("data", [])
    if not results:
        raise ValueError(f"Semantic Scholar returned no results (total={data.get('total', 0)})")
    return results


def _format_semantic_scholar(results: list[dict]) -> tuple[list[str], str, list[dict]]:
    """Return (references, snippets, papers) from Semantic Scholar results."""
    # Sort by citation count descending so the most impactful papers surface first
    results = sorted(results, key=lambda r: r.get("citationCount", 0) or 0, reverse=True)
    references = [r["url"] for r in results if r.get("url")][:8]
    papers     = [
        {
            "title":          r.get("title", "Untitled"),
            "url":            r.get("url", ""),
            "year":           str(r.get("year", "")),
            "venue":          r.get("venue", ""),
            "abstract":       (r.get("abstract") or "")[:400],
            "citation_count": r.get("citationCount", 0),
        }
        for r in results
        if r.get("title")  # skip empty results
    ][:8]
    snippets = "\n".join(
        f"- {p['title']} ({p['year']}, {p['venue']}): {p['abstract'][:300]}"
        for p in papers
    )
    return references, snippets, papers


def _search_tavily(question: str) -> list[dict]:
    from langchain_community.tools.tavily_search import TavilySearchResults
    searcher = TavilySearchResults(
        max_results=5,
        include_domains=TAVILY_DOMAINS,
        include_answer=True,
    )
    return searcher.invoke(question)


def _format_tavily(results: list[dict]) -> tuple[list[str], str, list[dict]]:
    """Return (references, snippets, papers) from Tavily results."""
    references = [r["url"] for r in results if r.get("url")][:3]
    papers     = [
        {
            "title":          r.get("title", ""),
            "url":            r.get("url", ""),
            "year":           "",
            "venue":          "",
            "abstract":       r.get("content", "")[:400],
            "citation_count": 0,
        }
        for r in results
    ][:3]
    snippets = "\n".join(
        f"- {p['title']}: {p['abstract'][:300]}" for p in papers
    )
    return references, snippets, papers


# ── Main entry point ───────────────────────────────────────────────────────────

def run_literature_qc(question: str) -> dict:
    """
    Returns:
        {
            "novelty_signal": "not found" | "similar work exists" | "exact match found",
            "references": [...urls],
            "context_summary": "...",
        }
    """
    references, snippets, papers = [], "", []

    # Try Semantic Scholar first (works without a key at 1 req/s)
    try:
        results = _search_semantic_scholar(question)
        references, snippets, papers = _format_semantic_scholar(results)
        logger.info("Semantic Scholar returned %d results", len(results))
    except Exception as exc:
        logger.warning("Semantic Scholar failed (%s) — trying Tavily fallback", exc)
        try:
            results = _search_tavily(question)
            references, snippets, papers = _format_tavily(results)
            logger.info("Tavily fallback returned %d results", len(results))
        except Exception as exc2:
            logger.error("Both search backends failed: %s", exc2)

    if not snippets:
        return {"novelty_signal": "not found", "references": [], "context_summary": "", "papers": []}

    context_summary = snippets[:1500]

    llm        = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    classifier = NOVELTY_PROMPT | llm | StrOutputParser()
    raw        = classifier.invoke({"question": question, "search_results": snippets})
    raw        = raw.strip().lower()

    valid          = {"not found", "similar work exists", "exact match found"}
    novelty_signal = raw if raw in valid else "similar work exists"

    return {
        "novelty_signal":  novelty_signal,
        "references":      references,
        "context_summary": context_summary,
        "papers":          papers,
    }
