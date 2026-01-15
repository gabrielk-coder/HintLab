"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes"; 

// Icons
import {
  BarChart3,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  Activity,
  FileText,
  Grid3X3,
  XCircle,
  ArrowRight,
  BookOpen,
  GitCommitVertical,
  Tags,
  Network,
  Lightbulb,
  SearchCheck,
} from "lucide-react";

// Charts
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Bar,
  AreaChart,
  Area,
} from "recharts";

// UI Components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_HINTEVAL_API ?? "http://localhost:8000";
const STORAGE_KEY = "hinteval_session_v4";

const formatViews = (num: number) => {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
};

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const colorFromId = (id: number) => {
  const hue = (id * 137.508) % 360;
  return hslToHex(hue, 75, 60);
};

const getReadabilityLabel = (score?: number) => {
  if (score === undefined || score === null)
    return {
      label: "N/A",
      color: "text-muted-foreground bg-muted border-border",
    };
  const val = Math.round(score);
  if (val <= 0)
    return {
      label: "Beginner",
      color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    };
  if (val === 1)
    return {
      label: "Intermediate",
      color: "text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    };
  return {
    label: "Advanced",
    color: "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20",
  };
};

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return new Set(words);
}

function calculateJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1; 
  if (setA.size === 0 || setB.size === 0) return 0; 

  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) intersection++;
  });
  
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

interface MetricData {
  id: number;
  text: string;
  convergence?: number;
  relevance?: number;
  answer_leakage?: number;
  readability?: number;
  familiarity?: number;
  cumulative_convergence?: number;
  color: string;
}

interface ConvergenceItem {
  id: number;
  text: string;
  candidates: Record<string, number>; 
}

interface EntityItem {
  text: string;
  type: string;
  start: number;
  end: number;
  metadata?: string | any;
}

