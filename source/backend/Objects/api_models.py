# backend/models/api.py
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class HintevalBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())



class GenerateReq(HintevalBase):
    """Request body for /hinteval/generate."""
    question: str
    num_hints: Optional[int] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    model_name: Optional[str] = None
    answer: bool = False

class UpdateAnswerReq(BaseModel):
    answer: str

class PresetBody(BaseModel):
    data: dict


class RegenerateAnswerReq(BaseModel):
    model_name: str
    temperature: float = 0.3
    max_tokens: int = 512
    top_p: float = 0.9
    hints: List[str] = []
    question: str

class RegenerateCandidatesReq(BaseModel):
    num_candidates: int
    model_name: str
    temperature: float = 0.3
    max_tokens: int = 256
    hints: List[str] = []
    top_p: float = 0.9

class HintReq(HintevalBase):
    """Request body for /hinteval/generate."""
    hint_id: int
    hint_text: Optional[str] = None



class EvaluateReq(HintevalBase):
    """Request body for /hinteval/evaluate."""
    question: str
    hints: List[str]
    answer: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    model_name: Optional[str] = None
    num_candidates: Optional[int] = None


class CandidateReq(HintevalBase):
    """Request body for /hinteval/candidates."""
    question: str
    num_candidates: int = 5
    max_tokens: int = 128
    temperature: float = 0.3
    model_name: Optional[str] = None


class EliminateReq(HintevalBase):
    """Request body for /hinteval/eliminate."""
    question: str
    hint: str
    candidates: List[str]
    metric: str = "llm"
    model_name: Optional[str] = None


class EliminateSeqReq(HintevalBase):
    """Request body for /hinteval/eliminate_sequence."""
    question: str
    hints: List[str]
    candidates: List[str]
    metric: str = "llm"
    model_name: Optional[str] = None


class GenerateResp(HintevalBase):
    question: str
    hints: List[dict] 
    answer: Optional[str] = None
    ground_truth: Optional[str] = None


class EvaluateResp(HintevalBase):
    question: str
    num_hints: int
    metrics: List[List[dict]]
    scores_convergence: List[dict]
    candidate_answers: List[str] 


class SmallLLMRequest(HintevalBase):
    question: str
    hints: List[str] = []
    model_name: Optional[str] = None

class SaveCandidateBody(HintevalBase):
    candidate_text: str
    candidate_index: Optional[int] = None  


class DeleteCandidateBody(HintevalBase):
    candidate_index: int



class SaveHintBody(HintevalBase):
    hint_text: str


class HintMetricResponse(HintevalBase):
    id: int
    text: str
    convergence: Optional[float] = None
    relevance: Optional[float] = None
    answer_leakage: Optional[float] = None
    readability: Optional[float] = None
    familiarity: Optional[float] = None
  