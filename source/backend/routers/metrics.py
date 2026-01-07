from fastapi import APIRouter, Depends, Request
from typing import List

from backend.database.connection import get_db
from backend.dependencies import get_or_create_session_id

from backend.Objects.api_models import HintMetricResponse
from backend.services import hint_service, entities_service

router = APIRouter(prefix="/metrics", tags=["Metrics"])

@router.get("/get_metrics", response_model=List[HintMetricResponse])
def get_metrics(request: Request, conn=Depends(get_db)):
    session_id = get_or_create_session_id(request)
    return hint_service.get_detailed_metrics(conn, session_id)

@router.get("/get_convergence_scores")
def get_convergence_scores(request: Request, conn=Depends(get_db)):
    session_id = get_or_create_session_id(request=request)
    return hint_service.get_convergence_scores(conn, session_id)

@router.get("/get_embedding_similarities")
def get_embedding_similarities(request: Request, conn=Depends(get_db)):
    session_id = get_or_create_session_id(request)
    return hint_service.get_embedding_similarities(conn, session_id)

@router.get("/get_entities")
def get_entities(request: Request, conn=Depends(get_db)):
    session_id = get_or_create_session_id(request)
    return entities_service.get_entities_for_session(conn, session_id)