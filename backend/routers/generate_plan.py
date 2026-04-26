import asyncio
import json
import logging
from functools import partial
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import GeneratePlanRequest, ExperimentPlan
from services.planner import (
    generate_experiment_plan,
    generate_protocol,
    generate_materials,
    generate_budget_timeline_validation,
)
from services.feedback import get_relevant_corrections, format_corrections_for_prompt

router = APIRouter()
logger = logging.getLogger(__name__)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _run(fn, *args):
    """Run a sync LLM/IO function in a thread so it doesn't block the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args))


@router.post("/generate-plan/stream")
async def generate_plan_stream(body: GeneratePlanRequest):
    """
    Streaming endpoint — emits SSE progress events as each stage completes,
    then sends the full plan in the final event.
    """
    async def event_generator():
        refs_text = "\n".join(f"- {u}" for u in body.references) if body.references else "None"

        try:
            # Stage 1 — corrections
            yield _sse({"stage": "Retrieving expert corrections from database…", "pct": 5})
            await asyncio.sleep(0)  # flush to client before blocking
            corrections = await _run(get_relevant_corrections, body.question)
            corrections_block = format_corrections_for_prompt(corrections)
            logger.info("Corrections retrieved: %d", len(corrections))

            # Stage 2 — protocol
            yield _sse({"stage": "Generating step-by-step protocol…", "pct": 20})
            await asyncio.sleep(0)
            protocol = await _run(
                generate_protocol,
                body.question, body.literature_context, refs_text, corrections_block
            )
            logger.info("Protocol generated: %d steps", len(protocol))

            # Stage 3 — materials
            yield _sse({"stage": "Selecting reagents and catalog numbers…", "pct": 45})
            await asyncio.sleep(0)
            materials = await _run(generate_materials, body.question, protocol, corrections_block)
            logger.info("Materials generated: %d items", len(materials))

            # Stage 4 — budget / timeline / validation
            yield _sse({"stage": "Estimating budget, timeline and validation criteria…", "pct": 70})
            await asyncio.sleep(0)
            btv = await _run(
                generate_budget_timeline_validation,
                body.question, protocol, materials, corrections_block
            )
            logger.info("Budget/timeline/validation generated")

            # Assemble and return
            yield _sse({"stage": "Finalising experiment plan…", "pct": 92})
            await asyncio.sleep(0)
            plan = {
                "protocol": [s.model_dump() for s in protocol],
                "materials": materials,
                **btv,
            }

            yield _sse({"stage": "done", "pct": 100, "plan": plan})

        except Exception as exc:
            logger.error("Streaming plan generation failed: %s", exc, exc_info=True)
            yield _sse({"stage": "error", "message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate-plan", response_model=ExperimentPlan)
async def generate_plan(body: GeneratePlanRequest) -> ExperimentPlan:
    """Non-streaming fallback — single blocking call."""
    try:
        return generate_experiment_plan(
            question=body.question,
            literature_context=body.literature_context,
            references=body.references,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
