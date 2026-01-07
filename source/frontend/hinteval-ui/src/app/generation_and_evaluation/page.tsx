"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, GripVertical, SortAsc, SortDesc, Bot, RotateCcw, Pencil, X,
  Sparkles, Layers, Target, Settings2, Eye, EyeOff, ListFilter, Play,
  ChevronDown, ChevronUp, HelpCircle, Lightbulb, RefreshCw, ArrowLeft, ArrowRight,
  CheckCircle2
} from "lucide-react";

import {
  Hint, MetricKey, MetricsById, EvaluationPayload, GenerateResponse, ElimMode
} from "@/app/generation_and_evaluation/types";

import {
  DEFAULT_METRICS, EXAMPLE_QUESTIONS, shortify, arraysEqual, toFiniteNumber,
  coerceToPlainText, shuffledRange, colorFromId
} from "@/app/generation_and_evaluation/utils";

import { api, sortHintsByMetric } from "@/app/generation_and_evaluation/functions";
import { PRESET_DATA } from "@/app/generation_and_evaluation/presets";

// --- INTERFACES ---
interface Candidate {
  id: number;
  text: string;
  is_groundtruth: boolean;
}

// --- UNIFIED STORAGE KEY ---
const STORAGE_KEY = "hinteval_session_v4";

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_HINTEVAL_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const MODEL_OPTIONS = [
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "Qwen/Qwen3-Next-80B-A3B-Instruct",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "moonshotai/Kimi-K2-Instruct-0905",
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"
];
const SMALL_MODEL_OPTIONS = ["moonshotai/Kimi-K2-Instruct-0905"];

// --- UI Helper Components ---

const CardOverlay = ({ text, minimal = false }: { text: string; minimal?: boolean }) => (
  <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl border border-white/10 animate-in fade-in duration-300 cursor-not-allowed">
    <div className={`relative ${minimal ? '' : 'mb-4'}`}>
      <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-400 rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
      </div>
    </div>
    {text && (
      <p className="text-base font-bold text-white tracking-wide shadow-black drop-shadow-md animate-in slide-in-from-bottom-2">
        {text}
      </p>
    )}
  </div>
);

const HelpTip = ({ content }: { content: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-indigo-400 transition-colors p-1" title="Click for info">
        <HelpCircle className="w-5 h-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-64 p-3 bg-slate-800 border border-indigo-500/30 text-slate-100 text-xs rounded-lg shadow-xl animate-in slide-in-from-top-2">
            <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Tip</div>
            {content}
          </div>
        </>
      )}
    </div>
  )
};

const ActionTooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-slate-800 text-slate-200 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border border-slate-700 shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
    </div>
  </div>
);

