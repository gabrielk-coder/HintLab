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


# --- Helpers ---

def _now() -> str:
    return datetime.now().isoformat()

def _get_last_question_id(conn, session_id: str) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM questions WHERE session_id = %s ORDER BY created_at DESC LIMIT 1", 
            (session_id,)
        )
        row = cur.fetchone()
        return row[0] if row else None


# --- Session Management ---

def clear_session_data(conn, session_id: str) -> Dict[str, Any]:
    """
    Deletes all data for a session using CASCADE delete on the Question table.
    """
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM questions WHERE session_id = %s", (session_id,))
        q_count = cur.fetchone()[0]
        
        if q_count == 0:
            return {
                "cleared": False,
                "message": "No data found",
                "counts": {"questions": 0, "answers": 0, "hints": 0, "candidates": 0}
            }
        
        stats = {}
        for table in ['answers', 'hints', 'candidate_answers']:
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE question_id IN (SELECT id FROM questions WHERE session_id = %s)", (session_id,))
            stats[table] = cur.fetchone()[0]
        stats['questions'] = q_count

        logger.info(f"Clearing session {session_id}: {stats}")
        
        cur.execute("DELETE FROM questions WHERE session_id = %s", (session_id,))
        conn.commit()
        
        return {
            "cleared": True,
            "message": "Session cleared",
            "counts": stats
        }
            
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to clear session: {e}")
        raise e
    finally:
        cur.close()


# --- Export Logic ---

def export_session_json(conn, session_id: str, full_export: bool = True) -> Dict[str, Any]:
    """
    Exports session state. 
    full_export=True includes Metrics, Entities, and Candidates.
    """
    qid = _get_last_question_id(conn, session_id)
    base_response = {
        "name": f"session_{session_id}",
        "subsets": {"export": {"instances": {}}}
    }

    if not qid:
        return base_response

    with conn.cursor() as cur:
        # Fetch Core Data
        cur.execute("SELECT text FROM questions WHERE id = %s", (qid,))
        q_text = (cur.fetchone() or [""])[0]

        cur.execute("SELECT answer_text, model_name FROM answers WHERE question_id = %s LIMIT 1", (qid,))
        a_row = cur.fetchone()
        a_text = a_row[0] if a_row else ""
        model_name = a_row[1] if a_row and len(a_row) > 1 else None
        
        # Fetch Hints
        cur.execute("SELECT id, hint_text FROM hints WHERE question_id = %s ORDER BY id ASC", (qid,))
        hint_rows = cur.fetchall()

        # Build Instance Object
        instance_data = {
            "question": {"question": q_text},
            "answers": [{"answer": a_text}] if a_text else [],
            "hints": []
        }
        if full_export and model_name:
            instance_data["model_name"] = model_name

        # Hints
        for db_hint_id, hint_text in hint_rows:
            hint_obj = {"hint": hint_text, "db_id": db_hint_id}
            
            if full_export:
                # Metrics
                cur.execute("SELECT name, value, metadata_json FROM metrics WHERE hint_id = %s ORDER BY id", (db_hint_id,))
                metrics = []
                for name, val, meta in cur.fetchall():
                    m = {"name": name, "value": val}
                    if meta: m["metadata"] = json.loads(meta)
                    else: m["metadata"] = {}
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

        # Fetch Candidates
        if full_export:
            cur.execute("SELECT candidate_text, is_eliminated, created_at, updated_at, is_groundtruth FROM candidate_answers WHERE question_id = %s ORDER BY id", (qid,))
            cands = []
            for txt, elim, cr, up, is_gt in cur.fetchall():
                c = {"text": txt, "is_eliminated": bool(elim), "created_at": cr}
                if up: c["updated_at"] = up
                if is_gt is not None: c["is_groundtruth"] = bool(is_gt)
                cands.append(c)
            
            if cands:
                instance_data["candidates_full"] = cands
                instance_data["candidates"] = [c["text"] for c in cands]

        base_response["subsets"]["export"]["instances"][str(qid)] = instance_data
        return base_response


def export_session_csv_stream(conn, session_id: str):
    """Generates a simple CSV stream (type, content) for the session."""
    data = export_session_json(conn, session_id, full_export=False)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["type", "content"])

    try:
        instances = data.get("subsets", {}).get("export", {}).get("instances", {})
        if instances:
            inst = list(instances.values())[0]
            q = inst.get("question", {}).get("question", "")
            ans = inst.get("answers", [])
            a = ans[0].get("answer", "") if ans else ""
            
            if q: writer.writerow(["question", q])
            if a: writer.writerow(["answer", a])
            for h in inst.get("hints", []):
                if h.get("hint"): writer.writerow(["hint", h["hint"]])
    except Exception:
        pass

    output.seek(0)
    return output


