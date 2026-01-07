import json
from datetime import datetime
from typing import Dict, Any, Optional

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_latest_question_id(conn, session_id: str) -> Optional[int]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM questions WHERE session_id = %s ORDER BY created_at DESC, id DESC LIMIT 1;",
        (session_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None

def get_question_and_answer(conn, session_id: str) -> Dict[str, Any]:
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        return {"question": None, "answer": None}
    
    cur = conn.cursor()
    cur.execute("SELECT text FROM questions WHERE id = %s", (qid,))
    q_text = cur.fetchone()[0]

    cur.execute("SELECT answer_text FROM answers WHERE question_id = %s ORDER BY created_at DESC LIMIT 1", (qid,))
    ans_row = cur.fetchone()
    
    return {"question": q_text, "answer": ans_row[0] if ans_row else None}

def reset_session(conn, session_id: str) -> None:
    cur = conn.cursor()
    cur.execute("DELETE FROM questions WHERE session_id = %s", (session_id,))
    conn.commit()

def update_existing_answer(conn, question_id: int, new_text: str):
    cursor = conn.cursor()
    query = """
        UPDATE answers 
        SET answer_text = %s, updated_at = %s 
        WHERE question_id = %s
    """
    cursor.execute(query, (new_text, _now(), question_id))
    conn.commit()


def clear_metrics_for_question(conn, question_id: int) -> None:
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM hints WHERE question_id = %s", (question_id,))
    hint_ids = [row[0] for row in cur.fetchall()]
    
    if not hint_ids:
        return

    placeholders = ",".join("%s" for _ in hint_ids)
    
    cur.execute(f"DELETE FROM metrics WHERE hint_id IN ({placeholders})", tuple(hint_ids))
    cur.execute(f"DELETE FROM entities WHERE hint_id IN ({placeholders})", tuple(hint_ids))
    cur.execute("UPDATE candidate_answers SET is_eliminated = 0 WHERE question_id = %s", (question_id,))    
    conn.commit()

def get_full_session_state(conn, session_id: str) -> Dict[str, Any]:
    qid = get_latest_question_id(conn, session_id)
    
    empty_state = {
        "question": None, "answer": None, "hints": [], "metrics": [],
        "scores_convergence": [], "entities_per_hint": [],
        "candidate_answers": [], "candidate_convergence": [],
        "hint2hint_similarity": [],
    }

    if not qid:
        return empty_state

    cur = conn.cursor()
    
    cur.execute("SELECT text FROM questions WHERE id = %s", (qid,))
    q_text = cur.fetchone()[0]
    
    cur.execute("SELECT answer_text FROM answers WHERE question_id = %s ORDER BY created_at DESC LIMIT 1", (qid,))
    ans_row = cur.fetchone()
    a_text = ans_row[0] if ans_row else None

    cur.execute("SELECT id, hint_text FROM hints WHERE question_id = %s ORDER BY id ASC", (qid,))
    hint_rows = cur.fetchall()
    hints_payload = [{"id": h[0], "text": h[1]} for h in hint_rows]

    metrics_per_hint = []
    entities_per_hint = []
    scores_convergence = []

    # Fetch Metrics & Entities
    for (hid, _) in hint_rows:
        cur.execute("SELECT name, value, metadata_json FROM metrics WHERE hint_id = %s", (hid,))
        m_rows = cur.fetchall()
        m_list = []
        conv_scores = {}
        for name, val, meta_json in m_rows:
            meta = json.loads(meta_json) if meta_json else {}
            m_list.append({"name": name, "value": val, "metadata": meta})
            if name == "convergence":
                conv_scores = meta.get("scores", {})
        
        metrics_per_hint.append(m_list)
        scores_convergence.append(conv_scores)

        cur.execute("SELECT entity, ent_type, start_index, end_index, metadata_json FROM entities WHERE hint_id = %s", (hid,))
        e_rows = cur.fetchall()
        e_list = []
        for ent, etype, s, e, meta_json in e_rows:
            meta = json.loads(meta_json) if meta_json else {}
            e_list.append({"entity": ent, "ent_type": etype, "start_index": s, "end_index": e, "metadata": meta})
        entities_per_hint.append(e_list)

    # Fetch Candidates with Ground Truth status
    cur.execute("SELECT id, candidate_text, is_groundtruth FROM candidate_answers WHERE question_id = %s ORDER BY id ASC", (qid,))
    cand_rows = cur.fetchall()
    
    candidate_objects = []
    for r in cand_rows:
        candidate_objects.append({
            "id": r[0],
            "text": r[1],
            "is_groundtruth": bool(r[2])
        })
    
    # Prepare data for Candidate Convergence view
    # Note: frontend logic for convergence usually relies on text matching, 
    # but the payload now carries full objects.
    candidate_texts = [c["text"] for c in candidate_objects]
    
    candidate_convergence = [
        {
            "candidate": cand_text,
            "scores": [s.get(cand_text, None) for s in scores_convergence],
        }
        for cand_text in candidate_texts
    ]

    hint2hint_similarity = [] 

    return {
        "question": q_text,
        "answer": a_text,
        "hints": hints_payload,
        "metrics": metrics_per_hint,
        "scores_convergence": scores_convergence,
        "entities_per_hint": entities_per_hint,
        "candidate_answers": candidate_objects, # Now returns list of dicts
        "candidate_convergence": candidate_convergence,
        "hint2hint_similarity": hint2hint_similarity,
    }