export default function HintEvalApp() {
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionOrder, setSuggestionOrder] = useState<number[]>([]);

  // --- Core Data State ---
  const [question, setQuestion] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [metricsById, setMetricsById] = useState<MetricsById>({});
  
  // --- Visual/Interaction State ---
  const [unveiled, setUnveiled] = useState<Record<string | number, boolean>>({});
  const eliminationMapRef = useRef<Record<string | number, boolean[]>>({});
  const [elimNonce, setElimNonce] = useState(0); 
  const [hintStep, setHintStep] = useState(0);
  const [sortMetric, setSortMetric] = useState<MetricKey>("convergence");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // --- Configuration ---
  const [modelName, setModelName] = useState<string>(DEFAULT_MODEL);
  const [smallModelName, setSmallModelName] = useState<string>(SMALL_MODEL_OPTIONS[0]);
  const [numHints, setNumHints] = useState(5);
  const [temperature, setTemperature] = useState(0.3);
  const [hintMaxTokens, setHintMaxTokens] = useState(512);
  const [candCount, setCandCount] = useState(11);
  const [candMaxTokens, setCandMaxTokens] = useState(256);
  const [answerEnabled, setAnswerEnabled] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [elimMode, setElimMode] = useState<ElimMode>("per-hint");

  // --- Loading ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRegeneratingAnswer, setIsRegeneratingAnswer] = useState(false);
  const [isRegeneratingCandidates, setIsRegeneratingCandidates] = useState(false);
  const isBusy = isGenerating || isEvaluating || isRegeneratingAnswer || isRegeneratingCandidates;

  // --- Editing ---
  const [newCandidateText, setNewCandidateText] = useState("");
  const [newHintText, setNewHintText] = useState("");
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const [editedAnswerText, setEditedAnswerText] = useState("");
  
  const [editingHint, setEditingHint] = useState<Hint | null>(null);
  const [editingHintText, setEditingHintText] = useState("");
  const [pendingDeleteHint, setPendingDeleteHint] = useState<Hint | null>(null);
  
  const [editingCandidateIndex, setEditingCandidateIndex] = useState<number | null>(null);
  const [editingCandidateText, setEditingCandidateText] = useState("");
  const [pendingDeleteCandidateIndex, setPendingDeleteCandidateIndex] = useState<number | null>(null);
  
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const lastRunKeyRef = useRef<string>("");
  const dragIndex = useRef<number | null>(null);

  const hasServerQuestion = !!question.trim();
  const currentSuggestion = useMemo(() => {
    if (!mounted || !suggestionOrder.length) return "";
    return EXAMPLE_QUESTIONS[suggestionOrder[suggestionIdx] ?? 0];
  }, [mounted, suggestionOrder, suggestionIdx]);

  // --- Refs for Sorting ---
  // These ensure fullDbSync can access the latest state inside async callbacks
  const sortMetricRef = useRef(sortMetric);
  const sortDirRef = useRef(sortDir);

  useEffect(() => { sortMetricRef.current = sortMetric; }, [sortMetric]);
  useEffect(() => { sortDirRef.current = sortDir; }, [sortDir]);

  // --- Effects ---

  useEffect(() => {
    setMounted(true);
    setSuggestionOrder(shuffledRange(EXAMPLE_QUESTIONS.length));
    const interval = setInterval(() => {
      setSuggestionIdx((prev) => (prev + 1) % EXAMPLE_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync DB
  useEffect(() => {
    if (!mounted) return;
    const initialize = async () => {
      try {
        const sessionData = await api.getSessionState();
        if (!sessionData) return;

        let localState: any = null;
        if (typeof window !== "undefined") {
           const raw = window.localStorage.getItem(STORAGE_KEY);
           if (raw) localState = JSON.parse(raw);
        }

        // Use local storage if question matches to preserve local UI state
        if (localState && localState.question === (sessionData.question || "")) {
           applyLocalState(localState);
        } else {
           await fullDbSync(sessionData);
        }
      } catch (e) { console.error("Init failed:", e); } 
      finally { setHydrated(true); }
    };
    initialize();
  }, [mounted]);

  // Save State
  useEffect(() => {
    if (!mounted || !hydrated) return;
    try {
      const payload = {
        question, questionInput, groundTruth, hints, candidates, metricsById,
        eliminationMap: eliminationMapRef.current, unveiled, hintStep,
        sortMetric, sortDir, answerEnabled, numHints, temperature, hintMaxTokens,
        candCount, candMaxTokens, modelName, smallModelName,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { console.error(e); }
  }, [mounted, hydrated, question, questionInput, groundTruth, hints, candidates, metricsById, unveiled, hintStep, sortMetric, sortDir, answerEnabled, numHints, temperature, hintMaxTokens, candCount, candMaxTokens, modelName, smallModelName, elimNonce]);

  // --- Helpers ---

  const applyLocalState = (saved: any) => {
      setQuestion(saved.question ?? "");
      setQuestionInput(saved.questionInput ?? "");
      setGroundTruth(saved.groundTruth ?? "");
      setHints(saved.hints || []); 
      
      const rawCands = saved.candidates || [];
      if (rawCands.length > 0 && typeof rawCands[0] === 'string') {
         setCandidates(rawCands.map((c: string, i: number) => ({ id: i, text: c, is_groundtruth: false })));
      } else {
         setCandidates(rawCands);
      }

      setMetricsById(saved.metricsById || {});
      setUnveiled(saved.unveiled || {});

      if (saved.eliminationMap) {
        eliminationMapRef.current = saved.eliminationMap;
        setElimNonce(n => n + 1);
      }

      setHintStep(saved.hintStep ?? 0);
      setSortMetric(saved.sortMetric ?? "convergence");
      setSortDir(saved.sortDir ?? "desc");
      setAnswerEnabled(saved.answerEnabled ?? false);
      setNumHints(saved.numHints ?? 5);
      setTemperature(saved.temperature ?? 0.3);
      setHintMaxTokens(saved.hintMaxTokens ?? 512);
      setCandCount(saved.candCount ?? 11);
      setCandMaxTokens(saved.candMaxTokens ?? 256);
      setModelName(saved.modelName ?? DEFAULT_MODEL);
      setSmallModelName(saved.smallModelName ?? SMALL_MODEL_OPTIONS[0]);
  };

  const fullDbSync = async (preloadedSessionData?: any) => {
    try {
      let data = preloadedSessionData || await api.getSessionState();
      if (data && data.question) {
         setQuestion(data.question);
         setQuestionInput(data.question);
         setGroundTruth(data.answer || "");

         // 1. Load Metrics First
         const mData: any[] = await api.getMetrics();
         const reconstructedMetrics: MetricsById = {};
         if(mData && mData.length > 0) {
            mData.forEach(m => {
               const row: Record<string, number> = {};
               if (Number.isFinite(m.convergence)) row['convergence'] = m.convergence;
               if (Number.isFinite(m.relevance)) row['relevance'] = m.relevance;
               if (Number.isFinite(m.familiarity)) row['familiarity'] = m.familiarity;
               if (Number.isFinite(m.readability)) row['readability'] = m.readability;
               if (Number.isFinite(m['answer_leakage'])) {
                  row['leakage-avoidance'] = 1 - m['answer_leakage'];
                  row['answer-leakage'] = m['answer_leakage'];
               }
               if (Object.keys(row).length > 0) reconstructedMetrics[m.id] = row;
            });
         }
         setMetricsById(reconstructedMetrics);

         // 2. Load Hints and SORT THEM IMMEDIATELY based on metrics + current sort settings
         const hData = await api.getHints();
         if (hData) {
           let loadedHints: Hint[] = (hData.hints || []).map((h: any) => {
             const safeId = Number(h.id ?? h.hint_id);
             return { hint_id: safeId, hint_text: h.hint_text, colorHex: colorFromId(safeId) };
           });

           // Use Refs to get the current sort preference
           loadedHints = sortHintsByMetric(loadedHints, reconstructedMetrics, sortMetricRef.current, sortDirRef.current);
           setHints(loadedHints);
         }

         const cData = await api.getCandidates();
         const currentCands = cData?.candidates || [];
         const mappedCands: Candidate[] = currentCands.map((c: any, i: number) => {
             if (typeof c === 'string') return { id: i, text: c, is_groundtruth: false };
             return c;
         });
         setCandidates(mappedCands);

         const cDataConv = await api.getConvergence();
         if (cDataConv && mappedCands.length > 0) {
            const newElimMap: Record<number, boolean[]> = {};
            cDataConv.forEach((h: any) => {
               const safeId = Number(h.id ?? h.hint_id);
               if (!isNaN(safeId) && h.candidates) {
                   const candTexts = mappedCands.map(c => c.text);
                   newElimMap[safeId] = candTexts.map((txt) => (h.candidates[txt] === 1 ? false : true));
               }
            });
            eliminationMapRef.current = newElimMap;
            setElimNonce(n => n + 1);
         }
      }
    } catch (e) { console.error("DB Sync Error", e); }
  };

  const doGenerate = async () => {
    const q = questionInput.trim();
    if (!q) { alert("Please enter a question."); return; }
    setIsGenerating(true);
    try {
      await api.resetSession();
      resetSession({ preserveInput: true });
      lastRunKeyRef.current = JSON.stringify({ q, numHints, temperature, hintMaxTokens, candCount, candMaxTokens, modelName, answerEnabled });
      setQuestion(q);

      const data: GenerateResponse = await api.generate({ 
          question: q, num_hints: numHints, temperature:temperature, max_tokens: hintMaxTokens, 
          model_name: modelName, answer: !!answerEnabled 
      });
      
      const generatedHints: Hint[] = (data?.hints ?? []).slice(0, numHints).map((h) => ({
        hint_id: Number((h as any).id ?? (h as any).hint_id),
        hint_text: shortify((h as any)?.text ?? (h as any)?.hint_text ?? "", 160),
        colorHex: colorFromId(Number((h as any).id ?? (h as any).hint_id)), 
      }));
      setHints(generatedHints);
      setGroundTruth(shortify(coerceToPlainText(data?.answer ?? ""), 320));
      setCandidates([]); eliminationMapRef.current = {}; setElimNonce((n) => n + 1);
    } catch (e: any) {
      alert(e.message || "An error occurred during generation.");
    } finally { setIsGenerating(false); }
  };

  const onEvaluateClick = async () => {
    const q = (question || questionInput).trim();
    if (!q || !hints.length) return;
    const pending = !candidates.length ? hints : hints.filter((h) => !hasMetrics(h));
    const toEvaluate = pending.length ? pending : hints;

    setIsEvaluating(true);
    try { await evaluateHintsPartial(q, toEvaluate, groundTruth); } finally { setIsEvaluating(false); }
  };

  const evaluateHintsPartial = async (q: string, hs: Hint[], answerText: string) => {
    if (!hs.length) return metricsById;
    const payload = { 
        question: q, hints: hs.map((h) => h.hint_text), hint_ids: hs.map((h) => h.hint_id), 
        answer: answerText ?? "", temperature, max_tokens: candMaxTokens, model_name: modelName, num_candidates: candCount 
    };

    let data: EvaluationPayload;
    try { data = await api.evaluate(payload); } catch(e) { console.error(e); return metricsById; }
    
    const perHint = Array.isArray(data.metrics) ? data.metrics : [];
    const next: MetricsById = { ...metricsById };
    
    hs.forEach((h, i) => { 
        const metricList = perHint[i] || [];
        const row: Record<string, number> = {};
        for (const m of metricList) {
            const name = (m?.name ?? "").toString();
            const val = toFiniteNumber(m?.value, Number.NaN);
            if (!name) continue;
            const key = name.replace(/_/g, "-");
            row[key] = val;
        }
        if (row["answer-leakage"] !== undefined && row["leakage-avoidance"] === undefined) {
            row["leakage-avoidance"] = 1 - row["answer-leakage"];
        }
        if (Object.keys(row).length > 0) next[h.hint_id] = row;
    });
    setMetricsById(next);

    // --- INSTANT SORTING TRIGGER ---
    // 1. Force state to Convergence DESC
    setSortMetric("convergence");
    setSortDir("desc");
    
    // 2. Perform Immediate Sort locally
    const sorted = sortHintsByMetric([...hints], next, "convergence", "desc");
    setHints(sorted);

    // 3. Sync DB (This calls fullDbSync which will read the new Refs "convergence" and "desc")
    await fullDbSync(); 
    return next;
  };

  const handleRegenerateAnswer = async () => {
    if(!question) return;
    setIsRegeneratingAnswer(true);
    try {
      const data = await api.regenerateAnswer({ model_name: modelName,question: question, temperature, max_tokens: hintMaxTokens, top_p:0.9, hints: hints.map((h) => h.hint_text) });
      if(data) {
        setGroundTruth(coerceToPlainText(data.answer));
        setMetricsById({}); clearMetricsLocal();
      }
    } catch(e) { console.error(e); alert("Failed to regenerate answer"); }
    finally { setIsRegeneratingAnswer(false); }
  };

  const handleRegenerateCandidates = async () => {
    if(!question) return;
    setIsRegeneratingCandidates(true);
    try {
      await api.regenerateCandidates({
          num_candidates: candCount, model_name: modelName, temperature, max_tokens: candMaxTokens, hints: hints.map((h) => h.hint_text), top_p:0.9
      });
      await fullDbSync();
      clearMetricsLocal();
    } catch(e) { console.error(e); alert("Failed to regenerate candidates"); }
    finally { setIsRegeneratingCandidates(false); }
  };

  const handleSetGroundTruth = async (index: number) => {
    if (isBusy) return;
    try {
        await api.setCandidateAsGroundTruth(index);
        await fullDbSync(); 
    } catch (e) {
        console.error(e);
        alert("Failed to set ground truth.");
    }
  };

  const loadPresetData = async (presetKey: string) => {
    const data = PRESET_DATA[presetKey];
    if (!data) return;
    setIsGenerating(true); 
    try {
      await api.loadPreset({ data });
      await fullDbSync();
      setHintStep(0);
      setUnveiled({});
    } catch (e) { console.error("Preset Load Error", e); alert("Failed to load preset data."); } 
    finally { setIsGenerating(false); }
  };

  const confirmResetAll = async () => {
    if (isBusy) return;
    try {
      await api.resetSession();
      resetSession(); lastRunKeyRef.current = "";
    } catch (err: any) { alert(`Failed: ${err.message}`); } finally { setShowResetAllConfirm(false); }
  };

  const resetSession = (opts?: { preserveInput?: boolean }) => {
    eliminationMapRef.current = {}; setElimNonce((n) => n + 1);
    setHints([]); setMetricsById({}); setGroundTruth(""); setCandidates([]); setUnveiled({});
    setHintStep(0); setIsEvaluating(false);
    setQuestion(""); if (!opts?.preserveInput) setQuestionInput("");
    setAnswerEnabled(false); setNewCandidateText(""); setNewHintText("");
  };

  const clearMetricsLocal = () => {
    setMetricsById({});
    eliminationMapRef.current = {};
    setElimNonce((n) => n + 1);
    setUnveiled({});
  };

  const getHintColor = (hint: Hint, metrics: MetricsById) => {
    const score = metrics[hint.hint_id]?.convergence;
    let baseColor = hint.colorHex || colorFromId(hint.hint_id);
    if (score === undefined || score === null) return baseColor;

    let r = 0, g = 0, b = 0;
    if (baseColor.startsWith('#')) baseColor = baseColor.slice(1);
    if (baseColor.length === 6) {
        r = parseInt(baseColor.slice(0, 2), 16) / 255;
        g = parseInt(baseColor.slice(2, 4), 16) / 255;
        b = parseInt(baseColor.slice(4, 6), 16) / 255;
    }
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    const targetL = 30 + (score * 45); 
    const targetS = 60 + (score * 40);
    return `hsl(${Math.round(h)}, ${Math.round(targetS)}%, ${Math.round(targetL)}%)`;
  };

  const handleSortMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMetric = e.target.value as MetricKey;
    setSortMetric(newMetric);
    const sorted = sortHintsByMetric(hints, metricsById, newMetric, sortDir);
    if (!arraysEqual(hints.map((h) => h.hint_id), sorted.map((h) => h.hint_id))) setHints(sorted);
  };

  const handleSortDirChange = () => {
    const newDir = sortDir === "desc" ? "asc" : "desc";
    setSortDir(newDir);
    const sorted = sortHintsByMetric(hints, metricsById, sortMetric, newDir);
    if (!arraysEqual(hints.map((h) => h.hint_id), sorted.map((h) => h.hint_id))) setHints(sorted);
  };

  const hasMetrics = (h: Hint) => !!metricsById[h.hint_id] && Object.keys(metricsById[h.hint_id] || {}).length > 0;
  const canEvaluate = !isBusy && hints.length > 0 && (!candidates.length || hints.some(h => !hasMetrics(h)));

  const saveAnswerEdit = async () => {
    const trimmed = editedAnswerText.trim();
    if (!trimmed) return;
    setIsRegeneratingAnswer(true);
    try {
        await api.updateAnswer(trimmed);
        setGroundTruth(trimmed); setIsEditingAnswer(false); clearMetricsLocal();
    } catch (e) { console.error(e); alert("Failed to save answer."); } 
    finally { setIsRegeneratingAnswer(false); }
  };

  const deleteCandidate = (index: number) => { 
    setCandidates((prev) => prev.filter((_, i) => i !== index)); 
    Object.keys(eliminationMapRef.current).forEach((hid) => { 
        const arr = eliminationMapRef.current[hid]; 
        if (Array.isArray(arr)) eliminationMapRef.current[hid] = arr.filter((_, i) => i !== index); 
    }); 
    setElimNonce((n) => n + 1); 
    clearMetricsLocal();
    fullDbSync();
  };

  const addCandidate = async () => { 
    const v = newCandidateText.trim(); 
    if (!v || !hasServerQuestion) return; 
    await api.saveCandidate(v);
    setNewCandidateText(""); 
    clearMetricsLocal();
    await fullDbSync();
  };

  const saveManualHint = async (text: string) => { 
    const trimmed = text.trim(); 
    if (!trimmed || !hasServerQuestion) return; 
    const data = await api.saveHint(trimmed);
    setHints((prev) => [...prev, { hint_id: Number(data.hint_id), hint_text: data.hint_text, colorHex: colorFromId(Number(data.hint_id)) }]);
    clearMetricsLocal();
  };

  const handleDeleteAllHints = async () => { 
      if (isBusy || !hints.length) return; 
      await api.deleteAllHints();
      setHints([]); setMetricsById({}); setUnveiled({}); eliminationMapRef.current = {}; setElimNonce((n) => n + 1); setHintStep(0); 
  };
  
  const handleDeleteAllCandidates = async () => { 
      if (isBusy || !candidates.length) return; 
      await api.deleteAllCandidates();
      setCandidates([]); eliminationMapRef.current = {}; setElimNonce((n) => n + 1); clearMetricsLocal(); 
  };
  
  const saveHintEdit = async () => { 
    if (!editingHint) return; 
    await api.updateHint(editingHint.hint_id, editingHintText);
    setHints((prev) => prev.map((x) => x.hint_id === editingHint.hint_id ? { ...x, hint_text: editingHintText } : x)); 
    setEditingHint(null); clearMetricsLocal();
  };
  
  const confirmDeleteHint = async () => { 
    if (!pendingDeleteHint) return; 
    await api.deleteHint(pendingDeleteHint.hint_id);
    setHints((prev) => prev.filter((x) => x.hint_id !== pendingDeleteHint.hint_id)); 
    delete eliminationMapRef.current[pendingDeleteHint.hint_id]; 
    setElimNonce((n) => n + 1); setPendingDeleteHint(null); clearMetricsLocal();
  };
  
  const saveCandidateEdit = async () => { 
    if (editingCandidateIndex == null) return; 
    await api.saveCandidate(editingCandidateText, editingCandidateIndex);
    await fullDbSync();
    setEditingCandidateIndex(null); 
  };
  
  const confirmDeleteCandidate = async () => { 
    if (pendingDeleteCandidateIndex == null) return; 
    await api.deleteCandidate(pendingDeleteCandidateIndex);
    deleteCandidate(pendingDeleteCandidateIndex); 
    setPendingDeleteCandidateIndex(null); 
  };

  const onDragStart = (idx: number, h: Hint) => (e: React.DragEvent) => { if(isBusy)return; dragIndex.current=idx; e.dataTransfer.effectAllowed="copyMove"; e.dataTransfer.setData("application/json", JSON.stringify({type:"hint", id:h.hint_id})); };
  const onDragOver = (idx: number) => (e: React.DragEvent) => { if(isBusy)return; e.preventDefault(); e.dataTransfer.dropEffect="move"; };
  const onDrop = (idx: number) => (e: React.DragEvent) => { if(isBusy)return; e.preventDefault(); const from=dragIndex.current; if(from===null||from===idx)return; const next=[...hints]; const [moved]=next.splice(from,1); next.splice(idx,0,moved); setHints(next); dragIndex.current=null; };

  const renderMetricsTable = (hint: Hint) => {
    const row = metricsById[hint.hint_id] || {};
    if (!Object.keys(row).length) return null;

    const displayMetrics = [
        { key: 'convergence', label: 'Convergence', color: 'text-emerald-400', border: 'border-emerald-500/30' },
        { key: 'leakage-avoidance', label: 'Leak Avoid', color: 'text-blue-400', border: 'border-blue-500/30' },
        { key: 'familiarity', label: 'Familiarity', color: 'text-indigo-400', border: 'border-indigo-500/30' },
        { key: 'readability', label: 'Readability', color: 'text-purple-400', border: 'border-purple-500/30' },
        { key: 'relevance', label: 'Relevance', color: 'text-slate-300', border: 'border-slate-500/30' },
    ];

    return (
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {displayMetrics.map((m) => {
            let val = row[m.key] ?? row[m.key.replace(/-/g, "_")];
            if (val === undefined) return null;
            return (
                <div key={m.key} className={`bg-slate-900 border ${m.border} rounded-md px-2 py-2 flex flex-col items-center justify-center shadow-sm`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">{m.label}</span>
                    <span className={`text-sm font-mono font-bold ${m.color}`}>{val.toFixed(2)}</span>
                </div>
            )
        })}
      </div>
    );
  };

  const isEliminatedByHintIdx = (candIdx: number, hintIdx: number) => { 
      const h = hints[hintIdx]; 
      if (!hasMetrics(h)) return false;
      const arr = eliminationMapRef.current[h.hint_id]; 
      return !!(arr && arr[candIdx]); 
  };

  const isCandidateEliminated = (candIdx: number) => {
    if (!candidates.length) return false;
    if (candidates[candIdx].is_groundtruth) return false;

    if (elimMode === "sequence") { 
        for (let i = 0; i < Math.min(hintStep, hints.length); i++) if (isEliminatedByHintIdx(candIdx, i)) return true; 
    } else { 
        for (let i = 0; i < hints.length; i++) { 
            const h = hints[i]; 
            if (!unveiled[h.hint_id]) continue; 
            if (isEliminatedByHintIdx(candIdx, i)) return true; 
        } 
    }
    return false;
  };
  
  const eliminatingHintColors = (candIdx: number) => {
    if (!candidates.length) return [];
    if (candidates[candIdx].is_groundtruth) return [];

    const colors: string[] = [];
    const limit = elimMode === "sequence" ? Math.min(hintStep, hints.length) : hints.length;
    for (let i = 0; i < limit; i++) { 
        const h = hints[i]; 
        if (elimMode === "per-hint" && !unveiled[h.hint_id]) continue; 
        if (isEliminatedByHintIdx(candIdx, i)) { 
            colors.push(h.colorHex || colorFromId(i)); 
            if (elimMode === "sequence") break; 
        } 
    }
    return colors;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 pb-20">
      
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-md">
        <div className="container relative flex h-18 items-center justify-between px-6 max-w-[1900px] mx-auto py-3">
          <div className="flex items-center gap-4 z-10">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30 border border-white/10">
                <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
                <h1 className="text-xl font-black tracking-tight text-white leading-none mb-1">HintEval</h1>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest hidden sm:block">Generation & Evaluation Console</p>
            </div>
          </div>
          <div className="flex items-center gap-4 z-10">
            {groundTruth && (
                <div className="hidden xl:flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/30 text-xs font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <Target className="w-4 h-4" /> Answer Generated
                </div>
            )}
            <Button variant="outline" size="default" onClick={() => setShowResetAllConfirm(true)} disabled={isBusy} className="border-red-900/40 bg-red-950/10 text-red-400 hover:text-white hover:bg-red-600 hover:border-red-500 font-semibold transition-all">
                <RotateCcw className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Reset Session</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-[1900px] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-3 space-y-6 relative">
                {(isGenerating || isRegeneratingAnswer) && <CardOverlay text={isGenerating ? "Generating Context..." : "Regenerating Answer..."} />}
                {isEvaluating && <CardOverlay text="" minimal={true} />}
                
                <Card className={`bg-slate-900/40 border-slate-800 shadow-xl h-full flex flex-col ${(isBusy) ? 'opacity-90 pointer-events-none' : ''}`}>
                    <CardHeader className="pb-4 border-b border-white/10 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-indigo-500" /> Setup
                        </CardTitle>
                        <HelpTip content="1. Enter a question. 2. Adjust how many hints you want. 3. Click 'Generate Context' to have the AI create hints and an answer key." />
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 flex-1">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2"><span className="bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded flex items-center justify-center text-[10px] border border-indigo-500/30">1</span> Question</label>
                            <div className="relative group">
                                <textarea
                                    placeholder={mounted ? `Enter a question: e.g. ${currentSuggestion}` : "Enter a question..."}
                                    value={questionInput}
                                    onChange={(e) => setQuestionInput(e.target.value)}
                                    onKeyDown={(e) => { 
                                        if (e.key === "Tab") { 
                                            e.preventDefault(); 
                                            if (!questionInput) {
                                                const suggestion = currentSuggestion;
                                                setQuestionInput(suggestion);
                                                if (PRESET_DATA[suggestion]) loadPresetData(suggestion);
                                            } 
                                        } 
                                    }}
                                    className="flex w-full bg-slate-800 border border-slate-700 text-white text-sm h-32 align-top pt-3 px-3 shadow-inner focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500 resize-none rounded-xl"
                                    disabled={isBusy}
                                />
                                {question && <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl border border-white/5 p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">AI Model</label>
                                <div className="relative">
                                    <Bot className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <select value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={isBusy} className="w-full bg-slate-900 border border-slate-700 rounded-lg h-10 pl-10 pr-3 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer hover:border-slate-500 transition-all font-medium">
                                        {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m.split("/").pop()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-300"><span># Hint</span><span className="text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30">{numHints}</span></div>
                                <input type="range" min={1} max={10} value={numHints} onChange={(e) => setNumHints(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400" disabled={isBusy} />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button onClick={() => setAdvancedMode(!advancedMode)} className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:text-indigo-400 transition-colors ${advancedMode ? 'text-indigo-400' : 'text-slate-500'}`}>Advanced {advancedMode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                            </div>
                            {advancedMode && (
                                <div className="space-y-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-slate-400 font-medium"><span>Temperature</span><span className="text-indigo-400">{temperature}</span></div>
                                        <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" disabled={isBusy} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-slate-400 font-medium"><span>Max Tokens</span><span className="text-indigo-400">{hintMaxTokens}</span></div>
                                        <input type="range" min={64} max={1024} step={64} value={hintMaxTokens} onChange={e => setHintMaxTokens(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" disabled={isBusy} />
                                    </div>
                                </div>
                            )}
                        </div>
                      <Button 
                        onClick={doGenerate} 
                        disabled={isBusy || !questionInput.trim()} 
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-indigo-900/30 transition-all border border-white/10 text-base"
                      >
                        <Sparkles className="w-5 h-5 mr-2" /> Generate Hints and Answer
                      </Button>                        
                        {groundTruth && (
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-400 border-l-4 border-l-emerald-500 shadow-inner relative transition-all">
                            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                <div className="text-emerald-400 font-bold flex items-center gap-2 text-sm"><Target className="w-4 h-4" /> {isEditingAnswer ? "EDITING ANSWER" : "GENERATED ANSWER"}</div>
                                <div className="flex items-center gap-1">
                                    {!isEditingAnswer ? (
                                        <>
                                            <ActionTooltip text="Edit Answer">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-white hover:bg-slate-800" onClick={() => { setEditedAnswerText(groundTruth); setIsEditingAnswer(true); }} disabled={isBusy}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                            </ActionTooltip>
                                            <ActionTooltip text="Regenerate Answer">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/30" onClick={handleRegenerateAnswer} disabled={isBusy}>
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </Button>
                                            </ActionTooltip>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] hover:bg-slate-800 text-slate-400" onClick={() => setIsEditingAnswer(false)}>Cancel</Button>
                                            <Button size="sm" className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white border-0" onClick={saveAnswerEdit}>Save</Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isEditingAnswer ? (
                                <textarea value={editedAnswerText} onChange={(e) => setEditedAnswerText(e.target.value)} className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-none custom-scrollbar leading-relaxed" autoFocus />
                            ) : (
                                <p className="leading-relaxed whitespace-pre-wrap text-slate-300">{groundTruth}</p>
                            )}
                          </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-5 space-y-6 min-w-0 relative">
                {isEvaluating && <CardOverlay text="Evaluating..." />}
                {(isGenerating || isRegeneratingAnswer || isRegeneratingCandidates) && <CardOverlay text="" minimal={true} />}
                
                <Card className={`bg-slate-900/40 border-slate-800 shadow-xl h-full flex flex-col ${(isBusy) ? 'opacity-90 pointer-events-none' : ''}`}>
                    <CardHeader className="pb-4 border-b border-white/10 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-500" /> Hint Pool</CardTitle>
                        <div className="flex items-center gap-3">
                             {elimMode === "sequence" && hints.length > 0 && (
                              <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-700 mr-4 shadow-inner">
                                <button onClick={() => setHintStep(Math.max(0, hintStep - 1))} disabled={hintStep === 0} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                                <span className="text-lg font-mono font-bold text-slate-200 min-w-[4rem] text-center">{hintStep} <span className="text-slate-500">/</span> {hints.length}</span>
                                <button onClick={() => setHintStep(Math.min(hints.length, hintStep + 1))} disabled={hintStep === hints.length} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"><ArrowRight className="w-6 h-6" /></button>
                              </div>
                             )}
                             <HelpTip content="Review hints here. Drag them to reorder. Click 'Evaluate' to run metrics against the Candidates." />
                            <div className="flex bg-slate-950 rounded-lg border border-slate-700 p-1">
                                <button onClick={()=>setElimMode("per-hint")} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${elimMode==="per-hint"?"bg-slate-800 text-white shadow-sm border border-slate-600":"text-slate-500 hover:text-slate-300"}`}>Manual</button>
                                <button onClick={()=>{setElimMode("sequence");setHintStep(0)}} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${elimMode==="sequence"?"bg-slate-800 text-white shadow-sm border border-slate-600":"text-slate-500 hover:text-slate-300"}`}>Sequence</button>
                            </div>
                            <ActionTooltip text="Delete All Hints">
                                <Button variant="ghost" size="icon" onClick={handleDeleteAllHints} disabled={!hints.length} className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/50"><Trash2 className="w-4 h-4" /></Button>
                            </ActionTooltip>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 min-h-[600px]">
                        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-2">Sort By</span>
                                    <select value={sortMetric} onChange={handleSortMetricChange} className="bg-slate-800 text-xs font-bold text-white outline-none w-full cursor-pointer hover:bg-slate-700/50 transition-colors rounded">
                                        {DEFAULT_METRICS.map((k) => (<option key={k} value={k} className="bg-slate-900 text-slate-200">{k.replace(/-/g, " ")}</option>))}
                                    </select>
                                    <ActionTooltip text={`Toggle ${sortDir === "desc" ? "Ascending" : "Descending"}`}>
                                        <button onClick={handleSortDirChange} className="ml-2 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700">{sortDir === "desc" ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}</button>
                                    </ActionTooltip>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-950/60 p-2 rounded-xl border border-white/5">
                                <div className="flex flex-col px-3 border-r border-white/10 pr-4">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase mb-1">Num Candidates</span>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="1" max="20" value={candCount} onChange={(e) => setCandCount(parseInt(e.target.value))} className="w-20 h-1.5 accent-blue-500 bg-slate-700 rounded appearance-none cursor-pointer" />
                                        <span className="text-xs font-mono font-bold text-blue-400 w-5">{candCount}</span>
                                    </div>
                                </div>
                                <Button onClick={onEvaluateClick} disabled={!canEvaluate} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm h-10 font-bold shadow-md rounded-lg border border-blue-400/30"><Play className="w-4 h-4 mr-2 fill-current" /> Run Evaluation</Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0f121a]">
                            {!hints.length && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60"><Layers className="w-16 h-16 mb-4 stroke-[1]" /><p className="text-lg font-medium">Pool is empty</p><p className="text-sm">Generate hints to see them here.</p></div>
                            )}
                            {hints.map((h, idx) => {
                                const dynamicColor = getHintColor(h, metricsById);
                                const hasData = Object.keys(metricsById[h.hint_id] || {}).length > 0;
                                const isRevealed = !!unveiled[h.hint_id];
                                return (
                                    <div key={`${h.hint_id}-${idx}`} draggable={!isBusy} onDragStart={onDragStart(idx, h)} onDragEnd={() => dragIndex.current=null} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} className={`group relative bg-slate-900 border border-slate-800 hover:border-slate-500 rounded-xl transition-all duration-200 shadow-sm ${isRevealed ? 'ring-1 ring-purple-500/50 bg-slate-800' : ''}`}>
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-colors duration-500" style={{ backgroundColor: dynamicColor, boxShadow: hasData ? `0 0 10px ${dynamicColor}` : 'none' }}></div>
                                        <div className="p-4 pl-5 flex gap-4">
                                            <div className="pt-1 text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing"><GripVertical className="w-5 h-5" /></div>
                                            <div className="flex-1 space-y-3">
                                                <div className="flex justify-between items-start gap-3">
                                                    <p className="text-lg text-slate-200 leading-relaxed font-medium">{h.hint_text}</p>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {elimMode === "per-hint" && (
                                                            <button onClick={() => setUnveiled((u) => ({ ...u, [h.hint_id]: !isRevealed }))} className={`p-1.5 rounded-lg transition-all ${isRevealed ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500 hover:text-white border border-slate-700'}`} title={isRevealed ? "Hide hint" : "Reveal hint"}>
                                                                {isRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                        <button onClick={() => { setEditingHint(h); setEditingHintText(h.hint_text); }} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded bg-slate-900 border border-slate-800" title="Edit Hint"><Pencil className="w-4 h-4"/></button>
                                                        <button onClick={() => setPendingDeleteHint(h)} className="p-1.5 text-red-400 hover:text-white hover:bg-red-600 rounded bg-slate-900 border border-slate-800" title="Delete Hint"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </div>
                                                {renderMetricsTable(h)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm flex gap-3">
                            <Input placeholder="Type a manual hint here..." className="bg-slate-950 border-slate-700 focus:border-purple-500 h-11 text-sm text-white rounded-lg" value={newHintText} onChange={e => setNewHintText(e.target.value)} onKeyDown={e => { if(e.key === "Enter" && newHintText.trim()) saveManualHint(newHintText.trim()); }} disabled={!hasServerQuestion} />
                            <Button onClick={() => saveManualHint(newHintText.trim())} disabled={!newHintText.trim()} className="h-11 px-6 bg-slate-800 hover:bg-purple-700 text-purple-400 hover:text-white border border-slate-700 font-bold rounded-lg"><Plus className="w-5 h-5 mr-1" /> Add</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Candidates */}
            <div className="lg:col-span-4 space-y-6 min-w-0 relative">
                {(isEvaluating || isRegeneratingCandidates) && <CardOverlay text={isEvaluating ? "Generating Candidates..." : "Regenerating Candidates..."} />}
                {(isGenerating || isRegeneratingAnswer) && <CardOverlay text="" minimal={true} />}
                
                <Card className={`bg-slate-900/40 border-slate-800 shadow-xl h-full flex flex-col ${(isBusy) ? 'opacity-90 pointer-events-none' : ''}`}>
                    <CardHeader className="pb-4 border-b border-white/10 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2"><ListFilter className="w-5 h-5 text-emerald-500" /> Candidates</CardTitle>
                        <div className="flex items-center gap-2">
                            <HelpTip content="These are potential student answers. The system checks if your hints rule out the wrong ones (strikethrough). The GREEN check indicates the Ground Truth. Click the target icon on other candidates to swap them as the new Ground Truth." />
                            <ActionTooltip text="Regenerate All Candidates">
                                <Button variant="ghost" size="icon" onClick={handleRegenerateCandidates} disabled={!groundTruth || isBusy} className="h-8 w-8 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/50"><RefreshCw className="w-4 h-4" /></Button>
                            </ActionTooltip>
                            <ActionTooltip text="Delete All Candidates"><Button variant="ghost" size="icon" onClick={handleDeleteAllCandidates} disabled={!candidates.length} className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/50"><Trash2 className="w-4 h-4" /></Button></ActionTooltip>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 min-h-[600px]">
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#0f121a]">
                            {!candidates.length && (<div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60"><Target className="w-16 h-16 mb-4 stroke-[1]" /><p className="text-lg font-medium">No candidates</p><p className="text-sm">Run evaluation to generate them.</p></div>)}
                            {candidates.map((c, i) => {
                                const isEliminated = isCandidateEliminated(i);
                                const eliminatingColors = eliminatingHintColors(i);
                                const isGT = c.is_groundtruth;

                                return (
                                    <div key={i} className={`group relative pl-4 pr-3 py-3 rounded-lg transition-all overflow-hidden flex items-center justify-between border ${isGT ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {/* Swap Ground Truth Button */}
                                            <button 
                                                onClick={() => !isGT && handleSetGroundTruth(i)} 
                                                disabled={isGT || isBusy}
                                                className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${isGT ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-600 hover:text-emerald-400 hover:bg-slate-800'}`}
                                                title={isGT ? "Current Ground Truth" : "Set as Ground Truth"}
                                            >
                                                {isGT ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                            </button>

                                            <span className={`text-sm truncate transition-all font-medium ${isEliminated ? 'text-slate-500 opacity-60 decoration-slate-600 line-through' : (isGT ? 'text-emerald-100' : 'text-slate-200')}`}>
                                                {c.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 pl-2">
                                            {eliminatingColors.map((hex, k) => (
                                                <X key={k} className="w-4 h-4" style={{ color: hex, strokeWidth: 4 }} />
                                            ))}
                                        </div>
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900 shadow-xl px-2 py-1 rounded-l-md border-l border-slate-700">
                                          <button onClick={() => { setEditingCandidateIndex(i); setEditingCandidateText(c.text); }} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                                          <button onClick={() => setPendingDeleteCandidateIndex(i)} className="p-1.5 text-red-400 hover:text-white hover:bg-red-600 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm flex gap-3">
                            <Input placeholder="Add custom answer..." className="bg-slate-950 border-slate-700 focus:border-emerald-500 h-11 text-sm text-white rounded-lg" value={newCandidateText} onChange={e => setNewCandidateText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void addCandidate(); }} disabled={!hasServerQuestion} />
                            <Button onClick={addCandidate} disabled={!newCandidateText.trim()} className="h-11 px-6 bg-slate-800 hover:bg-emerald-700 text-emerald-400 hover:text-white border border-slate-700 font-bold rounded-lg"><Plus className="w-5 h-5 mr-1" /> Add</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </main>

      {/* --- MODALS --- */}
      {(pendingDeleteHint || pendingDeleteCandidateIndex !== null || showResetAllConfirm) && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-red-900/50 p-8 rounded-2xl w-full max-w-md space-y-6 shadow-2xl">
                <div className="flex items-center gap-4 text-red-400 border-b border-red-900/20 pb-4">
                    <div className="p-3 bg-red-950/50 rounded-full border border-red-900/50"><Trash2 className="w-8 h-8" /></div>
                    <h3 className="text-2xl font-bold text-white">Confirm Delete</h3>
                </div>
                <p className="text-slate-300 text-base leading-relaxed">
                    {pendingDeleteHint ? "Are you sure you want to permanently delete this hint and all its associated metrics?" : 
                     pendingDeleteCandidateIndex !== null ? "Are you sure you want to remove this candidate answer?" : 
                     "Warning: This will wipe your entire session, including the question, hints, and results."}
                </p>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={() => { setPendingDeleteHint(null); setPendingDeleteCandidateIndex(null); setShowResetAllConfirm(false); }} className="hover:bg-slate-800 text-slate-300 h-11 px-4">Cancel</Button>
                    <Button variant="destructive" onClick={() => {
                        if (pendingDeleteHint) confirmDeleteHint();
                        else if (pendingDeleteCandidateIndex !== null) confirmDeleteCandidate();
                        else confirmResetAll();
                    }} className="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20 h-11 px-6 font-bold">Confirm</Button>
                </div>
            </div>
        </div>
      )}

      {editingHint && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-slate-600 p-6 rounded-2xl w-full max-w-lg space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h3 className="text-xl font-bold text-white">Edit Hint</h3>
                    <button onClick={() => setEditingHint(null)} className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-full hover:bg-slate-700"><X className="w-5 h-5"/></button>
                </div>
                <textarea className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 text-base focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed" value={editingHintText} onChange={e => setEditingHintText(e.target.value)} />
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setEditingHint(null)} className="hover:bg-slate-800 text-slate-300">Cancel</Button>
                    <Button onClick={saveHintEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6">Save Changes</Button>
                </div>
            </div>
        </div>
      )}

      {editingCandidateIndex !== null && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-slate-600 p-6 rounded-2xl w-full max-w-lg space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h3 className="text-xl font-bold text-white">Edit Candidate</h3>
                    <button onClick={() => setEditingCandidateIndex(null)} className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-full hover:bg-slate-700"><X className="w-5 h-5"/></button>
                </div>
                <Input className="bg-slate-950 border-slate-700 text-white h-12 text-base" value={editingCandidateText} onChange={e => setEditingCandidateText(e.target.value)} />
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setEditingCandidateIndex(null)} className="hover:bg-slate-800 text-slate-300">Cancel</Button>
                    <Button onClick={saveCandidateEdit} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6">Save Changes</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}