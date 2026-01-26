from __future__ import annotations
import os
import json
import traceback
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime

from dotenv import load_dotenv

# --- HintEval Imports ---
from hinteval.cores import Instance
from hinteval.evaluation.answer_leakage import ContextualEmbeddings, Lexical
from hinteval.evaluation.convergence import LlmBased
from hinteval.evaluation.familiarity import Wikipedia
from hinteval.evaluation.readability import MachineLearningBased
from hinteval.evaluation.relevance import Rouge

# --- Backend Imports ---
from backend.services.question_service import get_latest_question_id
from backend.services.candidate_service import get_candidates

# Load Env
load_dotenv(dotenv_path="backend/.env")

TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
TOGETHER_BASE_URL = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")

CANONICAL_METRICS = {
    "relevance", "readability", "familiarity", "answer-leakage", "convergence",
}

print("Pre-loading evaluation models...", flush=True)

# Answer Leakage Evaluator
contextual_evaluator = ContextualEmbeddings(sbert_model='all-mpnet-base-v2', enable_tqdm=False)

# Convergence Evaluator
llm_evaluator = LlmBased(model_name="llama-3-70b", together_ai_api_key=TOGETHER_API_KEY)

# Familiarty Evaluator
wikipedia_evaluator = Wikipedia()

# Relevance Evaluator
rougeL_evaluator = Rouge("rougeL")

# Readability Evaluator
ml_readability_evaluator = MachineLearningBased("random_forest")

print("Models loaded.", flush=True)

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b: return 1.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union > 0 else 0.0