const EntityWithTooltip = ({
  children,
  type,
  views,
  colorClass,
}: {
  children: React.ReactNode;
  type: string;
  views: number | null;
  colorClass: string;
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  };

  const handleMouseLeave = () => setCoords(null);

  return (
    <>
      <span
        className={`cursor-help mx-0.5 px-1 rounded border text-xs font-mono font-medium align-baseline inline-block ${colorClass}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>

      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] flex flex-col gap-1 w-max min-w-[120px] max-w-[200px] bg-popover text-popover-foreground text-xs rounded shadow-xl border border-border p-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground border-b border-border pb-1 mb-1">
              {type}
            </div>

            {views ? (
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 gap-2">
                <span>Wiki Views: </span>
                <span className="font-bold"> {formatViews(views)}/month</span>
              </div>
            ) : (
              <div className="text-muted-foreground italic text-[10px]">
                No stats available
              </div>
            )}

            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-popover"></div>
          </div>,
          document.body
        )}
    </>
  );
};

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const eliminated = data.eliminated || [];
    
    const maxDisplay = 8;
    const overflow = eliminated.length - maxDisplay;

    return (
      <div className="bg-popover/95 backdrop-blur-md border border-border p-4 rounded-lg shadow-2xl min-w-[220px] max-w-[300px] z-[50]">
        <div className="font-bold text-popover-foreground mb-2 border-b border-border pb-2">
          {label}
        </div>
        
        <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Remaining Pool:</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.count}</span>
        </div>

        {eliminated.length > 0 ? (
          <div>
            <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Eliminated Here ({eliminated.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {eliminated.slice(0, maxDisplay).map((item: string, i: number) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 rounded text-[10px] break-all"
                >
                  {item}
                </span>
              ))}
              {overflow > 0 && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] italic border border-border">
                  +{overflow} more
                </span>
              )}
            </div>
          </div>
        ) : (
             label !== "Start" && (
                <p className="text-[10px] text-muted-foreground italic">No candidates eliminated in this step.</p>
             )
        )}
      </div>
    );
  }

  return null;
};

export default function MetricsPage() {
  const { theme } = useTheme(); 
  const [metricsRaw, setMetricsRaw] = useState<MetricData[]>([]);
  const [convergenceRaw, setConvergenceRaw] = useState<ConvergenceItem[]>([]);
  const [entitiesRaw, setEntitiesRaw] = useState<Record<number, EntityItem[]>>({});
  const [embeddingMatrix, setEmbeddingMatrix] = useState<number[][]>([]);
  
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const [idToColorMap, setIdToColorMap] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved.hints)) {
            const ids = saved.hints.map((h: any) => Number(h.hint_id ?? h.id));
            setOrderedIds(ids);

            const colorMap: Record<number, string> = {};
            saved.hints.forEach((h: any) => {
              const id = Number(h.hint_id ?? h.id);
              colorMap[id] = h.colorHex || colorFromId(id);
            });
            setIdToColorMap(colorMap);
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync order/colors from local storage", e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, convRes, entRes, embedRes] = await Promise.all([
        fetch(`${API}/metrics/get_metrics`, { credentials: "include" }),
        fetch(`${API}/metrics/get_convergence_scores`, { credentials: "include" }),
        fetch(`${API}/metrics/get_entities`, { credentials: "include" }),
        fetch(`${API}/metrics/get_embedding_similarities`, {
          credentials: "include",
        }),
      ]);

      if (!metricsRes.ok)
        throw new Error(`Metrics API error: ${metricsRes.status}`);

      const metricsJson = await metricsRes.json();
      const convJson = convRes.ok ? await convRes.json() : [];
      const entJson = entRes.ok ? await entRes.json() : {};
      const embedJson = embedRes.ok ? await embedRes.json() : [];

      const normalizedMetrics = (
        Array.isArray(metricsJson) ? metricsJson : []
      ).map((m: any) => ({
        ...m,
        id: Number(m.hint_id ?? m.id),
        text: m.text ?? m.hint_text ?? "",
        color: "#334155",
      }));

      const normalizedConv = (Array.isArray(convJson) ? convJson : []).map(
        (c: any) => ({
          ...c,
          id: Number(c.hint_id ?? c.id),
          text: c.text ?? c.hint_text ?? "",
        })
      );

      setMetricsRaw(normalizedMetrics);
      setConvergenceRaw(normalizedConv);
      setEntitiesRaw(entJson);

      setEmbeddingMatrix(
        Array.isArray(embedJson) ? embedJson : embedJson.matrix || []
      );
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load evaluation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSortedData = <T extends { id: number }>(data: T[]): T[] => {
    if (!data || data.length === 0) return [];
    if (orderedIds.length === 0) return data;

    const map = new Map(data.map((item) => [item.id, item]));

    const sorted = orderedIds
      .map((id) => map.get(id))
      .filter((item): item is T => item !== undefined);

    const processedIds = new Set(sorted.map((s) => s.id));
    const leftovers = data.filter((d) => !processedIds.has(d.id));

    return [...sorted, ...leftovers];
  };

  const metrics = useMemo(() => {
    const sorted = getSortedData(metricsRaw);
    return sorted.map((m) => ({
      ...m,
      color: idToColorMap[m.id] || colorFromId(m.id),
    }));
  }, [metricsRaw, orderedIds, idToColorMap]);

  const convergenceData = useMemo(
    () => getSortedData(convergenceRaw),
    [convergenceRaw, orderedIds]
  );

  const allCandidates = useMemo(() => {
    if (!convergenceRaw.length) return [];
    const uniqueKeys = new Set<string>();
    convergenceRaw.forEach((c) => {
      Object.keys(c.candidates || {}).forEach((k) => uniqueKeys.add(k));
    });
    return Array.from(uniqueKeys).sort();
  }, [convergenceRaw]);

  const hasValidMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) return false;
    return metrics.some((m) => {
      const isNum = (val: any) => typeof val === "number" && !isNaN(val);
      return (
        isNum(m.convergence) ||
        isNum(m.relevance) ||
        isNum(m.answer_leakage) ||
        isNum(m.familiarity) ||
        isNum(m.readability)
      );
    });
  }, [metrics]);

  const reductionData = useMemo(() => {
    if (!convergenceData.length || !allCandidates.length) return [];

    let currentPool = new Set(allCandidates);
    const dataPoints = [];

    dataPoints.push({
      name: "Start",
      count: allCandidates.length,
      fullLabel: "Initial Pool",
      eliminated: [], 
    });

    convergenceData.forEach((hint, i) => {
      const nextPool = new Set<string>();
      const eliminatedHere: string[] = [];

      Array.from(currentPool).forEach((candidate) => {
        const status = hint.candidates ? hint.candidates[candidate] : undefined;
        if (status === 1) {
             nextPool.add(candidate);
        } else {
             eliminatedHere.push(candidate);
        }
      });
      
      currentPool = nextPool;
      
      dataPoints.push({
        name: `Hint ${i + 1}`,
        count: currentPool.size,
        fullLabel: `After Hint ${i + 1}`,
        eliminated: eliminatedHere
      });
    });

    return dataPoints;
  }, [convergenceData, allCandidates]);

  const lexicalSimilarityMatrix = useMemo(() => {
    if (!metrics.length) return [];
    const matrix = [];
    const tokenizedHints = metrics.map(m => tokenize(m.text));

    for (let i = 0; i < metrics.length; i++) {
      const row = [];
      for (let j = 0; j < metrics.length; j++) {
        const score = calculateJaccard(tokenizedHints[i], tokenizedHints[j]);
        row.push(score);
      }
      matrix.push(row);
    }
    return matrix;
  }, [metrics]);

  const eliminationOverlapMatrix = useMemo(() => {
    if (!convergenceData.length) return [];
    
    const eliminatedSets = convergenceData.map((hint) => {
      const set = new Set<string>();
      Object.entries(hint.candidates).forEach(([candidate, status]) => {
        if (status === 0) set.add(candidate);
      });
      return set;
    });

    const matrix = [];
    for (let i = 0; i < convergenceData.length; i++) {
      const row = [];
      for (let j = 0; j < convergenceData.length; j++) {
        if (i === j) {
            row.push(1);
            continue;
        }
        const score = calculateJaccard(eliminatedSets[i], eliminatedSets[j]);
        row.push(score);
      }
      matrix.push(row);
    }
    return matrix;
  }, [convergenceData]);

  const targetGroupOverlapMatrix = useMemo(() => {
    if (!convergenceData.length) return [];

    const keptSets = convergenceData.map((hint) => {
      const set = new Set<string>();
      Object.entries(hint.candidates).forEach(([candidate, status]) => {
        if (status === 1) set.add(candidate);
      });
      return set;
    });

    const matrix = [];
    for (let i = 0; i < convergenceData.length; i++) {
      const row = [];
      for (let j = 0; j < convergenceData.length; j++) {
        if (i === j) {
            row.push(1);
            continue;
        }
        const score = calculateJaccard(keptSets[i], keptSets[j]);
        row.push(score);
      }
      matrix.push(row);
    }
    return matrix;
  }, [convergenceData]);

  const chartData = useMemo(() => {
    const round2 = (num: number | null | undefined) =>
      typeof num === "number" ? Number(num.toFixed(2)) : null;

    return metrics.map((m, index) => {
      const leakageAvoidance =
        typeof m.answer_leakage === "number"
          ? Math.max(0, 1 - m.answer_leakage)
          : null;

      return {
        name: `H${index + 1}`,
        Relevance: round2(m.relevance),
        "Leakage Avoidance": round2(leakageAvoidance),
        Familiarity: round2(m.familiarity),
        fillColor: m.color,
      };
    });
  }, [metrics]);

  const renderHighlightedText = (hintId: number, text: string) => {
    const entities = entitiesRaw[hintId];

    if (!entities || entities.length === 0 || !text) {
      return <span className="text-foreground">{text}</span>;
    }

    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

    const elements = [];
    let lastIndex = 0;

    sortedEntities.forEach((entity, i) => {
      const safeStart = Math.max(0, Math.min(entity.start, text.length));
      const safeEnd = Math.max(safeStart, Math.min(entity.end, text.length));

      if (safeStart > lastIndex) {
        elements.push(
          <span key={`text-${i}`} className="text-foreground">
            {text.slice(lastIndex, safeStart)}
          </span>
        );
      }

      let colorClass = "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40";
      if (entity.type === "PERSON")
        colorClass = "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40";
      else if (entity.type === "ORG")
        colorClass = "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40";
      else if (entity.type === "DATE" || entity.type === "TIME")
        colorClass = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
      else if (entity.type === "GPE" || entity.type === "LOC")
        colorClass = "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/40";
      else if (entity.type === "EVENT")
        colorClass = "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40";

      let views = null;
      try {
        if (entity.metadata) {
          const meta =
            typeof entity.metadata === "string"
              ? JSON.parse(entity.metadata)
              : entity.metadata;
          if (meta.wiki_views_per_month) {
            views = meta.wiki_views_per_month;
          }
        }
      } catch (e) {
        console.error("Error parsing metadata", e);
      }

      elements.push(
        <EntityWithTooltip
          key={`entity-${i}`}
          type={`Type: ${entity.type}`}
          views={views}
          colorClass={colorClass}
        >
          {text.slice(safeStart, safeEnd)}
        </EntityWithTooltip>
      );

      lastIndex = safeEnd;
    });

    if (lastIndex < text.length) {
      elements.push(
        <span key="text-end" className="text-foreground">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return <>{elements}</>;
  };

  const renderHeatmap = (
    matrix: number[][],
    title: string,
    description: string,
    icon: React.ReactNode,
    colorHue: number
  ) => {
    if (!metrics.length || !matrix.length) return null;

    return (
      <Card
        className="col-span-1 bg-card border-border backdrop-blur-sm shadow-xl overflow-visible h-full flex flex-col"
        key={title} 
      >
        <CardHeader className="border-b border-border pb-4 bg-muted/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-foreground">
                {icon} {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 flex items-center justify-center flex-grow overflow-visible">
          <div className="flex flex-col items-center justify-center w-full overflow-x-auto">
            <div
              className="grid gap-1 p-2"
              style={{
                gridTemplateColumns: `30px repeat(${metrics.length}, minmax(45px, 1fr))`,
              }}
            >
              <div className="h-8 w-8"></div>
              {metrics.map((_, i) => (
                <div key={`col-head-${i}`} className="flex items-center justify-center pb-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    H{i + 1}
                  </span>
                </div>
              ))}

              {metrics.map((_, rowIdx) => (
                <React.Fragment key={`row-${rowIdx}`}>
                  <div className="flex items-center justify-center pr-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      H{rowIdx + 1}
                    </span>
                  </div>
                  {metrics.map((_, colIdx) => {
                    const score = matrix[rowIdx]
                      ? matrix[rowIdx][colIdx] || 0
                      : 0;
                    const isDiagonal = rowIdx === colIdx;
                    const isTopHalf = rowIdx < metrics.length / 2;
                    const tooltipPosition = isTopHalf
                      ? "top-full mt-2"
                      : "bottom-full mb-2";

                    const opacity = isDiagonal ? 0.05 : Math.max(0.1, score);
                    const bgStyle = {
                      backgroundColor: `hsla(${colorHue}, 100%, 50%, ${opacity})`,
                      borderColor: `hsla(${colorHue}, 100%, 50%, ${Math.min(
                        1,
                        opacity + 0.2
                      )})`,
                    };

                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        className="group relative h-12 w-full min-w-[45px] rounded flex items-center justify-center border border-transparent transition-all duration-200 hover:border-primary/80 hover:scale-110 z-0 hover:z-[100] shadow-sm hover:shadow-2xl"
                        style={bgStyle}
                      >
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            score > 0.5 || isDiagonal
                              ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isDiagonal ? "-" : score.toFixed(2).replace(/^0+/, "")}
                        </span>
                        <div
                          className={`absolute ${tooltipPosition} hidden group-hover:block w-56 bg-popover border border-yellow-500/50 p-3 rounded-lg shadow-2xl z-[101] pointer-events-none animate-in fade-in zoom-in-95 duration-150`}
                        >
                          <div className="text-xs font-bold text-yellow-600 dark:text-yellow-400 mb-1 text-center">
                            Score: {(score * 100).toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-popover-foreground border-b border-border pb-1 mb-1">
                            <span className="font-bold text-muted-foreground">
                              H{rowIdx + 1}:
                            </span>{" "}
                            {metrics[rowIdx].text?.substring(0, 60)}...
                          </div>
                          <div className="text-[10px] text-popover-foreground">
                            <span className="font-bold text-muted-foreground">
                              H{colIdx + 1}:
                            </span>{" "}
                            {metrics[colIdx].text?.substring(0, 60)}...
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-8 text-[10px] uppercase font-bold text-muted-foreground">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: `hsla(${colorHue}, 100%, 50%, 0.1)`,
                    border: `1px solid hsla(${colorHue}, 100%, 50%, 0.2)`,
                  }}
                ></div>
                <span>Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: `hsla(${colorHue}, 100%, 50%, 0.5)`,
                    border: `1px solid hsla(${colorHue}, 100%, 50%, 0.6)`,
                  }}
                ></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: `hsla(${colorHue}, 100%, 50%, 1)`,
                    border: `1px solid hsla(${colorHue}, 100%, 50%, 1)`,
                  }}
                ></div>
                <span>High</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-10 h-10 animate-spin text-primary" />
          <p>Syncing evaluation data...</p>
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const gridColor = isDark ? "#1e293b" : "#e2e8f0"; 
  const axisColor = isDark ? "#64748b" : "#94a3b8"; 
  const tooltipBg = isDark ? "#0f172a" : "#ffffff"; 
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0"; 
  const tooltipText = isDark ? "#f8fafc" : "#0f172a"; 

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-10 pb-20">
      <div className="container mx-auto max-w-[1600px] space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
              Evaluation Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Visualizing performance across{" "}
              <span className="text-foreground font-mono font-bold">
                {metrics.length}
              </span>{" "}
              hints.
            </p>
          </div>
          <Button
            onClick={fetchData}
            variant="outline"
            className="border-border hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Refresh Data
          </Button>
        </header>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {!error && !hasValidMetrics && (
          <div className="h-96 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/30 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-foreground">
              No Data Available
            </h3>
            <p className="text-sm mt-2 max-w-md text-center">
              No metrics found. Please go to <strong>Generate</strong>, create
              hints, and click <strong>"Run Evaluation"</strong>.
            </p>
          </div>
        )}

        {hasValidMetrics && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* --- CHARTS ROW --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Metric Scores */}
              <Card className="col-span-1 lg:col-span-2 bg-card border-border backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Metric Scores per Hint
                  </CardTitle>
                  <CardDescription>
                    Comparative Analysis of Familiarity, Relevance, and Leakage Avoidance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="name" 
                        stroke={axisColor} 
                        tick={{ fontSize: 12, fontWeight: "bold", fill: axisColor }} 
                      />
                      <YAxis 
                        stroke={axisColor} 
                        tick={{ fontSize: 12, fontWeight: "bold", fill: axisColor }} 
                        domain={[0, 1]} 
                      />
                      <RechartsTooltip
                        cursor={{ fill: gridColor, opacity: 0.4 }}
                        contentStyle={{
                          backgroundColor: tooltipBg,
                          borderColor: tooltipBorder,
                          borderRadius: "8px",
                          color: tooltipText,
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                      <Bar
                        dataKey="Relevance"
                        fill="#60a5fa"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                      <Bar
                        dataKey="Leakage Avoidance"
                        fill="#f87171"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                      <Bar
                        dataKey="Familiarity"
                        fill="#34d399"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Answer Reduction */}
              <Card className="col-span-1 bg-card border-border overflow-visible">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Answer Space Reduction
                  </CardTitle>
                  <CardDescription>
                    Visualizes the reduction of the candidate pool size. Hover over data points to view specific eliminated candidates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] overflow-visible">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={reductionData}
                      margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                      />

                      <XAxis
                        dataKey="name"
                        stroke={axisColor}
                        tick={{ fontSize: 12, fontWeight: "bold", fill: axisColor }}
                        label={{
                          value: "Sequence of Hints",
                          position: "insideBottom",
                          offset: -10,
                          fill: axisColor,
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      />

                      <YAxis
                        stroke={axisColor}
                        tick={{ fontSize: 12, fontWeight: "bold", fill: axisColor }}
                        allowDecimals={false}
                        label={{
                          value: "Num. of Remaining Candidate Answers",
                          angle: -90,
                          position: "insideLeft",
                          offset: 20, 
                          fill: axisColor,
                          fontSize: 12,
                          style: { textAnchor: "middle" },
                          fontWeight: "bold",
                        }}
                      />
                      
                      <RechartsTooltip content={CustomAreaTooltip} />
                      
                      <Area
                        type="stepAfter"
                        dataKey="count"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hint Reference */}
              <Card className="col-span-1 bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <FileText className="w-5 h-5 text-purple-500" />
                    Hint Reference
                  </CardTitle>
                  <CardDescription>
                    Detailed view of hint text with extracted named entities and Wikipedia view statistics.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {metrics.map((m, i) => {
                      const readability = getReadabilityLabel(m.readability);
                      return (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg bg-muted/50 border border-border flex gap-3 items-start hover:border-muted-foreground transition-colors group"
                        >
                          <span
                            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-slate-900 mt-0.5 shadow-sm"
                            style={{ backgroundColor: m.color }}
                          >
                            {i + 1}
                          </span>
                          <div className="w-full">
                            <div className="text-sm leading-relaxed">
                              {renderHighlightedText(m.id, m.text)}
                            </div>

                            <div className="flex justify-between items-center mt-2 border-t border-border pt-2">
                              <div className="flex gap-3 text-[10px] text-muted-foreground font-mono uppercase">
                                {typeof m.convergence === "number" && (
                                  <span>
                                    Convergence:{" "}
                                    <span className="text-foreground">
                                      {m.convergence.toFixed(2)}
                                    </span>
                                  </span>
                                )}
                                {typeof m.relevance === "number" && (
                                  <span>
                                    Relevance:{" "}
                                    <span className="text-foreground">
                                      {m.relevance.toFixed(2)}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase flex items-center gap-1 ${readability.color}`}
                              >
                                <BookOpen className="w-3 h-3" />
                                {readability.label}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* --- MATRICES SECTION --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              
              {/* 1. Elimination Matrix */}
              {convergenceData.length > 0 && (
                <Card className="col-span-1 lg:col-span-2 bg-card border-border backdrop-blur-sm overflow-hidden shadow-xl">
                  <CardHeader className="border-b border-border pb-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <Grid3X3 className="w-5 h-5 text-indigo-500" />
                          Elimination Matrix
                        </CardTitle>
                        <CardDescription>
                          A detailed grid view indicating the compatibility status (kept vs. eliminated) of every candidate against each hint.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-3 py-1.5 rounded-full border border-border">
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-slate-500" />{" "}
                          Compatible
                        </span>
                        <span className="flex items-center gap-1.5">
                          <XCircle className="w-3 h-3 text-red-500" /> Eliminated
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                    <div className="min-w-max p-6">
                      <div
                        className="grid gap-x-1 gap-y-1"
                        style={{
                          gridTemplateColumns: `minmax(150px, auto) repeat(${convergenceData.length}, minmax(30px, 1fr))`,
                        }}
                      >
                        <div className="p-2 text-[10px] font-bold uppercase text-muted-foreground flex items-end justify-end border-b border-border mr-2">
                          Answers <ArrowRight className="w-3 h-3 ml-1 inline" />
                        </div>
                        {convergenceData.map((hint, i) => (
                          <div
                            key={hint.id}
                            className="flex flex-col items-center justify-end pb-3"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-md"
                              style={{
                                backgroundColor:
                                  idToColorMap[hint.id] || colorFromId(hint.id),
                              }}
                            >
                              {i + 1}
                            </div>
                          </div>
                        ))}
                        {allCandidates.map((candidate, rowIdx) => (
                          <React.Fragment key={candidate}>
                            <div
                              className={`flex items-center px-3 py-2 text-xs font-medium rounded-l-md border-y border-l border-border ${
                                rowIdx % 2 === 0
                                  ? "bg-muted/50"
                                  : "bg-card"
                              }`}
                            >
                              <span
                                className="text-foreground truncate max-w-[200px]"
                                title={candidate}
                              >
                                {candidate}
                              </span>
                            </div>
                            {convergenceData.map((hint, colIdx) => {
                              const status = hint.candidates[candidate];
                              const isEliminated = status === 0;
                              const hintColor =
                                idToColorMap[hint.id] || colorFromId(hint.id);
                              return (
                                <div
                                  key={`${hint.id}-${candidate}`}
                                  className={`relative flex items-center justify-center border-y border-border ${
                                    rowIdx % 2 === 0
                                      ? "bg-muted/50"
                                      : "bg-card"
                                  } hover:bg-accent`}
                                >
                                  {isEliminated ? (
                                    <XCircle
                                      className="w-4 h-4 relative z-10"
                                      style={{ color: hintColor }}
                                    />
                                  ) : (
                                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                  )}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 2. Elimination Strategy Overlap */}
              {eliminationOverlapMatrix.length > 0 &&
                renderHeatmap(
                  eliminationOverlapMatrix,
                  "Elimination Strategy Overlap",
                  "Shows how much two hints agree on which answers are wrong (based on eliminated candidates).",
                  <Tags className="w-5 h-5 text-fuchsia-500" />,
                  300 // Purple
                )}

              {/* 3. Target Group Overlap */}
              {targetGroupOverlapMatrix.length > 0 &&
                renderHeatmap(
                  targetGroupOverlapMatrix,
                  "Target Group Overlap",
                  "Shows how much two hints agree on which answers are still possible (based on compatible candidates).",
                  <SearchCheck className="w-5 h-5 text-emerald-500" />,
                  150 // Green
                )}

              {/* 4. Shared Vocabulary */}
              {lexicalSimilarityMatrix.length > 0 &&
                renderHeatmap(
                  lexicalSimilarityMatrix,
                  "Shared Vocabulary",
                  "Measures how many words are shared between two hints using Jaccard text similarity.",
                  <GitCommitVertical className="w-5 h-5 text-yellow-500" />,
                  45 // Yellow
                )}

              {/* 5. Conceptual Similarity */}
              {embeddingMatrix.length > 0 &&
                renderHeatmap(
                  embeddingMatrix,
                  "Conceptual Similarity",
                  "Measures how similar the underlying meanings of the hints are using AI embeddings.",
                  <Lightbulb className="w-5 h-5 text-blue-500" />,
                  220 // Blue
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}