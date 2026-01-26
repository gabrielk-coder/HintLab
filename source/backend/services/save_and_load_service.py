import os
import io
import csv
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import psycopg2
from psycopg2.extras import Json

logger = logging.getLogger(__name__)

try:
    from .generation_service import generate_only_answer
except ImportError:
    def generate_only_answer(conn, q, m, question_id): 
        return "Generated Answer Placeholder"


def get_current_timestamp() -> str:
    return datetime.now().isoformat()

def get_last_question_id(conn, session_id: str) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM questions WHERE session_id = %s ORDER BY created_at DESC LIMIT 1", 
            (session_id,)
        )
        row = cur.fetchone()
        return row[0] if row else None


def clear_session_data(conn, session_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM questions WHERE session_id = %s", (session_id,))
    return {"cleared": True, "message": "Session wiped."}


def export_session_json(conn, session_id: str, full_export: bool = True) -> Dict[str, Any]:
    qid = get_last_question_id(conn, session_id)
    
    # Return empty instances structure if no data
    if not qid:
        return {"instances": {}}

    with conn.cursor() as cur:
        # 1. Fetch Question
        cur.execute("SELECT text FROM questions WHERE id = %s", (qid,))
        q_text = (cur.fetchone() or [""])[0]

        # 2. Fetch Answer
        cur.execute("SELECT answer_text, model_name FROM answers WHERE question_id = %s LIMIT 1", (qid,))
        a_row = cur.fetchone()
        a_text = a_row[0] if a_row else ""
        model_name = a_row[1] if a_row and len(a_row) > 1 else None
        
        # 3. Build Base Structure (Used for BOTH Simple and Full)
        instance_data = {
            "question": {"question": q_text},
            "answers": [{"answer": a_text}] if a_text else [],
            "hints": []
        }

        # 4. Fetch Hints
        cur.execute("SELECT id, hint_text FROM hints WHERE question_id = %s ORDER BY id ASC", (qid,))
        hint_rows = cur.fetchall()

        for db_hint_id, hint_text in hint_rows:
            hint_obj = {"hint": hint_text}
            
            # ONLY add Metrics/Entities if Full Export is requested
            if full_export:
                # Metrics
                cur.execute("SELECT name, value, metadata_json FROM metrics WHERE hint_id = %s ORDER BY id", (db_hint_id,))
                metrics = []
                for name, val, meta in cur.fetchall():
                    m = {"name": name, "value": val}
                    if meta: m["metadata"] = json.loads(meta)
                    metrics.append(m)
                if metrics: hint_obj["metrics"] = metrics

                # Entities
                cur.execute("SELECT entity, ent_type, start_index, end_index, metadata_json FROM entities WHERE hint_id = %s ORDER BY id", (db_hint_id,))
                entities = []
                for txt, typ, start, end, meta in cur.fetchall():
                    e = {"text": txt, "type": typ, "start": start, "end": end}
                    if meta: e["metadata"] = json.loads(meta)
                    entities.append(e)
                if entities: hint_obj["entities"] = entities
            
            instance_data["hints"].append(hint_obj)

        # 5. Add Candidates (ONLY if Full Export)
        if full_export:
            if model_name:
                instance_data["model_name"] = model_name
                
            cur.execute("SELECT candidate_text, is_eliminated, created_at, updated_at, is_groundtruth FROM candidate_answers WHERE question_id = %s ORDER BY id", (qid,))
            cands = []
            for txt, elim, cr, up, is_gt in cur.fetchall():
                c = {
                    "text": txt, 
                    "is_eliminated": bool(elim), 
                    "created_at": cr,
                    "is_groundtruth": bool(is_gt)
                }
                if up: c["updated_at"] = up
                cands.append(c)
            
            if cands:
                instance_data["candidates_full"] = cands

        return {"instances": instance_data}


def export_session_csv_stream(conn, session_id: str):
    data = export_session_json(conn, session_id, full_export=False)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["type", "content"])

    try:
        inst = data.get("instances", {})
        if inst:
            q = inst.get("question", {}).get("question", "")
            ans = inst.get("answers", [])
            a = ans[0].get("answer", "") if ans else ""
            
            if q: writer.writerow(["question", q])
            if a: writer.writerow(["answer", a])
            for h in inst.get("hints", []):
                h_text = h.get("hint") if isinstance(h, dict) else str(h)
                if h_text: writer.writerow(["hint", h_text])
    except Exception:
        pass

    output.seek(0)
    return output


def import_session_data(conn, session_id: str, data: Any, format_type: str = "json") -> Dict[str, Any]:
    is_full_backup = False
    
    if format_type == "json":
        if is_full_backup_format(data):
            is_full_backup = True
            validate_full_import_structure(data)
        elif not is_simple_json_format(data):
             # Only throw if it matches NEITHER format
             pass 
    
    logger.info(f"Validation passed. Clearing session {session_id} for import.")
    
    try:
        clear_stats = clear_session_data(conn, session_id)
        
        if format_type == "csv":
            parsed = parse_csv_to_structure(data)
            result = insert_simple_structure(conn, session_id, parsed, from_csv=True)
        elif is_full_backup:
            result = insert_full_backup(conn, session_id, data)
        else:
            # Simple JSON Import
            result = insert_simple_structure(conn, session_id, data, from_csv=False)
            
        conn.commit()
        result["cleared"] = clear_stats
        return result
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Import transaction failed: {e}")
        raise e


