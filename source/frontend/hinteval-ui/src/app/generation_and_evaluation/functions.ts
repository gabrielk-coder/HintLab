import { Hint, MetricKey, MetricsById } from "./types";
import { toFiniteNumber, colorWithConvergence } from "./utils";


const API_BASE = process.env.NEXT_PUBLIC_HINTEVAL_API ?? "http://localhost:8000";

const headers = { "Content-Type": "application/json" };
const creds: RequestCredentials = "include";

// --- METRIC UTILS ---
export const readMetric = (
  obj: Record<string, any> | undefined,
  key: string
): number => {
  if (!obj) return Number.NaN;
  const k1 = key;
  const k2 = key.replace(/-/g, "_");
  const k3 = key.replace(/_/g, "-");
  const v = obj[k1] ?? obj[k2] ?? obj[k3];
  return toFiniteNumber(v, Number.NaN);
};

export const convOf = (metricsById: MetricsById, hintId: number) =>
  readMetric(metricsById[hintId], "convergence");

export const colorForHint = (h: Hint, metricsById: MetricsById) =>
  colorWithConvergence(h.colorHex, convOf(metricsById, h.hint_id));

/** Get a single metric score for a given hint */
export const getMetricScore = (
  hintId: number,
  metric: MetricKey,
  metricsById: MetricsById
): number => {
  const row = metricsById[hintId];
  if (!row) return Number.NaN;

  if (metric === "leakage-avoidance") {
    const leak =
      readMetric(row, "answer-leakage") ||
      readMetric(row, "answer_leakage");
    return Number.isFinite(leak) ? 1 - leak : Number.NaN;
  }

  return (
    readMetric(row, metric) ||
    readMetric(row, metric.replace(/-/g, "_")) ||
    readMetric(row, metric.replace(/_/g, "-"))
  );
};

/** Pure sorting function */
export const sortHintsByMetric = (
  hints: Hint[],
  metricsById: MetricsById,
  sortMetric: MetricKey,
  sortDir: "asc" | "desc"
): Hint[] => {
  const sorted = [...hints].sort((a, b) => {
    const valA = getMetricScore(a.hint_id, sortMetric, metricsById);
    const valB = getMetricScore(b.hint_id, sortMetric, metricsById);

    const aFinite = Number.isFinite(valA);
    const bFinite = Number.isFinite(valB);

    if (!aFinite && !bFinite) return 0;
    if (!aFinite) return 1;
    if (!bFinite) return -1;

    return sortDir === "desc" ? valB - valA : valA - valB;
  });

  return sorted;
};

// --- API IMPLEMENTATION ---

export const api = {
  // Session Management
  getSessionState: async () => {
    const res = await fetch(`${API_BASE}/hinteval/session_state`, { credentials: creds });
    return res.ok ? res.json() : null;
  },
  
  resetSession: async () => {
    return fetch(`${API_BASE}/hinteval/reset_all`, { method: "POST", headers, credentials: creds });
  },

  // Hint Management
  getHints: async () => {
    const res = await fetch(`${API_BASE}/hinteval/get-hints`, { credentials: creds });
    return res.ok ? res.json() : { hints: [] };
  },

  generate: async (body: any) => {
    const res = await fetch(`${API_BASE}/hinteval/generate`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  evaluate: async (body: any) => {
    const res = await fetch(`${API_BASE}/hinteval/evaluate`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Evaluation failed");
    return res.json();
  },

  saveHint: async (text: string) => {
    const res = await fetch(`${API_BASE}/hinteval/save_hint`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ hint_text: text })
    });
    return res.json();
  },

  deleteHint: async (hint_id: number) => {
    return fetch(`${API_BASE}/hinteval/delete_hint`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ hint_id })
    });
  },

  updateHint: async (hint_id: number, hint_text: string) => {
    return fetch(`${API_BASE}/hinteval/update_hint`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ hint_id, hint_text })
    });
  },

  deleteAllHints: async () => {
    return fetch(`${API_BASE}/hinteval/delete_all_hints`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ hint_id: -1 })
    });
  },

  // Candidate Management
  getCandidates: async () => {
    const res = await fetch(`${API_BASE}/hinteval/get_candidates`, { credentials: creds });
    // Expects: { candidates: [{ id: number, text: string, is_groundtruth: boolean }, ...] }
    return res.ok ? res.json() : { candidates: [] };
  },

  saveCandidate: async (text: string, index?: number) => {
    const body: any = { candidate_text: text };
    if (index !== undefined) body.candidate_index = index;
    
    return fetch(`${API_BASE}/hinteval/save_candidate`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify(body)
    });
  },

  deleteCandidate: async (index: number) => {
    return fetch(`${API_BASE}/hinteval/delete_candidate`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ candidate_index: index })
    });
  },
  
  deleteAllCandidates: async () => {
    return fetch(`${API_BASE}/hinteval/delete_all_candidates`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ candidate_index: -1 })
    });
  },
  
  setCandidateAsGroundTruth: async (index: number) => {
    return fetch(`${API_BASE}/hinteval/set_ground_truth`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify({ candidate_index: index })
    });
  },

  updateAnswer: async (text: string) => {
    const res = await fetch(`${API_BASE}/hinteval/update_answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
        credentials: "include"
    });
    if (!res.ok) throw new Error("Failed to update answer");
    return res.json();
  },
  regenerateCandidates: async (body: any) => {
    const res = await fetch(`${API_BASE}/hinteval/regenerate_candidates`, {
      method: "POST", headers, credentials: creds, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Failed to regen candidates");
    return res.json();
  },

  // Metrics & Analytics
  getMetrics: async () => {
    const res = await fetch(`${API_BASE}/metrics/get_metrics`, { credentials: creds });
    return res.ok ? res.json() : [];
  },
  
  getConvergence: async () => {
    const res = await fetch(`${API_BASE}/metrics/get_convergence_scores`, { credentials: creds });
    return res.ok ? res.json() : [];
  },
  
  regenerateAnswer: async (body: any) => {
     const res = await fetch(`${API_BASE}/hinteval/regenerate_answer`, {
        method: "POST", headers, credentials: creds, body: JSON.stringify(body)
     });
     if(!res.ok) throw new Error("Failed");
     return res.json();
  },
  
  loadPreset: async (payload: { data: any }) => {
    const res = await fetch(`${API_BASE}/hinteval/load_preset`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      credentials: creds
    });
    if (!res.ok) throw new Error("Backend failed to load preset");
    return res.json();
  },
};