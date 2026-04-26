import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()
logger = logging.getLogger(__name__)

class MaterialItem(BaseModel):
    name: str
    catalog_number: Optional[str] = None
    supplier: Optional[str] = None
    unit_price: Optional[float] = None
    quantity: Optional[str] = None

class EmailQuoteRequest(BaseModel):
    supplier: str
    materials: List[MaterialItem]
    experiment_question: str

@router.post("/email-quote")
async def email_quote(body: EmailQuoteRequest):
    """
    Mock endpoint to simulate sending an email quote to a supplier.
    """
    logger.info(f"Simulating email quote to {body.supplier} for {len(body.materials)} items.")
    # In a real scenario, you'd use SendGrid, Resend, or SMTP to email the supplier.
    return {
        "status": "success",
        "message": f"Quote request successfully emailed to {body.supplier}",
        "items_requested": len(body.materials)
    }
