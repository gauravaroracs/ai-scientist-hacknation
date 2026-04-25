from pydantic import BaseModel, Field
from typing import Literal


# ── Request models ────────────────────────────────────────────────────────────

class LiteratureQCRequest(BaseModel):
    question: str = Field(..., description="Plain-language scientific question")


class GeneratePlanRequest(BaseModel):
    question: str = Field(..., description="Original scientific question")
    literature_context: str = Field(
        default="", description="Snippet summaries from retrieved literature"
    )
    references: list[str] = Field(
        default_factory=list, description="Reference URLs from QC step"
    )


# ── Response models ───────────────────────────────────────────────────────────

NoveltySignal = Literal["not found", "similar work exists", "exact match found"]


class LiteratureQCResponse(BaseModel):
    novelty_signal: NoveltySignal
    references: list[str] = Field(default_factory=list)
    context_summary: str = Field(
        default="", description="Brief summary of found literature for downstream use"
    )


class Material(BaseModel):
    name: str
    catalog_number: str
    supplier: str
    unit_price: float
    quantity: str


class BudgetLine(BaseModel):
    item: str
    cost: float


class TimelinePhase(BaseModel):
    phase: str
    tasks: list[str]


class ValidationCriterion(BaseModel):
    metric: str = Field(..., description="What is being measured (e.g. cell viability, absorbance)")
    method: str = Field(..., description="How it is measured (e.g. flow cytometry, ELISA)")
    success_threshold: str = Field(..., description="Quantitative threshold for success (e.g. ≥85% viability)")
    failure_indicator: str = Field(..., description="What a failed result looks like")


class FeedbackRequest(BaseModel):
    experiment_question: str
    category: Literal["protocol", "material", "budget", "timeline", "validation"]
    item_label: str = Field(default="", description="Human-readable label e.g. 'Step 3' or 'GelMA'")
    original_text: str
    corrected_text: str
    comment: str = ""


class FeedbackResponse(BaseModel):
    success: bool
    message: str


class ExperimentPlan(BaseModel):
    protocol: list[str] = Field(..., description="Ordered step-by-step instructions")
    materials: list[Material]
    budget: list[BudgetLine]
    total_budget: float
    timeline: list[TimelinePhase]
    validation: list[ValidationCriterion] = Field(
        ..., description="How success or failure of the experiment will be measured"
    )