# --- Import Logic ---

def import_session_data(conn, session_id: str, data: Any, format_type: str = "json") -> Dict[str, str]:
    """
    Routes import data to the correct handler (CSV, Simple JSON, or Full Backup).
    """
    if format_type == "csv":
        parsed = _parse_csv_to_structure(data)
        return _insert_simple_structure(conn, session_id, parsed)
    
    if _is_full_backup_format(data):
        return _insert_full_backup(conn, session_id, data)
    
    return _insert_simple_structure(conn, session_id, data)


def _is_full_backup_format(data: Dict) -> bool:
    """Checks if JSON contains full backup fields (candidates, metrics, etc)."""
    try:
        inst = data.get("subsets", {}).get("export", {}).get("instances", {})
        if not inst: return False
        
        first = next(iter(inst.values()))
        if "candidates_full" in first: return True
        
        # Check nested hints for metrics
        hints = first.get("hints", [])
        if hints and isinstance(hints[0], dict) and ("metrics" in hints[0] or "entities" in hints[0]):
            return True
            
        return False
    except:
        return False


def _parse_csv_to_structure(csv_bytes: Union[bytes, str]) -> Dict[str, Any]:
    """Parses CSV content into a dictionary for simple import."""
    content = csv_bytes.decode('utf-8') if isinstance(csv_bytes, bytes) else csv_bytes
    reader = csv.DictReader(io.StringIO(content))
    
    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    struct = {"question": "", "answer": "", "hints": []}
    
    for row in reader:
        rtype = row.get("type", "").strip().lower()
        content = row.get("content", "").strip()
        if not content: continue

        if rtype == "question": struct["question"] = content
        elif rtype == "answer": struct["answer"] = content
        elif rtype == "hint": struct["hints"].append({"hint": content})
            
    return struct


def _insert_simple_structure(conn, session_id: str, data: Dict[str, Any]) -> Dict[str, str]:
    """Inserts flat JSON/CSV data (Question, Answer, Hints only)."""
    q_data = data.get("question", "")
    q_text = q_data.get("question", "") if isinstance(q_data, dict) else q_data
    
    a_data = data.get("answer", "")
    a_text = ""
    if isinstance(a_data, list) and a_data:
        a_text = a_data[0].get("answer", "") if isinstance(a_data[0], dict) else str(a_data[0])
    elif isinstance(a_data, dict):
        a_text = a_data.get("answer", "")
    else:
        a_text = str(a_data)

    if not q_text:
        raise ValueError("Import failed: Missing question text.")

    cur = conn.cursor()
    try:
        qid, aid = _insert_qa_core(cur, conn, session_id, q_text, a_text)
        
        count = 0
        for h in data.get("hints", []):
            h_text = h.get("hint", h.get("text", "")) if isinstance(h, dict) else str(h)
            if h_text:
                cur.execute(
                    "INSERT INTO hints (question_id, answer_id, hint_text, created_at) VALUES (%s, %s, %s, %s)",
                    (qid, aid, h_text, _now())
                )
                count += 1
        
        conn.commit()
        return {"info": f"Imported: 1 Question, {count} Hints", "question_id": qid}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()


