"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// Icons
import {
  Plus, Trash2, GripVertical, SortAsc, SortDesc, Bot, RotateCcw, Pencil, X,
  Sparkles, Layers, Target, Settings2, Eye, EyeOff, ListFilter, Play,
  ChevronDown, ChevronUp, HelpCircle, Lightbulb, RefreshCw, ArrowLeft, ArrowRight,
  CheckCircle2, Keyboard, Loader2
} from "lucide-react";
// Types & Utils
import {
  Hint, MetricKey, MetricsById, EvaluationPayload, GenerateResponse, ElimMode
} from "@/app/generation_and_evaluation/types";
import {
  DEFAULT_METRICS, EXAMPLE_QUESTIONS, shortify, arraysEqual, toFiniteNumber,
  coerceToPlainText, shuffledRange, colorFromId
} from "@/app/generation_and_evaluation/utils";
import { api, sortHintsByMetric } from "@/app/generation_and_evaluation/functions";
import { PRESET_DATA } from "@/app/generation_and_evaluation/presets";

// --- TYPES ---
interface Candidate {
  id: number;
  text: string;
  is_groundtruth: boolean;
}

// --- CONSTANTS ---
const STORAGE_KEY = "hinteval_session_v4";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_HINTEVAL_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const MODEL_OPTIONS = [
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "Qwen/Qwen3-Next-80B-A3B-Instruct",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "moonshotai/Kimi-K2-Instruct-0905",
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"
];

// --- HELPER COMPONENTS ---

// CardOverlay with Emergency Dismiss
// Added rounded-xl to match card corners since we removed overflow-hidden from parent
const CardOverlay = ({ 
    text, 
    subText = "Please wait...", 
    minimal = false, 
    onDismiss 
}: { 
    text: string; 
    subText?: string;
    minimal?: boolean; 
    onDismiss?: () => void;
}) => (
  <div className="absolute inset-0 z-[60] bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300 border border-border/50">
    <div className={`flex flex-col items-center ${minimal ? 'scale-75' : ''} text-center p-6 max-w-[90%]`}>
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-md animate-pulse"></div>
        <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
      </div>
      
      {text && (
        <p className="text-sm font-bold text-foreground tracking-tight mb-1 animate-in slide-in-from-bottom-2">
          {text}
        </p>
      )}

      {!minimal && subText && (
        <p className="text-xs text-muted-foreground font-medium mb-4 animate-in slide-in-from-bottom-3 delay-75">
          {subText}
        </p>
      )}

      {onDismiss && (
        <button 
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="mt-4 px-3 py-1 bg-background/50 border border-destructive/30 rounded-full text-[10px] text-destructive hover:bg-destructive hover:text-white font-semibold cursor-pointer transition-all"
        >
            Stop / Unfreeze UI
        </button>
      )}
    </div>
  </div>
);

// Updated HelpTip: Uses Fixed positioning on Mobile (Modal style) and Absolute on Desktop
const HelpTip = ({ title, children, variant = "indigo" }: { title: string, children: React.ReactNode, variant?: "indigo" | "purple" | "emerald" }) => {
  const [open, setOpen] = useState(false);
  const themes = {
    indigo: { icon: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", title: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-500/10 dark:bg-indigo-950/20" },
    purple: { icon: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", title: "text-purple-700 dark:text-purple-300", bg: "bg-purple-500/10 dark:bg-purple-950/20" },
    emerald: { icon: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", title: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10 dark:bg-emerald-950/20" },
  };
  const theme = themes[variant];

  return (
    <>
      <button 
        onClick={() => setOpen(!open)} 
        className={`relative z-10 transition-colors p-1 hover:bg-accent rounded-full ${open ? theme.icon : 'text-muted-foreground hover:text-foreground'}`} 
        title="More Info"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <>
          {/* Backdrop for mobile closing */}
          <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none" onClick={() => setOpen(false)} />
          
          {/* Content Container */}
          <div className={`
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm z-[100]
            sm:absolute sm:left-auto sm:top-9 sm:right-[-10px] sm:w-80 sm:translate-x-0 sm:translate-y-0
            p-0 bg-popover border ${theme.border} rounded-xl shadow-2xl shadow-black/20 
            animate-in fade-in zoom-in-95 sm:slide-in-from-top-2 overflow-hidden
          `}>
            <div className={`px-4 py-3 border-b border-border ${theme.bg} flex items-center gap-2 font-bold ${theme.title}`}>
              <Lightbulb className="w-4 h-4" /> {title}
            </div>
            {/* Ensuring text is strictly foreground with solid background */}
            <div className="p-4 text-xs leading-relaxed text-popover-foreground space-y-3 bg-popover">
              {children}
            </div>
          </div>
        </>
      )}
    </>
  )
};

