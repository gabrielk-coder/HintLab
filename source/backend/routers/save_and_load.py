import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query, UploadFile, File, HTTPException
from fastapi.responses import Response, StreamingResponse

from backend.database.connection import get_db
from backend.dependencies import get_or_create_session_id
from backend.services import save_and_load_service

router = APIRouter(prefix="/api/save_and_load", tags=["Save and Load"])
logger = logging.getLogger(__name__)

@router.get("/export")
def export_session(
    format: str = Query(..., regex="^(json|csv|full_json)$"),
    request: Request = None,
    conn=Depends(get_db)
):
    session_id = get_or_create_session_id(request)
    
    try:
        if format == "csv":
            stream = save_and_load_service.export_session_csv_stream(conn, session_id)
            return StreamingResponse(
                iter([stream.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=hinteval_session.csv"}
            )
            
        is_full = (format == "full_json")
        filename = "hinteval_backup_full.json" if is_full else "hinteval_session.json"
        
        data = save_and_load_service.export_session_json(conn, session_id, full_export=is_full)
        
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import")
async def import_session(
    file: UploadFile = File(...),
    request: Request = None,
    conn=Depends(get_db)
):
    session_id = get_or_create_session_id(request)
    
    try:
        content = await file.read()
        filename = (file.filename or "").lower()
        
        import_data = None
        format_type = "json"

        if filename.endswith(".json"):
            try:
                import_data = json.loads(content.decode('utf-8'))
                format_type = "json"
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON syntax: {str(e)}")
        
        elif filename.endswith(".csv"):
            import_data = content
            format_type = "csv"
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .json or .csv")

        logger.info(f"Attempting import for session {session_id}")
        
        result = save_and_load_service.import_session_data(
            conn=conn, 
            session_id=session_id, 
            data=import_data, 
            format_type=format_type
        )
        
        return {
            "status": "success",
            "session_id": session_id,
            "import": result
        }

    except ValueError as ve:
        logger.warning(f"Import validation failed: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
        
    except Exception as e:
        logger.error(f"Import system error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.delete("/clear")
def clear_session(
    request: Request = None,
    conn=Depends(get_db)
):
    session_id = get_or_create_session_id(request)
    try:
        result = save_and_load_service.clear_session_data(conn, session_id)
        return {"status": "success", "session_id": session_id, **result}
    except Exception as e:
        logger.error(f"Clear session failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear session: {str(e)}")