def _insert_full_backup(conn, session_id: str, data: Dict[str, Any]) -> Dict[str, str]:
    """Restores full system state (Metrics, Entities, Candidates)."""
    cur = conn.cursor()
    try:
        instances = {}
        for subset in data.get("subsets", {}).values():
            instances.update(subset.get("instances", {}))

        if not instances: raise ValueError("No instances found in backup")

        counts = {"q": 0, "h": 0, "m": 0, "e": 0, "c": 0}
        q_ids = []

        for inst_id, content in instances.items():
            # QA
            q_raw = content.get("question", {})
            q_text = q_raw.get("question", "") if isinstance(q_raw, dict) else str(q_raw)
            
            ans_list = content.get("answers", [])
            a_text = ans_list[0].get("answer", "") if ans_list else ""
            
            if not q_text: continue
            
            qid, aid = _insert_qa_core(cur, conn, session_id, q_text, a_text)
            q_ids.append(qid)
            counts["q"] += 1

            # Hints
            for h in content.get("hints", []):
                h_text = h.get("hint", "")
                if not h_text: continue

                cur.execute(
                    "INSERT INTO hints (question_id, answer_id, hint_text, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
                    (qid, aid, h_text, _now())
                )
                hid = cur.fetchone()[0]
                counts["h"] += 1

                # Metrics
                for m in h.get("metrics", []):
                    meta = json.dumps(m.get("metadata")) if m.get("metadata") else None
                    cur.execute(
                        "INSERT INTO metrics (hint_id, name, value, metadata_json) VALUES (%s, %s, %s, %s)",
                        (hid, m["name"], m.get("value"), meta)
                    )
                    counts["m"] += 1
                
                # Entities
                for e in h.get("entities", []):
                    meta = json.dumps(e.get("metadata")) if e.get("metadata") else None
                    cur.execute(
                        "INSERT INTO entities (hint_id, entity, ent_type, start_index, end_index, metadata_json) VALUES (%s, %s, %s, %s, %s, %s)",
                        (hid, e["text"], e["type"], e["start"], e["end"], meta)
                    )
                    counts["e"] += 1

            # Candidates
            for c in content.get("candidates_full", []):
                cur.execute(
                    "INSERT INTO candidate_answers (question_id, candidate_text, is_eliminated, created_at, updated_at, is_groundtruth) VALUES (%s, %s, %s, %s, %s, %s)",
                    (qid, c["text"], True if bool(c["is_eliminated"]) else False, c.get("created_at", _now()), c.get("updated_at"), bool(c.get("is_groundtruth", False)))
                )
                counts["c"] += 1

        conn.commit()
        return {
            "info": f"Restored {counts['q']} Questions, {counts['h']} Hints, {counts['c']} Candidates",
            "question_ids": q_ids,
            "counts": counts
        }
    except Exception as e:
        conn.rollback()
        logger.error(f"Restore failed: {e}")
        raise e
    finally:
        cur.close()


def _insert_hinteval_structure(conn, session_id: str, data: Dict[str, Any]) -> Dict[str, str]:
    """Alias for full backup insertion if format allows."""
    return _insert_full_backup(conn, session_id, data)


def _insert_qa_core(cur, conn, session_id: str, q_text: str, a_text: str) -> Tuple[int, int]:
    """Helper: Inserts Question. If answer exists, inserts it; otherwise generates it."""
    # Insert Question
    cur.execute(
        "INSERT INTO questions (text, session_id, created_at) VALUES (%s, %s, %s) RETURNING id",
        (q_text, session_id, _now())
    )
    qid = cur.fetchone()[0]

    if a_text:
        cur.execute(
            "INSERT INTO answers (question_id, answer_text, created_at) VALUES (%s, %s, %s) RETURNING id",
            (qid, a_text, _now())
        )
        aid = cur.fetchone()[0]
    else:
        logger.info(f"Answer missing for QID {qid}, generating...")
        conn.commit()
        
        gen_ans = generate_only_answer(conn, q_text, "meta-llama/Llama-3.3-70B-Instruct-Turbo", question_id=qid)
        
        cur.execute(
            "INSERT INTO answers (question_id, answer_text, model_name, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (qid, gen_ans, "meta-llama/Llama-3.3-70B-Instruct-Turbo", _now())
        )
        aid = cur.fetchone()[0]
    
    return qid, aid

def load_full_preset_state(conn, session_id: str, data: Dict[str, Any]):
    """
    Inserts a full pre-computed state (Q, A, Hints, Candidates, Metrics) 
    into the database. It relies on DB to generate IDs and maintains relationships.
    """
    cur = conn.cursor()
    
    try:
        cur.execute(
            """
            INSERT INTO questions (text, session_id, created_at) 
            VALUES (%s, %s, %s) 
            RETURNING id
            """, 
            (data['question'], session_id, _now())
        )
        qid = cur.fetchone()[0]
        
        cur.execute(
            """
            INSERT INTO answers (question_id, answer_text, created_at) 
            VALUES (%s, %s, %s) 
            RETURNING id
            """, 
            (qid, data['groundTruth'], _now())
        )
        aid = cur.fetchone()[0]

        for h in data.get('hints', []):
            cur.execute(
                """
                INSERT INTO hints (question_id, answer_id, hint_text, created_at) 
                VALUES (%s, %s, %s, %s) 
                RETURNING id
                """,
                (qid, aid, h['hint_text'], _now())
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
                    (qid, c_text, False, _now(), True) 
                )
            else:
                cur.execute(
                    """
                    INSERT INTO candidate_answers (question_id, candidate_text, is_eliminated, created_at, is_groundtruth) 
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (qid, c_text, False, _now(), False) 
                )

        conn.commit()
        return {"status": "success", "question_id": qid}

    except Exception as e:
        conn.rollback()
        print(f"Error loading preset: {e}")
        raise e
    finally:
        cur.close()