from fastapi import APIRouter, HTTPException
from models.schemas import LiteratureQCRequest, LiteratureQCResponse
from services.search import run_literature_qc

router = APIRouter()


@router.post("/literature-qc", response_model=LiteratureQCResponse)
async def literature_qc(body: LiteratureQCRequest) -> LiteratureQCResponse:
    """
    Performs a Semantic Scholar literature search and classifies novelty.
    """
    try:
        result = run_literature_qc(body.question)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return LiteratureQCResponse(**result)
