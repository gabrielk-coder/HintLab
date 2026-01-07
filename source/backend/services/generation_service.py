from __future__ import annotations
import os
import psycopg2
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

from dotenv import load_dotenv
from together import Together

# --- HintEval Imports ---
from hinteval import Dataset
from hinteval.cores import Answer
from hinteval.model import AnswerAgnostic, AnswerAware
from hinteval.cores import Subset, Instance

# --- Backend Imports ---
from backend.utils.prompts import (
    answer_for_answer_agnostic_prompt,
    answer_for_answer_aware_prompt,
    prompt_candidates
)
from backend.Objects.db_models import AnswerOBJ, HintOBJ

load_dotenv(dotenv_path=".env")

@dataclass
class API_Info:
    model_name: str = os.getenv("HINTEVAL_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct-Lite")
    api_key: Optional[str] = os.getenv("TOGETHER_API_KEY")
    base_url: str = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")

def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def local_insert_question(conn, question_text, session_id):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO questions (text, session_id, created_at) VALUES (%s, %s, %s) RETURNING id",
        (question_text, session_id, _now())
    )
    qid = cur.fetchone()[0]
    conn.commit()
    return qid

def local_insert_answer(conn, question_id, answer_text, model_name, hints: Optional[List[str]] = None):
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM answers WHERE question_id = %s", (question_id,)
    )
    cur.execute(
        "INSERT INTO answers (question_id, answer_text, model_name, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
        (question_id, answer_text, model_name, _now())
    )
    aid = cur.fetchone()[0]

    if hints:
        cur.execute(
            "UPDATE hints SET answer_id = %s WHERE question_id = %s",
            (aid, question_id)
        )
    conn.commit()
    return aid

def local_insert_hint(conn, question_id, hint_text, answer_id):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO hints (question_id, answer_id, hint_text, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
        (question_id, answer_id, hint_text, _now())
    )
    hid = cur.fetchone()[0]
    conn.commit()
    return hid

# =====================================================================================
# Main Service Function
# =====================================================================================

def process_generation(
    conn,
    session_id: str,
    question: str,
    num_hints: int,
    temperature: float,
    max_tokens: int,
    model_name: str,
    answer_aware: bool = False,
    provided_answer: str = None
) -> Dict[str, Any]:
    cfg = API_Info(model_name=model_name)

    answer_obj, hint_objs = generate_answer_hints(
        conn=conn,
        question=question,
        num_hints=num_hints,
        temperature=temperature,
        max_tokens=max_tokens,
        cfg=cfg,
        answer=answer_aware,
        session_id=session_id,
        provided_answer_text=provided_answer 
    )

    return {
        "question": question,
        "hints": [{"id": h.id, "text": h.hint_text} for h in hint_objs],
        "answer": answer_obj.answer_text,
    }

def generate_only_answer(
    conn,
    session_id: str,
    question: str,
    model_name: str,
    temperature: float = 0.3,
    max_tokens: int = 512,
    question_id: int = None,
    hints: Optional[List[str]] = None,
    top_p: float = 0.9
) -> str:
    cfg = API_Info(model_name=model_name)
    answer_text = generate_answer_agnostic(question, max_tokens, temperature, top_p, cfg)
    
    if question_id:
        local_insert_answer(conn=conn, question_id=question_id, answer_text=answer_text, model_name=model_name, hints=hints)
    
    return answer_text

def generate_only_candidates(
    question: str,
    num_candidates: int,
    temperature: float,
    model_name: str,
    max_tokens: int,
    hints: Optional[List[str]] = None,
    top_p: float = 0.9
) -> List[str]:
    """Generates candidate answers using LLM."""
    cfg = API_Info(model_name=model_name)
    client = Together(api_key=cfg.api_key)

    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=cfg.model_name,
                messages=[
                    {"role": "system", "content": "You generate candidate answers exactly as instructed."},
                    {"role": "user", "content": prompt_candidates(num_candidates, question, max_tokens=max_tokens, hints=hints)},
                ],
                stream=False, temperature=temperature, max_tokens=max_tokens, top_p=top_p
            )

            text = resp.choices[0].message.content.strip()
            if not text: raise ValueError("Empty response")

            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            out, seen = [], set()
            for ln in lines:
                ln = ln.lstrip("0123456789.-) ").strip()
                if ln and ln not in seen:
                    seen.add(ln)
                    out.append(ln)
                if len(out) >= num_candidates: break

            if len(out) >= num_candidates:
                return out[:num_candidates]
            
            elif out:
                return out 

        except Exception as e:
            print(f"[Attempt {attempt+1}] Candidate Gen Error: {e}")

    return []

# =====================================================================================
# Internal Helpers
# =====================================================================================

def new_dataset_instance(question: str, answer: Optional[str] = None) -> Tuple[Dataset, Instance]:
    ds = Dataset(name="Custom dataset", description="Dataset created for hint generation.", version="1.0")
    sub = Subset('entire')
    ds.add_subset(sub)
    if answer:
        inst = Instance.from_strings(question.strip(), [answer.strip()], [])
    else:
        inst = Instance.from_strings(question.strip(), [], [])

    sub.add_instance(inst, "id_1")
    return ds, inst


