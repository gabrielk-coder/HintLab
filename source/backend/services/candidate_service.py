import psycopg2
from datetime import datetime
from typing import List, Optional, Dict, Any
from .question_service import get_latest_question_id, clear_metrics_for_question
from .generation_service import generate_only_candidates

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_candidates(conn, session_id: str) -> List[Dict[str, Any]]:
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        return []
    
    cur = conn.cursor()
    cur.execute("""
        SELECT id, candidate_text, is_groundtruth 
        FROM candidate_answers 
        WHERE question_id = %s 
        ORDER BY id ASC
    """, (qid,))
    
    return [
        {"id": r[0], "text": r[1], "is_groundtruth": bool(r[2])} 
        for r in cur.fetchall()
    ]

def save_candidate(conn, session_id: str, text: str, index: Optional[int] = None) -> None:
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        raise ValueError("No active question found.")
    
    cur = conn.cursor()
    
    if index is None:
        cur.execute("SELECT 1 FROM candidate_answers WHERE question_id = %s AND is_groundtruth = TRUE", (qid,))
        has_gt = cur.fetchone() is not None
        
        is_gt = not has_gt

        cur.execute(
            "INSERT INTO candidate_answers (question_id, candidate_text, created_at, is_groundtruth) VALUES (%s, %s, %s, %s)",
            (qid, text, _now(), is_gt)
        )
    else:
        cur.execute("SELECT id FROM candidate_answers WHERE question_id = %s ORDER BY id ASC", (qid,))
        rows = cur.fetchall()
        
        if not (0 <= index < len(rows)):
            raise IndexError("Candidate index out of range")
        
        cand_id = rows[index][0]
        cur.execute("UPDATE candidate_answers SET candidate_text = %s, updated_at = %s WHERE id = %s", (text, _now(), cand_id))
    
    conn.commit()
    clear_metrics_for_question(conn, qid)

def set_ground_truth_candidate(conn, session_id: str, index: int) -> None:
    """Sets a specific candidate as Ground Truth and unsets others."""
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        raise ValueError("No active question found.")

    cur = conn.cursor()
    cur.execute("SELECT id FROM candidate_answers WHERE question_id = %s ORDER BY id ASC", (qid,))
    rows = cur.fetchall()

    if not (0 <= index < len(rows)):
        raise IndexError("Candidate index out of range")

    target_id = rows[index][0]

    cur.execute("UPDATE candidate_answers SET is_groundtruth = FALSE WHERE question_id = %s", (qid,))
    cur.execute("UPDATE candidate_answers SET is_groundtruth = TRUE WHERE id = %s", (target_id,))
    
    conn.commit()
    clear_metrics_for_question(conn, qid)

def delete_candidate(conn, session_id: str, index: int) -> None:
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        return
        
    cur = conn.cursor()
    cur.execute("SELECT id, is_groundtruth FROM candidate_answers WHERE question_id = %s ORDER BY id ASC", (qid,))
    rows = cur.fetchall()
    
    if not (0 <= index < len(rows)):
        raise IndexError("Candidate index out of range")
        
    cand_id_to_delete, is_gt_deleted = rows[index]
    
    cur.execute("DELETE FROM candidate_answers WHERE id = %s", (cand_id_to_delete,))
    
    if is_gt_deleted:
        cur.execute("SELECT id FROM candidate_answers WHERE question_id = %s ORDER BY id ASC", (qid,))
        remaining = cur.fetchall()
        
        if remaining:
            new_gt_index = index - 1 if index - 1 >= 0 else 0
            if new_gt_index >= len(remaining):
                new_gt_index = len(remaining) - 1
            
            new_gt_id = remaining[new_gt_index][0]
            cur.execute("UPDATE candidate_answers SET is_groundtruth = TRUE WHERE id = %s", (new_gt_id,))

    conn.commit()
    clear_metrics_for_question(conn, qid)

def delete_all_candidates(conn, session_id: str) -> None:
    qid = get_latest_question_id(conn, session_id)
    if qid:
        cur = conn.cursor()
        cur.execute("DELETE FROM candidate_answers WHERE question_id = %s", (qid,))
        conn.commit()
        clear_metrics_for_question(conn, qid)

def generate_candidates_for_session(
    conn, 
    session_id: str, 
    num_candidates: int,
    model_name: str,
    temperature: float,
    max_tokens: int,
    hints: Optional[List[str]] = None,
    top_p: float = 0.9
) -> List[str]:
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        raise ValueError("No active question to generate candidates for.")
        
    cur = conn.cursor()
    cur.execute("SELECT text FROM questions WHERE id = %s", (qid,))
    question = cur.fetchone()[0]
    
    candidates = generate_only_candidates(question, num_candidates, temperature, model_name, max_tokens, hints=hints)
    
    cur.execute("DELETE FROM candidate_answers WHERE question_id = %s", (qid,))
    
    last_candidate = candidates[-1] if candidates else "N/A"

    for c in candidates:
        is_gt = (c == last_candidate)
        cur.execute(
            "INSERT INTO candidate_answers (question_id, candidate_text, created_at, is_groundtruth) VALUES (%s, %s, %s, %s)",
            (qid, c, _now(), is_gt)
        )

    conn.commit()
    clear_metrics_for_question(conn, qid)
    
    return candidates