def is_full_backup_format(data: Dict) -> bool:
    """Returns True if data has candidates or metrics inside instances."""
    try:
        if "instances" in data:
            inst = data["instances"]
            if "candidates_full" in inst:
                return True
            # Check for metrics in hints
            if "hints" in inst and inst["hints"] and "metrics" in inst["hints"][0]:
                return True
        return False
    except:
        return False

def is_simple_json_format(data: Dict) -> bool:
    """Returns True if data has the instances wrapper but NO complex data."""
    try:
        if "instances" in data:
            return True
        return False
    except:
        return False


def validate_full_import_structure(data: Dict) -> None:
    inst = data.get("instances", {})
    if not inst:
        raise ValueError("Structure Error: 'instances' object is missing.")

    cands = inst.get("candidates_full", [])
    if not cands or len(cands) < 2:
        raise ValueError("Full Backup Error: Must have at least 2 candidates in 'candidates_full'.")
    
    gt_count = sum(1 for c in cands if c.get("is_groundtruth") is True)
    if gt_count != 1:
        raise ValueError(f"Full Backup Error: Candidates must have exactly one item with 'is_groundtruth': true. Found {gt_count}.")


def parse_csv_to_structure(csv_bytes: Union[bytes, str]) -> Dict[str, Any]:
    content = csv_bytes.decode('utf-8') if isinstance(csv_bytes, bytes) else csv_bytes
    reader = csv.DictReader(io.StringIO(content))
    
    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    # CSV returns a flat structure, not the 'instances' wrapper
    struct = {"question": "", "answer": "", "hints": []}
    
    for row in reader:
        rtype = row.get("type", "").strip().lower()
        content = row.get("content", "").strip()
        if not content: continue

        if rtype == "question": struct["question"] = content
        elif rtype == "answer": struct["answer"] = content
        elif rtype == "hint": struct["hints"].append({"hint": content})
            
    return struct


def insert_simple_structure(conn, session_id: str, data: Dict[str, Any], from_csv: bool = False) -> Dict[str, Any]:
    """
    Inserts data. 
    If from_csv=True, expects flat dict: {question: "...", hints: []}
    If from_csv=False, expects wrapper: {instances: {question: {...}, hints: [...]}}
    """
    
    if from_csv:
        content = data
        q_text = content.get("question", "")
        a_text = content.get("answer", "")
        hints_list = content.get("hints", [])
    else:
        content = data.get("instances", {})
        if not content:
             raise ValueError("Invalid Simple JSON: Missing 'instances' key.")
             
        q_raw = content.get("question", {})
        q_text = q_raw.get("question", "") if isinstance(q_raw, dict) else str(q_raw)
        
        ans_list = content.get("answers", [])
        a_text = ""
        if ans_list:
            a_text = ans_list[0].get("answer", "") if isinstance(ans_list[0], dict) else str(ans_list[0])
            
        hints_list = content.get("hints", [])

    if not q_text:
        raise ValueError("Import failed: Missing question text.")

    cur = conn.cursor()
    qid, aid = insert_qa_core(cur, conn, session_id, q_text, a_text)
    
    count = 0
    for h in hints_list:
        h_text = h.get("hint", "") if isinstance(h, dict) else str(h)
        
        if h_text:
            cur.execute(
                "INSERT INTO hints (question_id, answer_id, hint_text, created_at) VALUES (%s, %s, %s, %s)",
                (qid, aid, h_text, get_current_timestamp())
            )
            count += 1
    
    return {"info": f"Imported: 1 Question, {count} Hints", "question_id": qid, "counts": {"q": 1, "h": count}}


