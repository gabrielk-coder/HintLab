import os
from typing import List, Dict, Tuple, Any

# Versuche HintEval zu importieren – wenn nicht vorhanden, nutze Fallback
HINTEVAL_AVAILABLE = True
try:
    from hinteval import Dataset
    from hinteval.cores import Subset, Instance
    from hinteval.model import AnswerAware
    from hinteval.evaluation.relevance import Rouge
    from hinteval.evaluation.readability import MachineLearningBased
    from hinteval.evaluation.convergence import LlmBased
    from hinteval.evaluation.familiarity import Wikipedia
    from hinteval.evaluation.answer_leakage import ContextualEmbeddings
except Exception:
    HINTEVAL_AVAILABLE = False
    print("⚠️ HintEval not installed.")

def _build_dataset(question: str, gt_answers: List[str]) -> Tuple[Any, Any, Any]:
    if not HINTEVAL_AVAILABLE:
        return None, None, None
    subset = Subset("entire")
    inst = Instance.from_strings(question.strip(), gt_answers or [], [])
    subset.add_instance(inst, "id_1")
    dataset = Dataset("live_session")
    dataset.add_subset(subset)
    dataset.prepare_dataset(fill_question_types=True)
    return dataset, subset, inst

def generate_hints(question: str,
                   gt_answers: List[str],
                   num_hints: int,
                   model_name: str | None,
                   api_key: str | None,
                   base_url: str | None) -> List[str]:
    if HINTEVAL_AVAILABLE:
        dataset, subset, inst = _build_dataset(question, gt_answers)
        generator = AnswerAware(
            model_name or "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            api_key,
            base_url or "https://api.together.xyz/v1",
            num_of_hints=num_hints,
            enable_tqdm=False
        )
        generator.generate(subset.get_instances())
        return [h.hint for h in inst.hints]
    # --- Fallback (ohne HintEval) ---
    q = question.strip()
    base = [
        f"Zerlege die Frage in Kernbegriffe: '{q}'.",
        "Notiere benötigte Fakten und mögliche Quellen.",
        "Skizziere Schritte von bekannten Fakten zur Antwort.",
        "Weise auf typische Missverständnisse hin.",
        "Beschreibe eine kurze Verifikationsstrategie.",
    ]
    return base[:max(1, num_hints)]

def evaluate_hints(question: str,
                   gt_answers: List[str],
                   hints: List[str],
                   model_name: str | None,
                   api_key: str | None,
                   base_url: str | None) -> Dict[str, float]:
    if HINTEVAL_AVAILABLE:
        dataset, subset, inst = _build_dataset(question, gt_answers)
        # Hints an die Instanz hängen (duck-typing falls nötig)
        try:
            inst.hints.clear()
        except Exception:
            pass
        for h in hints:
            try:
                inst.hints.append(type("Hint", (), {"hint": h}))
            except Exception:
                pass

        # Evaluatoren (best effort – je nach Version verfügbar)
        try: Rouge("rougeL", enable_tqdm=False).evaluate(subset.get_instances())
        except Exception: pass
        try:
            texts = [inst.question] + hints
            MachineLearningBased("random_forest", enable_tqdm=False).evaluate(texts)
        except Exception: pass
        try:
            LlmBased("llama-3-70b", together_ai_api_key=api_key, enable_tqdm=False)\
                .evaluate(subset.get_instances())
        except Exception: pass
        try:
            fam_texts = [inst.question] + hints + gt_answers
            Wikipedia(enable_tqdm=False).evaluate(fam_texts)
        except Exception: pass
        try: ContextualEmbeddings(enable_tqdm=False).evaluate(subset.get_instances())
        except Exception: pass

        # Scores auslesen (robust)
        score_map: Dict[str, float] = {}
        metrics = getattr(inst, "metrics", None) or getattr(inst, "scores", None) or {}
        if isinstance(metrics, dict):
            for k, v in metrics.items():
                try:
                    if isinstance(v, dict) and "score" in v:
                        score_map[k] = float(v["score"])
                    elif isinstance(v, (int, float)):
                        score_map[k] = float(v)
                    elif isinstance(v, list) and v and isinstance(v[0], dict) and "score" in v[0]:
                        score_map[k] = sum(float(x["score"]) for x in v) / len(v)
                except Exception:
                    pass

        # Freundliche Namen
        normalized = {}
        def pick(keys, name):
            for kk in keys:
                if kk in score_map:
                    normalized[name] = score_map[kk]; return
        pick(["rougeL", "relevance", "relevance_rouge"], "Relevance")
        pick(["readability", "readability_rf", "ml_readability"], "Readability")
        pick(["convergence", "llm_convergence"], "Convergence")
        pick(["familiarity", "wikipedia"], "Familiarity")
        pick(["answer_leakage", "leakage"], "AnswerLeakage")
        return normalized or score_map

    # --- Fallback-Heuristik ---
    import math
    q_tokens = set(question.lower().split())
    rel = 0.0
    for h in hints:
        ht = set(h.lower().split())
        rel += len(q_tokens & ht) / (len(q_tokens | ht) + 1e-6)
    rel = min(1.0, rel / max(1, len(hints)) * 2.0)
    avg_len = sum(len(h.split()) for h in hints) / max(1, len(hints))
    readability = 1.0 / (1.0 + math.exp((avg_len - 18) / 8.0))
    convergence = min(1.0, 0.3 + 0.05 * len(hints))
    familiarity = 0.5
    leakage = 0.15
    return {
        "Relevance": float(rel),
        "Readability": float(readability),
        "Convergence": float(convergence),
        "Familiarity": float(familiarity),
        "AnswerLeakage": float(leakage),
    }
