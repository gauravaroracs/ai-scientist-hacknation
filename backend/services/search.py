"""
Literature QC service — domain-restricted Tavily search + novelty classification.
"""
import os
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


TARGET_DOMAINS = [
    "nature.com/nprot",
    "protocols.io",
    "jove.com",
    "bio-protocol.org",
    "openwetware.org",
]

NOVELTY_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a scientific literature analyst. Given a research question and "
                "search results from protocol/methods databases, classify the novelty:\n"
                "- 'exact match found': a protocol for this exact question exists\n"
                "- 'similar work exists': related or adjacent protocols exist\n"
                "- 'not found': no relevant protocols found\n"
                "Reply with ONLY one of those three phrases, nothing else."
            ),
        ),
        (
            "human",
            "Question: {question}\n\nSearch results:\n{search_results}",
        ),
    ]
)


def _build_searcher() -> TavilySearchResults:
    return TavilySearchResults(
        max_results=5,
        include_domains=TARGET_DOMAINS,
        include_answer=True,
    )


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
    searcher = _build_searcher()
    results: list[dict] = searcher.invoke(question)

    references = [r["url"] for r in results if r.get("url")][:3]
    snippets = "\n".join(
        f"- {r.get('title', '')}: {r.get('content', '')[:300]}" for r in results
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
