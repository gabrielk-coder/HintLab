import os
import requests
from typing import List, Optional, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .hinteval_core import generate_hints, evaluate_hints

load_dotenv()

TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_BASE_URL = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")
HINTEVAL_MODEL = os.getenv("HINTEVAL_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo")

app = FastAPI(title="HintEval Backend", version="0.1.0")

# CORS (erlaube lokal Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # schränke in Prod ein
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    question: str = Field(..., min_length=3)
    gt_answers: List[str] = Field(default_factory=list)
    num_hints: int = 5
    model_name: Optional[str] = None
    max_tokens: int = 256
    temperature: float = 0.2
    together_api_key: Optional[str] = None
    together_base_url: Optional[str] = None

class ProcessResponse(BaseModel):
    answer: str
    hints: List[str]
    scores: Dict[str, float]

@app.get("/health")
def health():
    return {"status": "ok"}

def generate_direct_answer(q: str, api_key: str, model: str, base_url: str, max_tokens: int, temperature: float) -> str:
    if not api_key:
        return "⚠️ Kein Together-API-Key gesetzt (Antwort-Fallback)."
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": q}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip() or "(leer)"
    except Exception as e:
        return f"⚠️ Antwort fehlgeschlagen: {e}"

@app.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest):
    model_name = req.model_name or HINTEVAL_MODEL
    api_key = req.together_api_key or TOGETHER_API_KEY
    base_url = req.together_base_url or TOGETHER_BASE_URL

    # 1) Hints
    hints = generate_hints(
        question=req.question,
        gt_answers=req.gt_answers,
        num_hints=max(1, min(10, req.num_hints)),
        model_name=model_name,
        api_key=api_key if api_key else None,
        base_url=base_url
    )

    # 2) Antwort
    answer = generate_direct_answer(
        q=req.question,
        api_key=api_key,
        model=model_name,
        base_url=base_url,
        max_tokens=req.max_tokens,
        temperature=req.temperature
    )

    # 3) Scores
    scores = evaluate_hints(
        question=req.question,
        gt_answers=req.gt_answers,
        hints=hints,
        model_name=model_name,
        api_key=api_key if api_key else None,
        base_url=base_url
    )

    return ProcessResponse(answer=answer, hints=hints, scores=scores)