def safe_get(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

# =====================================================================================
# Main Service Function
# =====================================================================================
def run_evaluation_and_persist(
    conn,
    session_id: str,
    question: str,
    hints: List[str],
    answer: str,
    model_name: str,
    num_candidates: int,
    temperature: float,
    max_tokens: int
) -> Dict[str, Any]:
    
    existing_candidates = get_candidates(conn, session_id)
    candidates_to_use = []
    candidates_were_generated = False

    if existing_candidates and len(existing_candidates) > 0:
        candidates_to_use = existing_candidates
    else:
        from backend.services.generation_service import generate_only_candidates
        raw_candidates = generate_only_candidates(
            question=question, num_candidates=num_candidates, temperature=temperature, model_name=model_name, max_tokens=max_tokens, hints=hints, top_p=0.9
        )
        candidates_were_generated = True

        candidates_to_use = []
        for i, text in enumerate(raw_candidates):
            # Ensure text is stripped of whitespace to prevent mismatch keys
            clean_text = text.strip()
            is_gt = (i == len(raw_candidates) - 1)
            candidates_to_use.append({"text": clean_text, "is_groundtruth": is_gt})

    # --- 1. GUARANTEED ORDERING LOGIC ---
    # Separate lists ensure we handle Distractors vs GT correctly
    distractors = [c for c in candidates_to_use if not c.get("is_groundtruth")]
    ground_truths = [c for c in candidates_to_use if c.get("is_groundtruth")]
    
    # Fallback: If no GT exists, force the last distractor to be GT
    if not ground_truths and distractors:
        ground_truths = [distractors.pop()]

    # Sort distractors A-Z for consistency
    distractors.sort(key=lambda x: x["text"])
    
    # Concatenate: Distractors FIRST, Ground Truth LAST
    sorted_candidate_objs = distractors + ground_truths
    
    candidates_strings_for_eval = [c["text"] for c in sorted_candidate_objs]

    # --- 2. RUN EVALUATION ---
    results = evaluate_hints(
        question=question,
        hints=hints,
        answer=answer,
        candidates=candidates_strings_for_eval,
        model_name=model_name,
    )

    # --- 3. CONSISTENCY PATCH (Fixing the Convergence Mismatch) ---
    # We recalculate the metric value based on the scores to ensure they match
    num_distractors = len(distractors)
    distractor_texts = set(c["text"] for c in distractors)

    for res in results:
        res_metrics = res.get("metrics", [])
        conv_metric = next((m for m in res_metrics if m.get("name") == "convergence"), None)
        
        if conv_metric and num_distractors > 0:
            scores = conv_metric.get("metadata", {}).get("scores", {})
            
            # Count exactly how many *distractors* are marked as 0 (eliminated)
            eliminated_count = 0
            for dt in distractor_texts:
                # Check score. Default to 1 (compatible) if missing to be safe.
                if scores.get(dt) == 0:
                    eliminated_count += 1
            
            # Recalculate: Convergence = Fraction of distractors eliminated
            new_value = eliminated_count / num_distractors
            conv_metric["value"] = new_value 

    # --- 4. PERSISTENCE ---
    qid = get_latest_question_id(conn, session_id)
    if not qid:
        return {}

    cur = conn.cursor()

    cur.execute("SELECT id, hint_text FROM hints WHERE question_id = %s ORDER BY id ASC", (qid,))
    db_hints = cur.fetchall()

    hint_ids = [h[0] for h in db_hints]
    
    if hint_ids:
        placeholders = ",".join("%s" for _ in hint_ids)
        cur.execute(f"DELETE FROM metrics WHERE hint_id IN ({placeholders})", tuple(hint_ids))
        cur.execute(f"DELETE FROM entities WHERE hint_id IN ({placeholders})", tuple(hint_ids))

    # Map candidate elimination status for DB update
    candidate_elimination_map = {c["text"]: 0 for c in sorted_candidate_objs}
    
    for res in results:
        res_metrics = res.get("metrics", [])
        conv_metric = next((m for m in res_metrics if m.get("name") == "convergence"), None)
        if conv_metric:
            scores = conv_metric.get("metadata", {}).get("scores", {})
            for cand_text, score in scores.items():
                if score == 0:
                    candidate_elimination_map[cand_text] = 1

    if candidates_were_generated:
        cur.execute("DELETE FROM candidate_answers WHERE question_id = %s", (qid,))
        for c_obj in sorted_candidate_objs:
            is_elim = candidate_elimination_map.get(c_obj["text"], 0)
            cur.execute(
                "INSERT INTO candidate_answers (question_id, candidate_text, is_eliminated, created_at, is_groundtruth) VALUES (%s, %s, %s, %s, %s)",
                (qid, c_obj["text"], bool(is_elim), _now(), bool(c_obj["is_groundtruth"]))
            )
    else:
        for c_obj in sorted_candidate_objs:
            is_elim = candidate_elimination_map.get(c_obj["text"], 0)
            cur.execute(
                "UPDATE candidate_answers SET is_eliminated = %s WHERE question_id = %s AND candidate_text = %s",
                (bool(is_elim), qid, c_obj["text"])
            )
    
    conn.commit()

    metrics_payload = []
    entities_payload = []
    scores_convergence_payload = []

    for i, res in enumerate(results):
        matched_id = None
        if i < len(db_hints):
            matched_id = db_hints[i][0]
        
        if matched_id:
            res_metrics = res.get("metrics", [])
            metrics_payload.append(res_metrics)
            
            conv_scores = next((m.get("metadata", {}).get("scores", {}) for m in res_metrics if m.get("name") == "convergence"), {})
            scores_convergence_payload.append(conv_scores)

            for m in res_metrics:
                cur.execute(
                    "INSERT INTO metrics (hint_id, name, value, metadata_json) VALUES (%s, %s, %s, %s)",
                    (matched_id, m.get("name"), m.get("value"), json.dumps(m.get("metadata", {})))
                )

            res_entities = res.get("entities", [])
            entities_payload.append(res_entities)
            
            for e in res_entities:
                cur.execute(
                    "INSERT INTO entities (hint_id, entity, ent_type, start_index, end_index, metadata_json) VALUES (%s, %s, %s, %s, %s, %s)",
                    (matched_id, e.get("entity"), e.get("ent_type"), e.get("start_index"), e.get("end_index"), json.dumps(e.get("metadata", {})))
                )
    
    conn.commit()

    final_candidate_list = candidates_strings_for_eval
    
    candidate_convergence = []
    for c in final_candidate_list:
        scores_for_c = []
        for s in scores_convergence_payload:
            val = s.get(c, None)
            scores_for_c.append(val)
        candidate_convergence.append({"candidate": c, "scores": scores_for_c})

    removed_per_hint = [{c for c, v in s.items() if v == 0} for s in scores_convergence_payload]
    num_hints_len = len(hints)
    hint2hint_sim = []
    for r1 in range(num_hints_len):
        row = []
        for r2 in range(num_hints_len):
            if r1 < len(removed_per_hint) and r2 < len(removed_per_hint):
                row.append(jaccard(removed_per_hint[r1], removed_per_hint[r2]))
            else:
                row.append(0.0)
        hint2hint_sim.append(row)

    print("Evaluation and persistence complete.", flush=True)
    return {
        "question": question,
        "num_hints": len(hints),
        "metrics": metrics_payload,
        "scores_convergence": scores_convergence_payload,
        "entities_per_hint": entities_payload,
        "candidate_convergence": candidate_convergence,
        "hint2hint_similarity": hint2hint_sim,
        "candidate_answers": final_candidate_list,
    }

def evaluate_hints(
    question: str, 
    hints: List[str], 
    answer: Optional[str],
    candidates: List[str],
    model_name: str, 
    enable_tqdm: bool = True
) -> List[Dict[str, Any]]:
    
    if not question or not hints: raise ValueError("Question and hints are required")

    instance = Instance.from_strings(
        question=question.strip(),
        answers=[answer] if (answer and answer.strip()) else [],
        hints=[h.strip() for h in hints],
    )
    print(f"Candidates list: {candidates}", flush=True)
    instance.question.metadata['candidate_answers-llama-3-70b'] = candidates

    instances = [instance]
    q_h_list = [instance.question] + instance.hints
    
    try:
        rougeL_evaluator.evaluate(instances)
    except Exception as e:
        print(f"Rouge Eval Error: {e}")
        traceback.print_exc()

    try:
        ml_readability_evaluator.evaluate(q_h_list)
    except Exception as e:
        print(f"Readability Eval Error: {e}")
        traceback.print_exc()

    try:
        contextual_evaluator.evaluate(instances)
    except Exception as e:
        print(f"Contextual Eval Error: {e}")
        traceback.print_exc()

    try:
        wikipedia_evaluator.evaluate(q_h_list)
    except Exception as e:
        print(f"Wikipedia Eval Error: {e}")
        traceback.print_exc()

    try:
        llm_evaluator.evaluate(instances)
    except Exception as e:
        print(f"LLM Eval Error: {e}")
        traceback.print_exc()

    results = []
    for hint in instance.hints:
        
        entities_out = []
        raw_entities = getattr(hint, "entities", [])
        
        if raw_entities: 
            for ent in raw_entities:
                entities_out.append({
                    "entity": safe_get(ent, "entity"),
                    "ent_type": safe_get(ent, "ent_type"),
                    "start_index": safe_get(ent, "start_index"),
                    "end_index": safe_get(ent, "end_index"),
                    "metadata": safe_get(ent, "metadata", {}) or {},
                })

        metrics_list = []
        metrics_dict = getattr(hint, "metrics", {}) or {}
        
        for _, metric_obj in metrics_dict.items():
            mname = getattr(metric_obj, "name", None)
            
            if mname in CANONICAL_METRICS:
                metrics_list.append({
                    "name": mname,
                    "value": getattr(metric_obj, "value", None),
                    "metadata": getattr(metric_obj, "metadata", {}) or {},
                })
        
        results.append({
            "text": getattr(hint, "hint", None),
            "metrics": metrics_list,
            "entities": entities_out,
        })

    return results