"""
Literature QC service — Semantic Scholar search + OpenAI novelty classification.
"""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_FIELDS = [
    "title",
    "url",
    "abstract",
    "year",
    "venue",
    "citationCount",
]

NOVELTY_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a scientific literature analyst. Given a research question and "
                "scholarly search results, classify the novelty:\n"
                "- 'exact match found': papers describe this exact experiment or protocol\n"
                "- 'similar work exists': related or adjacent papers/protocols exist\n"
                "- 'not found': no relevant scholarly work found\n"
                "Reply with ONLY one of those three phrases, nothing else."
            ),
        ),
        (
            "human",
            "Question: {question}\n\nSearch results:\n{search_results}",
        ),
    ]
)


def _search_semantic_scholar(question: str) -> list[dict]:
    api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
    if not api_key:
        raise RuntimeError("SEMANTIC_SCHOLAR_API_KEY is not configured.")

    params = urlencode(
        {
            "query": question,
            "limit": 5,
            "fields": ",".join(SEMANTIC_SCHOLAR_FIELDS),
        }
    )
    request = Request(
        f"{SEMANTIC_SCHOLAR_API_URL}?{params}",
        headers={
            "x-api-key": api_key,
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Semantic Scholar request failed with status {exc.code}: {detail}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"Semantic Scholar request failed: {exc.reason}") from exc

    return payload.get("data", [])


def _build_classifier() -> object:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    return NOVELTY_PROMPT | llm | StrOutputParser()


def run_literature_qc(question: str) -> dict:
    """
    Returns:
        {
            "novelty_signal": "not found" | "similar work exists" | "exact match found",
            "references": [...urls],
            "context_summary": "...",
        }
    """
    results = _search_semantic_scholar(question)

    references = [r["url"] for r in results if r.get("url")][:3]
    snippets = "\n".join(
        (
            f"- {r.get('title', 'Untitled')} "
            f"({r.get('year', 'n.d.')}, {r.get('venue', 'Unknown venue')}): "
            f"{(r.get('abstract') or '')[:300]}"
        )
        for r in results
    )
    context_summary = snippets[:1500]  # cap for downstream prompt

    if not results:
        return {
            "novelty_signal": "not found",
            "references": [],
            "context_summary": "",
        }

    classifier = _build_classifier()
    raw = classifier.invoke({"question": question, "search_results": snippets})
    raw = raw.strip().lower()

    valid = {"not found", "similar work exists", "exact match found"}
    novelty_signal = raw if raw in valid else "similar work exists"

    return {
        "novelty_signal": novelty_signal,
        "references": references,
        "context_summary": context_summary,
    }