def insert_full_backup(conn, session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    cur = conn.cursor()
    content = data.get("instances", {})

    counts = {"q": 0, "h": 0, "m": 0, "e": 0, "c": 0}
    q_ids = []

    q_raw = content.get("question", {})
    q_text = q_raw.get("question", "") if isinstance(q_raw, dict) else str(q_raw)
    
    ans_list = content.get("answers", [])
    a_text = ans_list[0].get("answer", "") if ans_list else ""
    
    if not q_text:
        raise ValueError("Missing question text in backup.")
    
    qid, aid = insert_qa_core(cur, conn, session_id, q_text, a_text)
    q_ids.append(qid)
    counts["q"] += 1

    for c in content.get("candidates_full", []):
        cur.execute(
            """INSERT INTO candidate_answers 
                (question_id, candidate_text, is_eliminated, created_at, updated_at, is_groundtruth) 
                VALUES (%s, %s, %s, %s, %s, %s)""",
            (qid, c["text"], bool(c.get("is_eliminated", False)), c.get("created_at", get_current_timestamp()), c.get("updated_at"), bool(c.get("is_groundtruth", False)))
        )
        counts["c"] += 1

    for h in content.get("hints", []):
        h_text = h.get("hint", "")
        if not h_text: continue

        cur.execute(
            "INSERT INTO hints (question_id, answer_id, hint_text, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (qid, aid, h_text, get_current_timestamp())
        )
        hid = cur.fetchone()[0]
        counts["h"] += 1

        for m in h.get("metrics", []):
            meta = json.dumps(m.get("metadata")) if m.get("metadata") else None
            cur.execute(
                "INSERT INTO metrics (hint_id, name, value, metadata_json) VALUES (%s, %s, %s, %s)",
                (hid, m["name"], m.get("value"), meta)
            )
            counts["m"] += 1
        
        for e in h.get("entities", []):
            meta = json.dumps(e.get("metadata")) if e.get("metadata") else None
            cur.execute(
                "INSERT INTO entities (hint_id, entity, ent_type, start_index, end_index, metadata_json) VALUES (%s, %s, %s, %s, %s, %s)",
                (hid, e["text"], e["type"], e["start"], e["end"], meta)
            )
            counts["e"] += 1

    return {
        "info": f"Restored {counts['q']} Questions, {counts['h']} Hints, {counts['c']} Candidates",
        "question_ids": q_ids,
        "counts": counts
    }


def insert_qa_core(cur, conn, session_id: str, q_text: str, a_text: str) -> Tuple[int, int]:
    cur.execute(
        "INSERT INTO questions (text, session_id, created_at) VALUES (%s, %s, %s) RETURNING id",
        (q_text, session_id, get_current_timestamp())
    )
    qid = cur.fetchone()[0]

    if a_text:
        cur.execute(
            "INSERT INTO answers (question_id, answer_text, created_at) VALUES (%s, %s, %s) RETURNING id",
            (qid, a_text, get_current_timestamp())
        )
        aid = cur.fetchone()[0]
    else:
        logger.info(f"Answer missing for QID {qid}, generating...")
        
        try:
            gen_ans = generate_only_answer(conn, q_text, "meta-llama/Llama-3.3-70B-Instruct-Turbo", question_id=qid)
        except Exception as e:
            logger.error(f"LLM Generation failed for QID {qid}: {e}")
            gen_ans = "[Error: Generation Failed]"
        
        cur.execute(
            "INSERT INTO answers (question_id, answer_text, model_name, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (qid, gen_ans, "meta-llama/Llama-3.3-70B-Instruct-Turbo", get_current_timestamp())
        )
        aid = cur.fetchone()[0]
    
    return qid, aid


def load_full_preset_state(conn, session_id: str, data: Dict[str, Any]):
    cur = conn.cursor()
    
    try:
        cur.execute(
            """
            INSERT INTO questions (text, session_id, created_at) 
            VALUES (%s, %s, %s) 
            RETURNING id
            """, 
            (data['question'], session_id, get_current_timestamp())
        )
        qid = cur.fetchone()[0]
        
        cur.execute(
            """
            INSERT INTO answers (question_id, answer_text, created_at) 
            VALUES (%s, %s, %s) 
            RETURNING id
            """, 
            (qid, data['groundTruth'], get_current_timestamp())
        )
        aid = cur.fetchone()[0]

        for h in data.get('hints', []):
            cur.execute(
                """
                INSERT INTO hints (question_id, answer_id, hint_text, created_at) 
                VALUES (%s, %s, %s, %s) 
                RETURNING id
                """,
                (qid, aid, h['hint_text'], get_current_timestamp())
            )
            real_hint_id = cur.fetchone()[0]
            
            preset_local_id = str(h.get('hint_id')) 
            metrics_dict = data.get('metricsById', {}).get(preset_local_id, {})
            
            for metric_name, metric_value in metrics_dict.items():
                if metric_value is not None:
                    cur.execute(
                        """
                        INSERT INTO metrics (hint_id, name, value) 
                        VALUES (%s, %s, %s)
                        """, 
                        (real_hint_id, metric_name, float(metric_value))
                    )

        candidates = data.get('candidates', [])
        isgroundtruth_candidate = candidates.get('is_groundtruth_candidate', None)
        for c_text in candidates.get('candidate_texts', []):
            if c_text == isgroundtruth_candidate:
                cur.execute(
                    """
                    INSERT INTO candidate_answers (question_id, candidate_text, is_eliminated, created_at, is_groundtruth) 
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (qid, c_text, False, get_current_timestamp(), True) 
                )
            else:
                cur.execute(
                    """
                    INSERT INTO candidate_answers (question_id, candidate_text, is_eliminated, created_at, is_groundtruth) 
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (qid, c_text, False, get_current_timestamp(), False) 
                )

        conn.commit()
        return {"status": "success", "question_id": qid}

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading preset: {e}")
        raise e
    finally:
        cur.close()