from fastapi import APIRouter, HTTPException
from models.schemas import FeedbackRequest, FeedbackResponse
from services.feedback import save_correction

router = APIRouter()


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(body: FeedbackRequest) -> FeedbackResponse:
    """
    Store a scientist's correction to an AI-generated plan section.
    The correction is embedded and saved to Supabase for future few-shot retrieval.
    """
    try:
        save_correction(
            experiment_question=body.experiment_question,
            category=body.category,
            item_label=body.item_label,
            original_text=body.original_text,
            corrected_text=body.corrected_text,
            comment=body.comment,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return FeedbackResponse(success=True, message="Correction saved.")