// Updated Tooltip: Supports alignment to prevent overflow
const ActionTooltip = ({ 
  text, 
  children, 
  align = "center" 
}: { 
  text: string, 
  children: React.ReactNode, 
  align?: "center" | "left" | "right" 
}) => {
  let positionClass = "left-1/2 -translate-x-1/2"; // default center
  let arrowClass = "left-1/2 -translate-x-1/2";

  if (align === "right") {
    positionClass = "right-0 translate-x-0";
    arrowClass = "right-3 translate-x-0";
  } else if (align === "left") {
    positionClass = "left-0 translate-x-0";
    arrowClass = "left-3 translate-x-0";
  }

  return (
    <div className="group relative flex items-center justify-center">
      {children}
      <div className={`absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-popover text-popover-foreground text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border border-border shadow-xl z-[70] pointer-events-none animate-in fade-in zoom-in-95 duration-200 ${positionClass}`}>
        {text}
        <div className={`absolute top-full border-4 border-transparent border-t-popover ${arrowClass}`}></div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---

export default function HintEvalApp() {
  // --- STATE MANAGEMENT ---
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionOrder, setSuggestionOrder] = useState<number[]>([]);

  // Data State
  const [question, setQuestion] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [metricsById, setMetricsById] = useState<MetricsById>({});
  
  // UI/Interaction State
  const [unveiled, setUnveiled] = useState<Record<string | number, boolean>>({});
  const eliminationMapRef = useRef<Record<string | number, boolean[]>>({});
  const [elimNonce, setElimNonce] = useState(0); 
  const [hintStep, setHintStep] = useState(0);
  const [sortMetric, setSortMetric] = useState<MetricKey>("convergence");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc"); 

  // Config State
  const [modelName, setModelName] = useState<string>(DEFAULT_MODEL);
  const [numHints, setNumHints] = useState(5);
  const [temperature, setTemperature] = useState(0.3);
  const [hintMaxTokens, setHintMaxTokens] = useState(512);
  const [candCount, setCandCount] = useState(11);
  const [candMaxTokens, setCandMaxTokens] = useState(256);
  const [answerEnabled, setAnswerEnabled] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [elimMode, setElimMode] = useState<ElimMode>("per-hint");

  // Loading Flags
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRegeneratingAnswer, setIsRegeneratingAnswer] = useState(false);
  const [isRegeneratingCandidates, setIsRegeneratingCandidates] = useState(false);
  
  const isBusy = isGenerating || isEvaluating || isRegeneratingAnswer || isRegeneratingCandidates;

  // Editing State
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
  
  // Refs
  const lastRunKeyRef = useRef<string>("");
  const dragIndex = useRef<number | null>(null);
  const sortMetricRef = useRef(sortMetric);
  const sortDirRef = useRef(sortDir);

  const hasServerQuestion = !!question.trim();
  const currentSuggestion = useMemo(() => {
    if (!mounted || !suggestionOrder.length) return "";
    return EXAMPLE_QUESTIONS[suggestionOrder[suggestionIdx] ?? 0];
  }, [mounted, suggestionOrder, suggestionIdx]);

  useEffect(() => { sortMetricRef.current = sortMetric; }, [sortMetric]);
  useEffect(() => { sortDirRef.current = sortDir; }, [sortDir]);

  useEffect(() => {
    setMounted(true);
    setSuggestionOrder(shuffledRange(EXAMPLE_QUESTIONS.length));
    const interval = setInterval(() => {
      setSuggestionIdx((prev) => (prev + 1) % EXAMPLE_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Initialize
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

        if (localState && localState.question === (sessionData.question || "")) {
           applyLocalState(localState);
        } else {
           // Small delay to prevent hydration race conditions
           setTimeout(() => fullDbSync(sessionData), 50);
        }
      } catch (e) { console.error("Init failed:", e); } 
      finally { setHydrated(true); }
    };
    initialize();
  }, [mounted]);

  // Persist State
  useEffect(() => {
    if (!mounted || !hydrated) return;
    try {
      const payload = {
        question, questionInput, groundTruth, hints, candidates, metricsById,
        eliminationMap: eliminationMapRef.current, unveiled, hintStep,
        sortMetric, sortDir, answerEnabled, numHints, temperature, hintMaxTokens,
        candCount, candMaxTokens, modelName,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { console.error(e); }
  }, [mounted, hydrated, question, questionInput, groundTruth, hints, candidates, metricsById, unveiled, hintStep, sortMetric, sortDir, answerEnabled, numHints, temperature, hintMaxTokens, candCount, candMaxTokens, modelName, elimNonce]);

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
      setSortDir(saved.sortDir ?? "asc");
      setAnswerEnabled(saved.answerEnabled ?? false);
      setNumHints(saved.numHints ?? 5);
      setTemperature(saved.temperature ?? 0.3);
      setHintMaxTokens(saved.hintMaxTokens ?? 512);
      setCandCount(saved.candCount ?? 11);
      setCandMaxTokens(saved.candMaxTokens ?? 256);
      setModelName(saved.modelName ?? DEFAULT_MODEL);
  };

  const fullDbSync = async (preloadedSessionData?: any) => {
    try {
      let data = preloadedSessionData || await api.getSessionState();
      if (data && data.question) {
         setQuestion(data.question);
         setQuestionInput(data.question);
         setGroundTruth(data.answer || "");

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

         const hData = await api.getHints();
         if (hData) {
           let loadedHints: Hint[] = (hData.hints || []).map((h: any) => {
             const safeId = Number(h.id ?? h.hint_id);
             return { hint_id: safeId, hint_text: h.hint_text, colorHex: colorFromId(safeId) };
           });
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

  // --- SAFE ASYNC HANDLER ---
  const safeAsyncOp = async (
    setLoading: (v: boolean) => void,
    operation: () => Promise<void>,
    errorMessage: string
  ) => {
    setLoading(true);
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Operation timed out")), 60000)
        );
        await Promise.race([operation(), timeoutPromise]);
    } catch (e: any) {
        console.error(errorMessage, e);
        alert(e.message || errorMessage);
    } finally {
        setLoading(false);
    }
  };

  const doGenerate = async () => {
    const q = questionInput.trim();
    if (!q) { alert("Please enter a question."); return; }
    
    await safeAsyncOp(setIsGenerating, async () => {
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
    }, "Generation failed");
  };

  const onEvaluateClick = async () => {
    const q = (question || questionInput).trim();
    if (!q || !hints.length) return;
    const pending = !candidates.length ? hints : hints.filter((h) => !hasMetrics(h));
    const toEvaluate = pending.length ? pending : hints;

    await evaluateHintsPartial(q, toEvaluate, groundTruth);
  };

  // [UPDATED] Evaluation with DEFERRED DB Sync
  const evaluateHintsPartial = async (q: string, hs: Hint[], answerText: string) => {
    if (!hs.length) return metricsById;
    
    setIsEvaluating(true); 

    try {
        const payload = { 
            question: q, hints: hs.map((h) => h.hint_text), hint_ids: hs.map((h) => h.hint_id), 
            answer: answerText ?? "", temperature, max_tokens: candMaxTokens, model_name: modelName, num_candidates: candCount 
        };

        let data: EvaluationPayload;
        try { 
            data = await api.evaluate(payload); 
        } catch(e) { 
            console.error("Evaluation API failed", e); 
            alert("Evaluation failed. Please check your backend.");
            setIsEvaluating(false); 
            return metricsById; 
        }
        
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
        setUnveiled(prev => {
            const nextState = { ...prev };
            hs.forEach(h => nextState[h.hint_id] = true);
            return nextState;
        });
        setSortMetric("convergence");
        setSortDir("asc");
        
        const sorted = sortHintsByMetric([...hints], next, "convergence", "asc");
        setHints(sorted);
        
        // 3. UNLOCK UI FIRST - CRITICAL
        setIsEvaluating(false);

        // 4. Defer DB Sync
        setTimeout(() => {
            fullDbSync().catch(console.error);
        }, 500);
        
        return next;

    } catch (criticalError) {
        console.error("Critical error in evaluation flow:", criticalError);
        setIsEvaluating(false); 
    }
  };

  const handleRegenerateAnswer = async () => {
    if(!question) return;
    await safeAsyncOp(setIsRegeneratingAnswer, async () => {
        const data = await api.regenerateAnswer({ model_name: modelName,question: question, temperature, max_tokens: hintMaxTokens, top_p:0.9, hints: hints.map((h) => h.hint_text) });
        if(data) {
            setGroundTruth(coerceToPlainText(data.answer));
            setMetricsById({}); clearMetricsLocal();
        }
    }, "Answer regeneration failed");
  };

  const handleRegenerateCandidates = async () => {
    if(!question) return;
    setIsRegeneratingCandidates(true);
    try {
      await api.regenerateCandidates({
          num_candidates: candCount, model_name: modelName, temperature, max_tokens: candMaxTokens, hints: hints.map((h) => h.hint_text), top_p:0.9
      });
      setIsRegeneratingCandidates(false); // Unlock UI first
      clearMetricsLocal();
      
      setTimeout(() => {
          fullDbSync().catch(console.error);
      }, 500);

    } catch(e: any) { 
        console.error(e); 
        alert("Failed to regenerate candidates: " + e.message); 
        setIsRegeneratingCandidates(false);
    }
  };

  const handleSetGroundTruth = async (index: number) => {
    if (isBusy) return;
    try {
        await api.setCandidateAsGroundTruth(index);
        await fullDbSync(); 
    } catch (e) { console.error(e); alert("Failed to set ground truth."); }
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

  // --- UTILITY FUNCTIONS ---

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
    let h = 0;
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
    await safeAsyncOp(setIsRegeneratingAnswer, async () => {
        await api.updateAnswer(trimmed);
        setGroundTruth(trimmed); setIsEditingAnswer(false); clearMetricsLocal();
    }, "Failed to save answer");
  };

  const deleteCandidate = (index: number) => { 
    setCandidates((prev) => prev.filter((_, i) => i !== index)); 
    Object.keys(eliminationMapRef.current).forEach((hid) => { 
        const arr = eliminationMapRef.current[hid]; 
        if (Array.isArray(arr)) eliminationMapRef.current[hid] = arr.filter((_, i) => i !== index); 
    }); 
    setElimNonce((n) => n + 1); 
    clearMetricsLocal();
    setTimeout(() => fullDbSync(), 500);
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
        { key: 'convergence', label: 'Convergence', color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
        { key: 'leakage-avoidance', label: 'Leak Avoid', color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
        { key: 'familiarity', label: 'Familiarity', color: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
        { key: 'readability', label: 'Readability', color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
        { key: 'relevance', label: 'Relevance', color: 'text-muted-foreground', border: 'border-border' },
    ];

    return (
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {displayMetrics.map((m) => {
            let val = row[m.key] ?? row[m.key.replace(/-/g, "_")];
            if (val === undefined) return null;

            if (m.key === 'readability') {
                const rVal = Math.round(val);
                let label = "UNKNOWN";
                if (rVal === 0) label = "BEGINNER";
                else if (rVal === 1) label = "INTERMEDIATE";
                else if (rVal === 2) label = "ADVANCED";

                return (
                    <div key={m.key} className={`bg-background border ${m.border} rounded-md px-2 py-2 flex flex-col items-center justify-center shadow-sm`}>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">{m.label}</span>
                        <span className={`text-[10px] font-bold tracking-wider ${m.color}`}>{label}</span>
                    </div>
                );
            }

            return (
                <div key={m.key} className={`bg-background border ${m.border} rounded-md px-2 py-2 flex flex-col items-center justify-center shadow-sm`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">{m.label}</span>
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
  
  // Refactored helper to render a single hint card, allowing flexible list splitting
  const renderHintItem = (h: Hint, idx: number) => {
    const dynamicColor = getHintColor(h, metricsById);
    const hasData = Object.keys(metricsById[h.hint_id] || {}).length > 0;
    const isRevealed = !!unveiled[h.hint_id];
    
    // In manual mode, show border if revealed. In sequence mode, the outer frame handles the active look.
    const showBorder = elimMode === "per-hint" && isRevealed;

    return (
        <div key={`${h.hint_id}-${idx}`} draggable={!isBusy} onDragStart={onDragStart(idx, h)} onDragEnd={() => dragIndex.current=null} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} 
            className={`group relative border rounded-xl transition-all duration-300 shadow-sm 
                ${showBorder 
                    ? 'border-primary ring-1 ring-primary/50 bg-card shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                    : 'bg-card border-border hover:border-muted-foreground'
                }`}
        >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-colors duration-500" style={{ backgroundColor: dynamicColor, boxShadow: hasData ? `0 0 10px ${dynamicColor}` : 'none' }}></div>
            <div className="p-4 pl-5 flex gap-4">
                <div className="pt-1 text-muted-foreground group-hover:text-foreground cursor-grab active:cursor-grabbing"><GripVertical className="w-5 h-5" /></div>
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start gap-3">
                        <p className="text-lg text-foreground leading-relaxed font-medium">{h.hint_text}</p>
                        <div className="flex items-center gap-1 shrink-0">
                            {elimMode === "per-hint" && (
                                <button onClick={() => setUnveiled((u) => ({ ...u, [h.hint_id]: !isRevealed }))} className={`p-1.5 rounded-lg transition-all ${isRevealed ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300' : 'bg-muted text-muted-foreground hover:text-foreground border border-border'}`} title={isRevealed ? "Hide hint" : "Reveal hint"}>
                                    {isRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            )}
                            <button onClick={() => { setEditingHint(h); setEditingHintText(h.hint_text); }} className="p-1.5 text-blue-500 dark:text-blue-400 hover:text-white hover:bg-blue-600 rounded bg-muted border border-border" title="Edit Hint"><Pencil className="w-4 h-4"/></button>
                            <button onClick={() => setPendingDeleteHint(h)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-white hover:bg-red-600 rounded bg-muted border border-border" title="Delete Hint"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    </div>
                    {renderMetricsTable(h)}
                </div>
            </div>
        </div>
    );
  };

  // Determine global loading state text
  const loadingState = useMemo(() => {
    if (isGenerating) return { text: "Generating...", subText: "Creating hints & answers" };
    if (isEvaluating) return { text: "Evaluating...", subText: "Calculating metrics" };
    if (isRegeneratingAnswer) return { text: "Regenerating...", subText: "Updating answer" };
    if (isRegeneratingCandidates) return { text: "Regenerating...", subText: "Refreshing candidates" };
    return null;
  }, [isGenerating, isEvaluating, isRegeneratingAnswer, isRegeneratingCandidates]);

  const handleGlobalDismiss = () => {
    setIsGenerating(false);
    setIsEvaluating(false);
    setIsRegeneratingAnswer(false);
    setIsRegeneratingCandidates(false);
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 pb-20">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-xl shadow-md">
        <div className="container relative flex h-18 items-center justify-between px-6 max-w-[1900px] mx-auto py-3">
          <div className="flex items-center gap-4 z-10">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30 border border-white/10">
                <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
                <h1 className="text-xl font-black tracking-tight text-foreground leading-none mb-1">HintEval</h1>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest hidden sm:block">Generation & Evaluation Console</p>
            </div>
          </div>
          <div className="flex items-center gap-4 z-10">
            {groundTruth && (
                <div className="hidden xl:flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <Target className="w-4 h-4" /> Answer Generated
                </div>
            )}
            <Button variant="outline" size="default" onClick={() => setShowResetAllConfirm(true)} disabled={isBusy} className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 hover:border-red-500 font-semibold transition-all">
                <RotateCcw className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Reset Session</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-[1900px] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* --- SECTION: SETUP CARD --- */}
            <div className="lg:col-span-3 space-y-6 relative">
                
                {/* Removed overflow-hidden from Card to allow tooltips to spill out */}
                <Card className={`bg-card border-border shadow-xl h-full flex flex-col relative`}>
                    
                    {/* GLOBAL LOCK OVERLAY */}
                    {isBusy && loadingState && (
                        <CardOverlay 
                            text={loadingState.text} 
                            subText={loadingState.subText}
                            onDismiss={handleGlobalDismiss}
                        />
                    )}

                    <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-card-foreground flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-primary" /> Setup
                        </CardTitle>
                        <HelpTip title="Workflow Setup" variant="indigo">
                          <div className="space-y-3">
                              <div className="flex gap-3">
                                  <span className="font-bold text-primary-foreground bg-primary w-5 h-5 flex items-center justify-center rounded text-[10px]">1</span>
                                  <div>
                                      <strong className="text-foreground block mb-1">Input Question</strong>
                                      <span className="text-foreground">Type a trivia question or press <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[10px] text-muted-foreground">TAB</kbd> to auto-fill a demo example.</span>
                                  </div>
                              </div>
                              <div className="flex gap-3">
                                  <span className="font-bold text-primary-foreground bg-primary w-5 h-5 flex items-center justify-center rounded text-[10px]">2</span>
                                  <div>
                                      <strong className="text-foreground block mb-1">Configuration</strong>
                                      <span className="text-foreground">Select your LLM and the number of hints (default: 5). Use "Advanced" to tweak creativity (Temperature).</span>
                                  </div>
                              </div>
                              <div className="flex gap-3">
                                  <span className="font-bold text-primary-foreground bg-primary w-5 h-5 flex items-center justify-center rounded text-[10px]">3</span>
                                  <div>
                                      <strong className="text-foreground block mb-1">Generate</strong>
                                      <span className="text-foreground">Click the button to create the hints and the ground truth answer.</span>
                                  </div>
                              </div>
                          </div>
                      </HelpTip>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 flex-1">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-2"><span className="bg-primary/20 text-primary w-5 h-5 rounded flex items-center justify-center text-[10px] border border-primary/30">1</span> Question</span>
                              {mounted && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-1 animate-pulse"><Keyboard className="w-3 h-3" /> Press Tab to insert example</span>
                              )}
                            </label>
                            <div className="relative group">
                                <textarea
                                    placeholder={mounted ? `Enter a question, or press TAB to use: "${currentSuggestion}"` : "Enter a question..."}
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
                                    className="flex w-full bg-muted border border-input text-foreground text-sm h-32 align-top pt-3 px-3 shadow-inner focus:ring-2 focus:ring-primary focus:outline-none transition-all placeholder:text-muted-foreground resize-none rounded-xl"
                                    disabled={isBusy}
                                />
                                {question && <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}
                            </div>
                            {mounted && !questionInput && (
                              <div className="text-[10px] text-muted-foreground italic text-center pt-1">
                                Rotating Example: <span className="text-primary font-medium">{shortify(currentSuggestion, 60)}</span>
                              </div>
                            )}
                        </div>
                        <div className="bg-muted/50 rounded-xl border border-border p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">AI Model</label>
                                <div className="relative">
                                    <Bot className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                    <select value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={isBusy} className="w-full bg-background border border-input rounded-lg h-10 pl-10 pr-3 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer hover:border-primary/50 transition-all font-medium">
                                        {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m.split("/").pop()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-muted-foreground"><span># Hint</span><span className="text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">{numHints}</span></div>
                                <input type="range" min={1} max={10} value={numHints} onChange={(e) => setNumHints(parseInt(e.target.value))} className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary" disabled={isBusy} />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button onClick={() => setAdvancedMode(!advancedMode)} className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:text-primary transition-colors ${advancedMode ? 'text-primary' : 'text-muted-foreground'}`}>Advanced {advancedMode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                            </div>
                            {advancedMode && (
                                <div className="space-y-4 pt-4 border-t border-border animate-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>Temperature</span><span className="text-primary">{temperature}</span></div>
                                        <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary" disabled={isBusy} />
                                        <p className="text-[9px] text-muted-foreground leading-tight">Controls randomness. 0 is deterministic, 1 is highly creative/random.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>Max Tokens</span><span className="text-primary">{hintMaxTokens}</span></div>
                                        <input type="range" min={64} max={1024} step={64} value={hintMaxTokens} onChange={e => setHintMaxTokens(Number(e.target.value))} className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary" disabled={isBusy} />
                                        <p className="text-[9px] text-muted-foreground leading-tight">Maximum length of the LLM response. The output will be truncated if it exceeds this limit.</p>
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
                          <div className="bg-muted border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground border-l-4 border-l-emerald-500 shadow-inner relative transition-all">
                            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2 text-sm"><Target className="w-4 h-4" /> {isEditingAnswer ? "EDITING ANSWER" : "GENERATED ANSWER"}</div>
                                <div className="flex items-center gap-1">
                                    {!isEditingAnswer ? (
                                        <>
                                            <ActionTooltip text="Edit Answer" align="right">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background" onClick={() => { setEditedAnswerText(groundTruth); setIsEditingAnswer(true); }} disabled={isBusy}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                            </ActionTooltip>
                                            <ActionTooltip text="Regenerate Answer" align="right">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10" onClick={handleRegenerateAnswer} disabled={isBusy}>
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </Button>
                                            </ActionTooltip>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] hover:bg-background text-muted-foreground" onClick={() => setIsEditingAnswer(false)}>Cancel</Button>
                                            <Button size="sm" className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white border-0" onClick={saveAnswerEdit}>Save</Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isEditingAnswer ? (
                                <textarea value={editedAnswerText} onChange={(e) => setEditedAnswerText(e.target.value)} className="w-full h-32 bg-background border border-input rounded p-2 text-foreground focus:outline-none focus:border-emerald-500/50 resize-none custom-scrollbar leading-relaxed" autoFocus />
                            ) : (
                                <p className="leading-relaxed whitespace-pre-wrap text-foreground">{groundTruth}</p>
                            )}
                          </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* --- SECTION: HINT POOL --- */}
            <div className="lg:col-span-5 space-y-6 min-w-0 relative">
                
                {/* Removed overflow-hidden */}
                <Card className={`bg-card border-border shadow-xl h-full flex flex-col relative`}>
                    
                    {/* GLOBAL LOCK OVERLAY */}
                    {isBusy && loadingState && (
                        <CardOverlay 
                            text={loadingState.text} 
                            subText={loadingState.subText}
                            minimal={true}
                            onDismiss={handleGlobalDismiss}
                        />
                    )}

                    <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-card-foreground flex items-center gap-2"><Layers className="w-5 h-5 text-purple-600 dark:text-purple-500" /> Hint Pool</CardTitle>
                        <div className="flex items-center gap-3">
                             {elimMode === "sequence" && hints.length > 0 && (
                              <div className="flex items-center gap-4 bg-muted px-4 py-2 rounded-xl border border-border mr-4 shadow-inner">
                                <button onClick={() => setHintStep(Math.max(0, hintStep - 1))} disabled={hintStep === 0} className="p-2 hover:bg-background rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                                <span className="text-lg font-mono font-bold text-foreground min-w-[4rem] text-center">{hintStep} <span className="text-muted-foreground">/</span> {hints.length}</span>
                                <button onClick={() => setHintStep(Math.min(hints.length, hintStep + 1))} disabled={hintStep === hints.length} className="p-2 hover:bg-background rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"><ArrowRight className="w-6 h-6" /></button>
                              </div>
                             )}
                            <HelpTip title="Managing Hints" variant="purple">
                                <ul className="space-y-3 marker:text-purple-500 list-disc pl-4">
                                    <li>
                                        <strong className="text-purple-700 dark:text-purple-200">Drag & Drop:</strong><br/>
                                        <span className="text-foreground">Grab the handle <GripVertical className="w-3 h-3 inline text-muted-foreground"/> on any hint to reorder the sequence.</span>
                                    </li>
                                    <li>
                                        <strong className="text-purple-700 dark:text-purple-200">Evaluation:</strong><br/>
                                        <span className="text-foreground">Click <span className="text-white bg-blue-600 px-1 py-0.5 rounded text-[10px]">Run Evaluation</span> to calculate metrics like <em>Convergence</em> (how helpful a hint is) and <em>Leakage</em> (if it gives the answer away).</span>
                                    </li>
                                    <li>
                                        <strong className="text-purple-700 dark:text-purple-200">View Modes:</strong><br/>
                                        <span className="text-foreground">Use <strong>Manual</strong> to reveal hints one-by-one, or <strong>Sequence</strong> to simulate a step-by-step student experience.</span>
                                    </li>
                                </ul>
                            </HelpTip>
                            <div className="flex bg-muted rounded-lg border border-border p-1">
                                <button onClick={()=>setElimMode("per-hint")} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${elimMode==="per-hint"?"bg-background text-foreground shadow-sm border border-border":"text-muted-foreground hover:text-foreground"}`}>Manual</button>
                                <button onClick={()=>{setElimMode("sequence");setHintStep(0)}} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${elimMode==="sequence"?"bg-background text-foreground shadow-sm border border-border":"text-muted-foreground hover:text-foreground"}`}>Sequence</button>
                            </div>
                            <ActionTooltip text="Delete All Hints" align="right">
                                <Button variant="ghost" size="icon" onClick={handleDeleteAllHints} disabled={!hints.length} className="h-8 w-8 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                            </ActionTooltip>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 min-h-[600px]">
                        <div className="p-4 bg-muted/30 border-b border-border flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center bg-background px-3 py-1.5 rounded-lg border border-border flex-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase mr-2">Sort By</span>
                                    <select value={sortMetric} onChange={handleSortMetricChange} className="bg-background text-xs font-bold text-foreground outline-none w-full cursor-pointer hover:bg-muted transition-colors rounded">
                                        {DEFAULT_METRICS.map((k) => (<option key={k} value={k} className="bg-background text-foreground">{k.replace(/-/g, " ")}</option>))}
                                    </select>
                                    <ActionTooltip text={`Toggle ${sortDir === "desc" ? "Ascending" : "Descending"}`} align="right">
                                        <button onClick={handleSortDirChange} className="ml-2 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">{sortDir === "desc" ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}</button>
                                    </ActionTooltip>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-muted/60 p-2 rounded-xl border border-border">
                                <div className="flex flex-col px-3 border-r border-border pr-4">
                                    <span className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Num Candidates</span>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="1" max="20" value={candCount} onChange={(e) => setCandCount(parseInt(e.target.value))} className="w-20 h-1.5 accent-blue-500 bg-background rounded appearance-none cursor-pointer" />
                                        <span className="text-xs font-mono font-bold text-blue-500 dark:text-blue-400 w-5">{candCount}</span>
                                    </div>
                                </div>
                                <Button onClick={onEvaluateClick} disabled={!canEvaluate} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm h-10 font-bold shadow-md rounded-lg border border-blue-400/30"><Play className="w-4 h-4 mr-2 fill-current" /> Run Evaluation</Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background/50">
                            {!hints.length && (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60"><Layers className="w-16 h-16 mb-4 stroke-[1]" /><p className="text-lg font-medium">Pool is empty</p><p className="text-sm">Generate hints to see them here.</p></div>
                            )}

                            {/* --- HINT LIST RENDERING WITH ACTIVE FRAME --- */}
                            {elimMode === "sequence" && hintStep > 0 ? (
                                <>
                                    {/* Active Sequence Frame */}
                                    <div className="relative border-2 border-indigo-500/50 bg-indigo-500/5 rounded-2xl p-4 mb-4 transition-all animate-in fade-in">
                                         <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                            ACTIVE SEQUENCE
                                         </div>
                                         <div className="space-y-3">
                                            {hints.slice(0, hintStep).map((h, i) => renderHintItem(h, i))}
                                         </div>
                                    </div>
                                    {/* Remaining Hints (Dimmed) */}
                                    <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                                        {hints.slice(hintStep).map((h, i) => renderHintItem(h, i + hintStep))}
                                    </div>
                                </>
                            ) : (
                                /* Normal / Manual Mode List */
                                <div className="space-y-3">
                                    {hints.map((h, i) => renderHintItem(h, i))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm flex gap-3">
                            <Input placeholder="Type a new hint here..." className="bg-background border-input focus:border-purple-500 h-11 text-sm text-foreground rounded-lg" value={newHintText} onChange={e => setNewHintText(e.target.value)} onKeyDown={e => { if(e.key === "Enter" && newHintText.trim()) saveManualHint(newHintText.trim()); }} disabled={!hasServerQuestion} />
                            <Button onClick={() => saveManualHint(newHintText.trim())} disabled={!newHintText.trim()} className="h-11 px-6 bg-muted hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white border border-border font-bold rounded-lg"><Plus className="w-5 h-5 mr-1" /> Add</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECTION: CANDIDATES --- */}
            <div className="lg:col-span-4 space-y-6 min-w-0 relative">
                
                {/* Removed overflow-hidden */}
                <Card className={`bg-card border-border shadow-xl h-full flex flex-col relative`}>
                    
                    {/* GLOBAL LOCK OVERLAY */}
                    {isBusy && loadingState && (
                        <CardOverlay 
                            text={loadingState.text} 
                            subText={loadingState.subText}
                            minimal={true}
                            onDismiss={handleGlobalDismiss}
                        />
                    )}

                    <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold uppercase tracking-wider text-card-foreground flex items-center gap-2"><ListFilter className="w-5 h-5 text-emerald-600 dark:text-emerald-500" /> Candidates</CardTitle>
                        <div className="flex items-center gap-2">
                            <HelpTip title="Candidate Logic" variant="emerald">
                                <p className="mb-3 text-foreground">
                                    Candidates are potential answers generated by the AI. We track which ones remain valid as hints are revealed.
                                </p>
                                <div className="space-y-2 border-t border-border pt-2">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-emerald-700 dark:text-emerald-200 text-xs">Ground Truth</strong>
                                            <div className="text-[10px] opacity-80 text-foreground">The correct answer. Click the <Target className="w-3 h-3 inline"/> icon on any candidate to change this.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 font-bold line-through decoration-slate-500 decoration-2">Abc</div>
                                        <div>
                                            <strong className="text-foreground text-xs">Eliminated</strong>
                                            <div className="text-[10px] opacity-80 text-foreground">This candidate is ruled out by the currently visible hints.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <X className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground text-xs">Reasoning Trace</strong>
                                            <div className="text-[10px] opacity-80 text-foreground">Small colored <strong>X</strong> icons indicate exactly <em>which hint</em> caused the elimination.</div>
                                        </div>
                                    </div>
                                </div>
                            </HelpTip>
                            <ActionTooltip text="Regenerate All Candidates" align="right">
                                <Button variant="ghost" size="icon" onClick={handleRegenerateCandidates} disabled={!groundTruth || isBusy} className="h-8 w-8 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10"><RefreshCw className="w-4 h-4" /></Button>
                            </ActionTooltip>
                            <ActionTooltip text="Delete All Candidates" align="right"><Button variant="ghost" size="icon" onClick={handleDeleteAllCandidates} disabled={!candidates.length} className="h-8 w-8 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button></ActionTooltip>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 min-h-[600px]">
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-background/50">
                            {!candidates.length && (<div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60"><Target className="w-16 h-16 mb-4 stroke-[1]" /><p className="text-lg font-medium">No candidates</p><p className="text-sm">Run evaluation to generate them.</p></div>)}
                            {candidates.map((c, i) => {
                                const isEliminated = isCandidateEliminated(i);
                                const eliminatingColors = eliminatingHintColors(i);
                                const isGT = c.is_groundtruth;

                                return (
                                    <div key={i} className={`group relative pl-4 pr-3 py-3 rounded-lg transition-all overflow-hidden flex items-center justify-between border ${isGT ? 'bg-emerald-500/5 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-card border-border hover:border-muted-foreground'}`}>
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <button 
                                                    onClick={() => !isGT && handleSetGroundTruth(i)} 
                                                    disabled={isGT || isBusy}
                                                    className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${isGT ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20' : 'text-muted-foreground hover:text-emerald-500 hover:bg-muted'}`}
                                                    title={isGT ? "Current Ground Truth" : "Set as Ground Truth"}
                                                >
                                                    {isGT ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                                </button>

                                                <span className={`text-sm truncate transition-all font-medium ${isEliminated ? 'text-muted-foreground opacity-60 decoration-slate-600 line-through' : (isGT ? 'text-foreground font-bold' : 'text-foreground')}`}>
                                                    {c.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 pl-2">
                                                {eliminatingColors.map((hex, k) => (
                                                    <X key={k} className="w-4 h-4" style={{ color: hex, strokeWidth: 4 }} />
                                                ))}
                                            </div>
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-card shadow-xl px-2 py-1 rounded-l-md border-l border-border">
                                                <button onClick={() => { setEditingCandidateIndex(i); setEditingCandidateText(c.text); }} className="p-1.5 text-blue-500 dark:text-blue-400 hover:text-white hover:bg-blue-600 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                                                <button onClick={() => setPendingDeleteCandidateIndex(i)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-white hover:bg-red-600 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                                            </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm flex gap-3">
                            <Input placeholder="Type a new candidate answer here..." className="bg-background border-input focus:border-emerald-500 h-11 text-sm text-foreground rounded-lg" value={newCandidateText} onChange={e => setNewCandidateText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void addCandidate(); }} disabled={!hasServerQuestion} />
                            <Button onClick={addCandidate} disabled={!newCandidateText.trim()} className="h-11 px-6 bg-muted hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-border font-bold rounded-lg"><Plus className="w-5 h-5 mr-1" /> Add</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </main>

      {/* --- MODALS & DIALOGS --- */}
      {(pendingDeleteHint || pendingDeleteCandidateIndex !== null || showResetAllConfirm) && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-popover border border-destructive/50 p-8 rounded-2xl w-full max-w-md space-y-6 shadow-2xl">
                <div className="flex items-center gap-4 text-destructive border-b border-destructive/20 pb-4">
                    <div className="p-3 bg-destructive/10 rounded-full border border-destructive/20"><Trash2 className="w-8 h-8" /></div>
                    <h3 className="text-2xl font-bold text-popover-foreground">Confirm Delete</h3>
                </div>
                <p className="text-muted-foreground text-base leading-relaxed">
                    {pendingDeleteHint ? "Are you sure you want to permanently delete this hint and all its associated metrics?" : 
                     pendingDeleteCandidateIndex !== null ? "Are you sure you want to remove this candidate answer?" : 
                     "Warning: This will wipe your entire session, including the question, hints, and results."}
                </p>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={() => { setPendingDeleteHint(null); setPendingDeleteCandidateIndex(null); setShowResetAllConfirm(false); }} className="hover:bg-accent text-muted-foreground h-11 px-4">Cancel</Button>
                    <Button variant="destructive" onClick={() => {
                        if (pendingDeleteHint) confirmDeleteHint();
                        else if (pendingDeleteCandidateIndex !== null) confirmDeleteCandidate();
                        else confirmResetAll();
                    }} className="h-11 px-6 font-bold">Confirm</Button>
                </div>
            </div>
        </div>
      )}

      {editingHint && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-popover border border-border p-6 rounded-2xl w-full max-w-lg space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-border pb-4">
                    <h3 className="text-xl font-bold text-popover-foreground">Edit Hint</h3>
                    <button onClick={() => setEditingHint(null)} className="text-muted-foreground hover:text-foreground p-1 bg-muted rounded-full hover:bg-accent"><X className="w-5 h-5"/></button>
                </div>
                <textarea className="w-full h-40 bg-background border border-input rounded-xl p-4 text-foreground text-base focus:ring-2 focus:ring-primary outline-none resize-none leading-relaxed" value={editingHintText} onChange={e => setEditingHintText(e.target.value)} />
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setEditingHint(null)} className="hover:bg-accent text-muted-foreground">Cancel</Button>
                    <Button onClick={saveHintEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6">Save Changes</Button>
                </div>
            </div>
        </div>
      )}

      {editingCandidateIndex !== null && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-popover border border-border p-6 rounded-2xl w-full max-w-lg space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-border pb-4">
                    <h3 className="text-xl font-bold text-popover-foreground">Edit Candidate</h3>
                    <button onClick={() => setEditingCandidateIndex(null)} className="text-muted-foreground hover:text-foreground p-1 bg-muted rounded-full hover:bg-accent"><X className="w-5 h-5"/></button>
                </div>
                <Input className="bg-background border-input text-foreground h-12 text-base" value={editingCandidateText} onChange={e => setEditingCandidateText(e.target.value)} />
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setEditingCandidateIndex(null)} className="hover:bg-accent text-muted-foreground">Cancel</Button>
                    <Button onClick={saveCandidateEdit} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6">Save Changes</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}