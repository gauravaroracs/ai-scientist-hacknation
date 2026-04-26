import os
import logging
from dotenv import load_dotenv

load_dotenv()  # must load before any LangChain imports

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.literature_qc import router as literature_qc_router
from routers.generate_plan import router as generate_plan_router
from routers.feedback import router as feedback_router
from routers.chat import router as chat_router

app = FastAPI(
    title="The AI Scientist",
    description="Takes a natural language scientific question and outputs a complete, runnable lab experiment plan.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(literature_qc_router)
app.include_router(generate_plan_router)
app.include_router(feedback_router)
app.include_router(chat_router)


@app.get("/", tags=["health"])
async def health():
    return {"status": "ok", "service": "The AI Scientist"}
