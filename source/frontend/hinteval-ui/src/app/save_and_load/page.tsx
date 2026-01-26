"use client";

import React, { useState, useRef } from "react";
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Database,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Code2,
  Copy,
  Check,
  Server,
  TableProperties,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_HINTEVAL_API ?? "http://localhost:8000";

interface ImportResult {
  status: string;
  session_id: string;
  import: {
    info: string;
    question_id?: number;
    question_ids?: number[];
    counts?: {
      q?: number;
      h?: number;
      m?: number;
      e?: number;
      c?: number;
    };
    cleared?: {
        cleared: boolean;
        message: string;
        counts?: {
          questions: number;
          hints: number;
          candidates: number;
        };
    };
  };
}

const Badge = ({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "slate" | "indigo" | "purple" | "emerald" | "cyan" | "red";
}) => {
  const styles = {
    slate: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    purple: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
    red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[color]}`}
    >
      {children}
    </span>
  );
};

const CodeWindow = ({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border bg-card shadow-inner flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
          </div>
          <span className="text-xs font-mono text-muted-foreground opacity-80">
            {filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadFile}
            title="Download file"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1 hover:bg-accent rounded group"
          >
            <Download className="w-3 h-3 group-hover:text-cyan-500" />
          </button>
          
          <button
            onClick={copyToClipboard}
            title="Copy to clipboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1 hover:bg-accent rounded"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar flex-1 max-h-[500px] bg-zinc-50 dark:bg-[#0d1117]">
        <pre className="text-xs font-mono leading-relaxed text-zinc-700 dark:text-slate-300">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default function SaveLoadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const [activeGuideTab, setActiveGuideTab] = useState<"full" | "simple" | "csv">("full");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async (format: "json" | "csv" | "full_json") => {
    try {
      window.location.href = `${API}/save_and_load/export?format=${format}`;
    } catch (e) {
      alert("Failed to download session.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("idle");
    setStatusMsg("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `${API}/save_and_load/import`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Import failed");
      }

      if (typeof window !== "undefined") {
          localStorage.removeItem("hinteval_session_v4");
      }

      const result: ImportResult = data;
      setUploadStatus("success");
      setImportResult(result);
      
      const importInfo = result.import.info;
      const clearedInfo = result.import.cleared?.cleared
        ? " • Cleared previous data."
        : " • Clean import.";
      
      setStatusMsg(`${importInfo}${clearedInfo}`);
      
    } catch (err: any) {
      setUploadStatus("error");
      setStatusMsg(err.message || "Failed to upload. Check the format guide below.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-background min-h-screen text-foreground font-sans pb-20 selection:bg-primary/30">
      
      <div className="bg-muted/30 border-b border-border py-12">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex flex-col gap-6 w-full"> 
            
            <div className="space-y-4 text-center md:text-left w-full">
              <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3 justify-center md:justify-start">
                <div className="p-2 bg-indigo-500/10 rounded-lg ring-1 ring-indigo-500/30">
                  <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                Data & Session Management
              </h1>
              
              <p className="text-muted-foreground text-base leading-relaxed w-full">
                Gain complete control over your workspace lifecycle. Seamlessly export your current 
                session logs for deep external analysis, or import existing datasets to instantly 
                restore previous system states and configurations without data loss.
              </p>
            </div>
        
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10 max-w-6xl space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          
          <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 border-b border-border bg-muted/50">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Export Data
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Download your current workspace state.
              </p>
            </div>

            <div className="p-6 space-y-4 flex-1 flex flex-col">
              <button
                onClick={() => handleDownload("full_json")}
                className="w-full flex items-start gap-4 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all group text-left"
              >
                <div className="p-3 bg-indigo-500/20 rounded-md text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 group-hover:scale-110 transition-all">
                  <Server className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-foreground group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                      Full Session Backup
                    </span>
                    <Badge color="indigo">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Preserves <span className="text-indigo-600 dark:text-indigo-300 font-medium">everything</span>:
                    Question, Answer, Hints, Metrics, Entities & Candidates.
                  </p>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-4 mt-auto">
                <button
                  onClick={() => handleDownload("json")}
                  className="flex flex-col items-start p-4 rounded-lg bg-muted/30 border border-border hover:border-muted-foreground transition-all text-left group"
                >
                  <FileJson className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-foreground" />
                  <span className="font-bold text-sm text-foreground mb-1">
                    Raw JSON
                  </span>
                  <p className="text-[10px] text-muted-foreground">Q, A, Hints only.</p>
                </button>

                <button
                  onClick={() => handleDownload("csv")}
                  className="flex flex-col items-start p-4 rounded-lg bg-muted/30 border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mb-3" />
                  <span className="font-bold text-sm text-foreground mb-1">
                    CSV Export
                  </span>
                  <p className="text-[10px] text-muted-foreground">Excel friendly.</p>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 border-b border-border bg-muted/50">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Import Session
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Replace current session with new data.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Importing will clear all existing session data
                </span>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div
                className={`flex-1 min-h-[260px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer group relative overflow-hidden
                  ${
                    uploadStatus === "error"
                      ? "border-red-500/30 bg-red-500/5"
                      : uploadStatus === "success"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border hover:border-cyan-500/50 hover:bg-accent"
                  }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                />

                {isUploading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="p-4 bg-muted rounded-full inline-block">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      Processing file...
                    </div>
                  </div>
                ) : uploadStatus === "success" ? (
                  <div className="animate-in zoom-in-95 duration-300 space-y-4 w-full">
                    <div className="p-3 bg-emerald-500/20 rounded-full inline-block ring-1 ring-emerald-500/40">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">
                        Import Complete
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 mb-3 max-w-sm mx-auto">
                        {statusMsg}
                      </div>
                      
                      {importResult && (
                        <div className="mt-3 p-3 rounded-lg bg-muted border border-border text-left">
                          <div className="text-xs text-muted-foreground space-y-1">
                            {importResult.import.counts ? (
                              <div className="grid grid-cols-2 gap-2">
                                <div>Questions: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{importResult.import.counts.q ?? 0}</span></div>
                                <div>Hints: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{importResult.import.counts.h ?? 0}</span></div>
                                {importResult.import.counts.m !== undefined && (
                                  <div>Metrics: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{importResult.import.counts.m}</span></div>
                                )}
                                {importResult.import.counts.c !== undefined && (
                                  <div>Candidates: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{importResult.import.counts.c}</span></div>
                                )}
                              </div>
                            ) : (
                              <div className="italic opacity-80">Check generator for new content.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = "/generation_and_evaluation";
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold w-full"
                    >
                      Return to Generator <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : uploadStatus === "error" ? (
                  <div className="animate-in shake space-y-3">
                    <div className="p-3 bg-red-500/20 rounded-full inline-block ring-1 ring-red-500/40">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">
                        Import Failed
                      </div>
                      <div className="text-xs text-red-500 mt-1 max-w-[280px] mx-auto">
                        {statusMsg}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold pt-2">
                      Click to try again
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 group-hover:scale-105 transition-transform duration-300">
                    <div className="p-4 bg-muted rounded-full inline-block shadow-lg group-hover:shadow-cyan-500/20">
                      <Upload className="w-8 h-8 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        Click to upload file
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Supports .json or .csv
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-muted rounded-lg">
              <Code2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Format Specification
              </h3>
              <p className="text-xs text-muted-foreground">
                Schema reference for imported files.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              {[
                {
                  id: "full",
                  label: "Advanced Import (JSON)",
                  icon: <Server className="w-4 h-4" />,
                },
                {
                  id: "simple",
                  label: "Raw Data (JSON)",
                  icon: <FileJson className="w-4 h-4" />,
                },
                {
                  id: "csv",
                  label: "Batch CSV",
                  icon: <TableProperties className="w-4 h-4" />,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveGuideTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeGuideTab === tab.id
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3">
              
              {activeGuideTab === "full" && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge color="purple">Advanced Import</Badge>
                    <span className="text-xs text-muted-foreground">
                      Full system state with strict metric & candidate requirements.
                    </span>
                  </div>
                  <CodeWindow
                    filename="strict_backup.json"
                    code={JSON.stringify({
                      instances: {
                        question: { question: "What is the primary function of the mitochondria?" },
                        answers: [{ answer: "Cellular respiration" }],
                        hints: [
                          {
                            hint: "It is found in animal cells but not typically in chloroplasts.",
                            metrics: [
                              { name: "relevance", value: 0.4 },
                              { name: "readability", value: 1.0 },
                              { name: "answer-leakage", value: 0.0 },
                              { name: "familiarity", value: 0.9 },
                              { 
                                name: "convergence", 
                                value: 0.33, 
                                metadata: {
                                  scores: { "Cellular respiration": 1, "Photosynthesis": 0, "Protein synthesis": 1 }
                                } 
                              }
                            ],
                            entities: [{ text: "chloroplasts", type: "BIO", start: 35, "end": 47 }]
                          }
                        ],
                        candidates_full: [
                          { text: "Cellular respiration", is_groundtruth: true, is_eliminated: false },
                          { text: "Photosynthesis", is_groundtruth: false, is_eliminated: true },
                          { text: "Protein synthesis", is_groundtruth: false, is_eliminated: true }
                        ]
                      }
                    }, null, 2)}
                  />
                  <div className="mt-4 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20 space-y-3">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-sm font-bold text-foreground">Strict Validation Rules</h4>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      <li><strong>Structure:</strong> Must use <code>instances</code> key containing question data directly.</li>
                      <li><strong>Metrics:</strong> Each hint requires exactly 5 metrics: <em>relevance, readability, answer-leakage, familiarity, convergence</em>.</li>
                      <li><strong>Convergence:</strong> The <code>convergence</code> metric must include a <code>metadata.scores</code> object.</li>
                      <li><strong>Candidates:</strong> Minimum 2 candidates. Exactly one must have <code>"is_groundtruth": true</code>.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeGuideTab === "simple" && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge color="slate">Minimal Format</Badge>
                    <span className="text-xs text-muted-foreground">
                      Flat structure for quick question loading.
                    </span>
                  </div>
                  <CodeWindow
                    filename="simple.json"
                    code={JSON.stringify({
                      instances: {
                        question: { question: "What is the capital of Brazil?" },
                        answers: [{ answer: "Brasília" }],
                        hints: [
                          { hint: "It was founded in 1960." },
                          { hint: "Designed by Oscar Niemeyer." },
                          { hint: "Located in the central highlands." }
                        ]
                      }
                    }, null, 2)}
                  />
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Hints can be strings or objects. If the <code>answer</code> field is missing, the AI will auto-generate one upon import.
                    </p>
                  </div>
                </div>
              )}

              {activeGuideTab === "csv" && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge color="emerald">Spreadsheet Format</Badge>
                    <span className="text-xs text-muted-foreground">
                      Simple two-column format (Type, Content).
                    </span>
                  </div>
                  <CodeWindow
                    filename="batch_import.csv"
                    code={`type,content\nquestion,What is the capital of Brazil?\nanswer,Brasília\nhint,It was founded in 1960.\nhint,Designed by Oscar Niemeyer.\nhint,Located in the central highlands.`}
                  />
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground space-y-1">
                      <strong className="text-foreground">Valid types:</strong> question, answer, hint<br/>
                      <strong className="text-foreground">Rules:</strong> A file must contain exactly one question row. Hint rows are optional.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}