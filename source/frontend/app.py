import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import altair as alt
import pandas as pd
import requests
import streamlit as st

st.set_page_config(page_title="HintEval Workspace", page_icon="💡", layout="wide")

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
DEFAULT_MODEL = os.getenv("HINTEVAL_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_BASE_URL = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")

st.title("💡 HintEval Workspace")

st.markdown(
    """
    <style>
    .frame {
        border: 1px solid #dfe3ea;
        border-radius: 12px;
        padding: 1.4rem 1.2rem;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        margin-bottom: 1.2rem;
    }
    .frame h3 {
        margin-top: 0;
    }
    .hint-meta {
        font-size: 0.78rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 0.35rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

if "hints" not in st.session_state:
    st.session_state.hints: List[Dict[str, Any]] = []
if "model_answer" not in st.session_state:
    st.session_state.model_answer = ""
if "scores" not in st.session_state:
    st.session_state.scores: Dict[str, Any] = {}
if "score_history" not in st.session_state:
    st.session_state.score_history: List[Dict[str, Any]] = []
if "interaction_log" not in st.session_state:
    st.session_state.interaction_log: List[Dict[str, Any]] = []


def build_metric_df(scores: Dict[str, Any]) -> pd.DataFrame:
    rows = []
    for metric, value in (scores or {}).items():
        try:
            rows.append({"Metric": metric, "Score": float(value)})
        except (TypeError, ValueError):
            continue
    return pd.DataFrame(rows)


def average_score(scores: Dict[str, Any]) -> Optional[float]:
    numeric_values: List[float] = []
    for value in (scores or {}).values():
        try:
            numeric_values.append(float(value))
        except (TypeError, ValueError):
            continue
    if not numeric_values:
        return None
    return sum(numeric_values) / len(numeric_values)


def ensure_hint_id(hint: Dict[str, Any]) -> Dict[str, Any]:
    if "id" not in hint:
        hint["id"] = str(uuid4())
    if "origin" not in hint:
        hint["origin"] = "model"
    if "used" not in hint:
        hint["used"] = False
    return hint


def sync_hint_state() -> None:
    for hint in st.session_state.hints:
        ensure_hint_id(hint)
        text_key = f"hint_text_{hint['id']}"
        used_key = f"hint_used_{hint['id']}"
        if text_key in st.session_state:
            hint["text"] = st.session_state[text_key]
        if used_key in st.session_state:
            hint["used"] = st.session_state[used_key]


def call_backend_process(
    question: str,
    gt_answers: List[str],
    num_hints: int,
    max_tokens: int,
    temperature: float,
) -> Optional[Dict[str, Any]]:
    payload = {
        "question": question,
        "gt_answers": gt_answers,
        "num_hints": num_hints,
        "model_name": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "together_api_key": TOGETHER_API_KEY or None,
        "together_base_url": TOGETHER_BASE_URL or None,
    }
    try:
        response = requests.post(
            f"{BACKEND_URL}/process",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:  # noqa: BLE001
        st.error(f"Backend request failed: {exc}")
        return None


def call_backend_answer(
    prompt: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    payload = {
        "prompt": prompt,
        "model_name": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "together_api_key": TOGETHER_API_KEY or None,
        "together_base_url": TOGETHER_BASE_URL or None,
    }
    try:
        response = requests.post(
            f"{BACKEND_URL}/answer",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("answer")
    except Exception as exc:  # noqa: BLE001
        st.error(f"Backend request failed: {exc}")
        return None


left_col, right_col = st.columns([1.4, 1])

with left_col:
    st.markdown('<div class="frame">', unsafe_allow_html=True)
    st.markdown("### Prompt & Hint Studio")

    question = st.text_area(
        "Prompt",
        key="question_input",
        height=150,
        placeholder="Beschreibe dein Problem oder die Frage, zu der du Hinweise brauchst.",
    )

    gt_answers_raw = st.text_area(
        "Erwartete Antworten (optional, eine pro Zeile)",
        key="gt_answers_input",
        height=100,
        placeholder="Richtige Antwort 1\nRichtige Antwort 2",
    )

    st.markdown("#### Modellsteuerung")
    hint_count = st.slider("Anzahl automatischer Hinweise", 1, 10, 5)
    max_tokens = st.slider("Maximale Antwortlänge", 32, 1024, 256, step=32)
    temperature = st.slider("Kreativität", 0.0, 1.0, 0.2, 0.05)

    st.markdown("#### Manuelle Hinweise verwalten")
    new_hint_text = st.text_input(
        "Neuen Hinweis hinzufügen",
        key="new_hint_text",
        placeholder="Formuliere hier deinen eigenen Hinweis",
    )
    add_hint_col, clear_hint_col = st.columns([0.7, 0.3])
    with add_hint_col:
        if st.button("Hinweis hinzufügen", key="add_hint_button") and new_hint_text.strip():
            st.session_state.hints.append(
                {
                    "id": str(uuid4()),
                    "text": new_hint_text.strip(),
                    "used": False,
                    "origin": "manual",
                }
            )
            st.session_state.new_hint_text = ""
            st.experimental_rerun()
    with clear_hint_col:
        if st.button("Alle entfernen", key="clear_hints_button"):
            st.session_state.hints = [h for h in st.session_state.hints if h.get("origin") == "manual"]
            for key in list(st.session_state.keys()):
                if key.startswith("hint_text_") or key.startswith("hint_used_"):
                    del st.session_state[key]
            st.experimental_rerun()

    if st.session_state.hints:
        st.markdown("<div class='hint-meta'>Hinweise bearbeiten</div>", unsafe_allow_html=True)
        for hint in list(st.session_state.hints):
            ensure_hint_id(hint)
            hint_text_key = f"hint_text_{hint['id']}"
            hint_used_key = f"hint_used_{hint['id']}"

            cols = st.columns([0.75, 0.15, 0.1])
            with cols[0]:
                st.text_input(
                    f"Hint ({'manuell' if hint.get('origin') == 'manual' else 'modell'})",
                    key=hint_text_key,
                    value=hint.get("text", ""),
                )
            with cols[1]:
                st.checkbox(
                    "verwendet",
                    key=hint_used_key,
                    value=bool(hint.get("used", False)),
                    help="Markiere den Hinweis als genutzt, um ihn auf der rechten Seite durchzustreichen.",
                )
            with cols[2]:
                if st.button("✕", key=f"remove_hint_{hint['id']}"):
                    st.session_state.hints = [h for h in st.session_state.hints if h["id"] != hint["id"]]
                    for suffix in (hint_text_key, hint_used_key):
                        if suffix in st.session_state:
                            del st.session_state[suffix]
                    st.experimental_rerun()

    generate_clicked = st.button(
        "Automatisch Hinweise & Antwort abrufen",
        type="primary",
        use_container_width=True,
        disabled=not question.strip(),
    )
    st.markdown('</div>', unsafe_allow_html=True)

with right_col:
    st.markdown('<div class="frame">', unsafe_allow_html=True)
    st.markdown("### Antworten & Auswertung")

    show_answer = st.checkbox(
        "Modellantwort anzeigen",
        key="show_answer_toggle",
        value=bool(st.session_state.get("model_answer")),
    )
    if show_answer and st.session_state.model_answer:
        st.markdown(st.session_state.model_answer)
    elif show_answer:
        st.info("Noch keine Antwort vorhanden.")

    st.markdown("#### Hinweisfortschritt")
    sync_hint_state()
    if st.session_state.hints:
        for hint in st.session_state.hints:
            text = hint.get("text", "").strip()
            if not text:
                continue
            display_text = f"~~{text}~~" if hint.get("used") else text
            badge = "🧠" if hint.get("origin") == "manual" else "✨"
            st.markdown(f"- {badge} {display_text}")
    else:
        st.caption("Noch keine Hinweise vorhanden. Füge manuelle Hinweise hinzu oder lasse das Modell welche erzeugen.")

    if st.session_state.scores:
        st.markdown("#### Bewertungsmetriken")
        metric_df = build_metric_df(st.session_state.scores)
        if not metric_df.empty:
            bar_chart = (
                alt.Chart(metric_df)
                .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                .encode(
                    x=alt.X("Metric:N", sort="-y", title="Metrik"),
                    y=alt.Y("Score:Q", scale=alt.Scale(domain=[0, 1]), title="Score"),
                    tooltip=["Metric", alt.Tooltip("Score:Q", format=".2f")],
                )
                .properties(height=260)
            )
            st.altair_chart(bar_chart, use_container_width=True)
    if st.session_state.score_history:
        st.markdown("#### Konvergenzverlauf")
        history_df = pd.DataFrame(st.session_state.score_history)
        line_chart = (
            alt.Chart(history_df)
            .mark_line(point=True)
            .encode(
                x=alt.X("attempt:Q", title="Versuch"),
                y=alt.Y("avg_score:Q", scale=alt.Scale(domain=[0, 1]), title="Durchschnittlicher Score"),
                tooltip=["attempt", alt.Tooltip("avg_score", format=".2f")],
            )
            .properties(height=220)
        )
        st.altair_chart(line_chart, use_container_width=True)

    if st.session_state.interaction_log:
        st.markdown("#### Verlauf der Modell-Interaktionen")
        for entry in reversed(st.session_state.interaction_log):
            st.markdown(f"**Prompt:** {entry['prompt']}")
            if entry.get("answer"):
                st.markdown(f"**Antwort:** {entry['answer']}")
            if entry.get("timestamp"):
                st.caption(entry["timestamp"])
            st.divider()

    st.markdown('</div>', unsafe_allow_html=True)

if generate_clicked:
    gt_answers = [line.strip() for line in gt_answers_raw.splitlines() if line.strip()]
    with st.spinner("Modell wird abgefragt …"):
        result = call_backend_process(
            question=question.strip(),
            gt_answers=gt_answers,
            num_hints=hint_count,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    if result:
        model_hints = [hint.strip() for hint in result.get("hints", []) if hint.strip()]
        manual_hints = [ensure_hint_id(h) for h in st.session_state.hints if h.get("origin") == "manual"]
        st.session_state.hints = manual_hints + [
            {
                "id": str(uuid4()),
                "text": hint_text,
                "used": False,
                "origin": "model",
            }
            for hint_text in model_hints
        ]
        st.session_state.model_answer = result.get("answer", "")
        st.session_state.scores = result.get("scores", {})

        avg = average_score(st.session_state.scores)
        if avg is not None:
            st.session_state.score_history.append(
                {
                    "attempt": len(st.session_state.score_history) + 1,
                    "avg_score": avg,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        sync_hint_state()
        st.experimental_rerun()

bottom_container = st.container()
with bottom_container:
    st.markdown('<div class="frame">', unsafe_allow_html=True)
    st.markdown("### Interacting with a model to identify correct answer")
    interaction_prompt = st.text_input(
        "Folgeprompt",
        key="interaction_prompt_input",
        placeholder="Nutze die bisherigen Hinweise, um das Modell gezielt weiter zu fragen.",
    )
    submit_interaction = st.button(
        "Prompt senden",
        key="interaction_submit",
        disabled=not interaction_prompt.strip(),
    )
    if submit_interaction and interaction_prompt.strip():
        with st.spinner("Modellantwort wird geholt …"):
            answer = call_backend_answer(
                prompt=interaction_prompt.strip(),
                max_tokens=max_tokens,
                temperature=temperature,
            )
        if answer is not None:
            st.session_state.interaction_log.append(
                {
                    "prompt": interaction_prompt.strip(),
                    "answer": answer,
                    "timestamp": datetime.utcnow().strftime("%d.%m.%Y %H:%M:%S"),
                }
            )
            st.session_state.interaction_prompt_input = ""
            st.experimental_rerun()
    st.markdown('</div>', unsafe_allow_html=True)
