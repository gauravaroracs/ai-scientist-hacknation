import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()
logger = logging.getLogger(__name__)

import os
import resend

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
    to_email: Optional[str] = None

@router.post("/email-quote")
async def email_quote(body: EmailQuoteRequest):
    """
    Sends an email quote to a supplier using Resend.
    """
    logger.info(f"Sending email quote to {body.supplier} for {len(body.materials)} items.")
    
    resend_api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("FROM_EMAIL", "onboarding@resend.dev") # Fallback to resend default
    
    if not resend_api_key:
        logger.warning("RESEND_API_KEY not found. Simulating email instead.")
        return {
            "status": "success",
            "message": f"[MOCK] Quote request successfully emailed to {body.supplier}",
            "items_requested": len(body.materials)
        }
    
    resend.api_key = resend_api_key
    
    # Format the email content
    materials_html = "".join([
        f"<li><b>{m.name}</b> (SKU: {m.catalog_number or 'N/A'}) - Qty: {m.quantity or 'N/A'}</li>"
        for m in body.materials
    ])
    
    html_content = f"""
    <h2>Quote Request: {body.supplier}</h2>
    <p>We are conducting an experiment: <i>"{body.experiment_question}"</i> and would like to request a formal quote for the following materials:</p>
    <ul>
        {materials_html}
    </ul>
    <p>Please provide pricing and availability at your earliest convenience.</p>
    <p>Thank you,<br>The AI Scientist Lab</p>
    """
    
    # Send the email
    to_address = body.to_email if body.to_email else "delivered@resend.dev"
    
    try:
        r = resend.Emails.send({
            "from": from_email,
            "to": to_address,
            "subject": f"Quote Request: Lab Materials for AI Scientist",
            "html": html_content
        })
        logger.info(f"Resend email sent successfully: {r}")
        return {
            "status": "success",
            "message": f"Quote request successfully emailed to {to_address}",
            "items_requested": len(body.materials)
        }
    except Exception as e:
        logger.error(f"Failed to send email via Resend: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