import re

def my_parse_llm_response(llm_output: str) -> list[str]:
    hints: list[str] = []

    #print("LLM Output:\n", llm_output, flush=True)

    for line in llm_output.splitlines():
        line = line.strip()

        # Matcht: "1. text", "2. text", ...
        match = re.match(r'^\d+\.\s*(.+)', line)
        if match:
            hints.append(match.group(1).strip())

    return hints





def generate_answer_hints(
    conn,
    question: str,
    num_hints: Optional[int],
    temperature: Optional[float],
    max_tokens: Optional[int],
    cfg: API_Info,
    answer: bool,
    session_id: Optional[str],
    provided_answer_text: Optional[str] = None, 
    top_p: float = 0.9,
    enable_tqdm: bool = True,
) -> Tuple[AnswerOBJ, List[HintOBJ]]:
    
    question_id = local_insert_question(conn=conn, question_text=question, session_id=session_id)

    answer_text = ""

    if provided_answer_text:
         answer_text = provided_answer_text
    elif answer is False:
         answer_text = generate_answer_agnostic(question, max_tokens=max_tokens, temperature=temperature,top_p=top_p, cfg=cfg)
    else:
         answer_text = generate_answer_aware(question, max_tokens=max_tokens, temperature=temperature, cfg=cfg, top_p=top_p, answer=None)

    hint_texts = []
    if num_hints and num_hints > 0:
        if answer is False:
            ds, inst = new_dataset_instance(question)
            print("Generating answer-agnostic hints...", flush=True)
            gen = AnswerAgnostic(
                model_name=cfg.model_name,
                api_key=cfg.api_key,
                base_url=cfg.base_url,
                num_of_hints=num_hints,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                batch_size=1,
                parse_llm_response=my_parse_llm_response)
            gen.generate(ds["entire"].get_instances())
            hint_texts = [h.hint for h in inst.hints if (h.hint or "").strip()]
            gen.release_memory()
        else:
            print("Generating answer-aware hints...", flush=True)
            dataset, inst = new_dataset_instance(question=question, answer=answer_text)
            gen = AnswerAware(
                model_name=cfg.model_name,
                api_key=cfg.api_key,
                base_url=cfg.base_url,
                num_of_hints=num_hints,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                batch_size=1,
                parse_llm_response=my_parse_llm_response)
            gen.generate(dataset["entire"].get_instances())
            hint_texts = [h.hint for h in inst.hints if (h.hint or "").strip()]
            gen.release_memory()

    answer_id = local_insert_answer(conn=conn, question_id=question_id, answer_text=answer_text, model_name=cfg.model_name)
    
    answer_obj = AnswerOBJ(id=answer_id, question_id=question_id, answer_text=answer_text, model_name=cfg.model_name)
    hint_objs = []
    
    for h_text in hint_texts:
        hid = local_insert_hint(conn=conn, question_id=question_id, hint_text=h_text, answer_id=answer_id)
        hint_objs.append(HintOBJ(id=hid, question_id=question_id, answer_id=answer_id, hint_text=h_text))

    return answer_obj, hint_objs

def generate_answer_agnostic(question: str, max_tokens: int, temperature: float, top_p: float, cfg: API_Info, max_retries: int = 3) -> str:
    if not question.strip(): return "No question provided."
    client = Together(api_key=cfg.api_key)
    user_prompt = answer_for_answer_agnostic_prompt(question.strip(), max_tokens)
    
    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=cfg.model_name,
                messages=[
                    {"role": "system", "content": "You are a concise assistant. Provide only the answer text."},
                    {"role": "user", "content": user_prompt},
                ],
                stream=False, temperature=temperature, max_tokens=max_tokens, top_p=top_p
            )
            text = (resp.choices[0].message.content or "").strip()
            if text: return text
        except Exception as e:
            print(f"Gen Answer Agnostic Error (Attempt {attempt+1}): {e}",flush=True)
    return "Answer unavailable."

def generate_answer_aware(question: str, max_tokens: int, temperature: float, cfg: API_Info, top_p: float, answer: str = None, max_retries: int = 3) -> str:
    if not question.strip(): return "No question provided."
    client = Together(api_key=cfg.api_key)
    

    user_prompt = answer_for_answer_aware_prompt(question.strip(), answer=answer, max_tokens=max_tokens)

    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=cfg.model_name,
                messages=[
                    {"role": "system", "content": "You are a concise assistant. Provide only the answer text."},
                    {"role": "user", "content": user_prompt},
                ],
                stream=False, temperature=temperature, max_tokens=max_tokens, top_p=top_p
            )
            text = (resp.choices[0].message.content or "").strip()
            if text: return text
        except Exception as e:
            print(f"Gen Answer Aware Error (Attempt {attempt+1}): {e}",flush=True)
    return "Answer unavailable."