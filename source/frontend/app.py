import os
import json
import pandas as pd
import altair as alt
import streamlit as st
import requests

st.set_page_config(page_title="HintEval Site", page_icon="💡", layout="wide")
st.title("💡 HintEval – Streamlit Frontend (Python Backend)")

with st.sidebar:
    st.header("🔌 Backend")
    backend_url = st.text_input("Backend URL", value=os.getenv("BACKEND_URL", "http://127.0.0.1:8000"))
    st.divider()
    st.header("⚙️ LLM / HintEval")
    api_key = st.text_input("Together API Key (optional)", type="password")
    base_url = st.text_input("Together Base URL", value="https://api.together.xyz/v1")
    model_name = st.text_input("Modell", value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo")
    num_hints = st.slider("Anzahl Hints", 1, 10, 5)
    max_tokens = st.slider("Max Tokens (Antwort)", 32, 1024, 256, step=32)
    temperature = st.slider("Temperature", 0.0, 1.0, 0.2, 0.1)

st.write("Gib deine **Frage** und optional **richtige Antwort(en)** ein:")

c1, c2 = st.columns([2,1])
with c1:
    question = st.text_area("📝 Frage / Prompt", height=140, placeholder="z. B. Erkläre Overfitting vs. Underfitting.")
with c2:
    gt_answer_str = st.text_area("✅ (Optional) Ground-Truth Antwort(en) (eine pro Zeile)", height=140, placeholder="Overfitting: ...\nUnderfitting: ...")

btn = st.button("🚀 Generieren & Bewerten", type="primary", disabled=not question.strip())

def to_metric_df(scores: dict) -> pd.DataFrame:
    items = [{"Metrik": k, "Score": float(v)} for k, v in scores.items()]
    return pd.DataFrame(items)

def draw_pipeline():
    src = r"""
    digraph G {
        rankdir=LR;
        node [shape=box, style=rounded];
        Q[label="Frage (User)"];
        H[label="Hint-Gen (Backend)"];
        E[label="Evaluation (Backend)"];
        V[label="Charts (Frontend)"];
        A[label="Antwort (Backend LLM)"];
        Q -> H -> E -> V;
        Q -> A;
    }
    """
    st.graphviz_chart(src)

if btn:
    gt_answers = [ln.strip() for ln in gt_answer_str.splitlines() if ln.strip()] if gt_answer_str.strip() else []
    payload = {
        "question": question,
        "gt_answers": gt_answers,
        "num_hints": num_hints,
        "model_name": model_name,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "together_api_key": api_key or None,
        "together_base_url": base_url or None
    }

    with st.status("⏳ Anfrage an Backend …", expanded=False):
        try:
            r = requests.post(f"{backend_url.rstrip('/')}/process", json=payload, timeout=120)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            st.error(f"Backend-Fehler: {e}")
            st.stop()

    # Antwort
    st.subheader("🗣️ Antwort")
    st.write(data.get("answer", ""))

    # Hints
    st.subheader("🧩 Hints")
    hints = data.get("hints", []) or []
    for i, h in enumerate(hints, 1):
        st.markdown(f"**Hint {i}:** {h}")

    # Scores
    st.subheader("📊 Metriken")
    scores = data.get("scores", {}) or {}
    if scores:
        df = to_metric_df(scores)
        chart = alt.Chart(df).mark_bar().encode(
            x=alt.X("Metrik:N", sort="-y"),
            y=alt.Y("Score:Q", scale=alt.Scale(domain=[0, 1])),
            tooltip=["Metrik", "Score"]
        ).properties(height=280)
        st.altair_chart(chart, use_container_width=True)
    else:
        st.info("Keine Scores empfangen.")

    # Pipeline
    st.subheader("🔁 Pipeline")
    draw_pipeline()

    # Export
    st.subheader("💾 Export")
    export = {
        "question": question,
        "answers_gt": gt_answers,
        "answer_model": data.get("answer", ""),
        "hints": hints,
        "scores": scores,
    }
    st.download_button(
        "Download JSON",
        data=json.dumps(export, ensure_ascii=False, indent=2),
        file_name="hinteval_result.json",
        mime="application/json",
    )
