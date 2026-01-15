"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Brain, Layers, ListFilter, Target, ShieldCheck, BookOpen, Search, Eye } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-background min-h-screen text-foreground selection:bg-primary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20 space-y-16 sm:space-y-20">
        
      <section className="space-y-6 text-center mx-auto">
        {/* Badge + heading */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-4">
            <Brain className="w-3.5 h-3.5" /> AI for Education
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-foreground mb-6 break-words max-w-full">
            Hint Generation <br className="hidden sm:block" /> and Evaluation
          </h1>
        </div>

        <p className="max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed font-light px-2">
          Design, generate, and mathematically evaluate step-by-step hints for open questions.<br className="hidden sm:block"/>
          Stop guessing and start measuring hint quality.
        </p>
      </section>


        {/* WORKFLOW CARDS */}
        <section>
          {/* Changed: Single column on mobile, 3 columns on desktop */}
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3">
            {[
              { 
                step: "01", 
                title: "Design", 
                desc: "Start by inserting a factual question.",
                icon: <Target className="w-6 h-6 text-primary" />
              },
              { 
                step: "02", 
                title: "Generate", 
                desc: "Use LLMs to create multiple hint sequences that guide students step-by-step.",
                icon: <Layers className="w-6 h-6 text-primary" />
              },
              { 
                step: "03", 
                title: "Evaluate", 
                desc: "Analyze metrics like Leakage and Convergence to pick the perfect hints.",
                icon: <ListFilter className="w-6 h-6 text-primary" />
              }
            ].map((item, idx) => (
              <Card key={idx} className="group border-border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-300 shadow-xl">
                <CardContent className="pt-8 px-6 pb-8 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-muted-foreground select-none group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <div className="p-3 bg-secondary rounded-lg w-fit border border-border group-hover:border-primary/30 transition-colors">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-xl text-card-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* METRICS SECTION */}
        <section className="space-y-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            Evaluation Metrics
          </h2>
          
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { title: "Convergence", val: "0.0 - 1.0", desc: "Measures how strongly the hint steers the learner towards the specific target solution.", icon: <Target className="w-5 h-5" />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { title: "Leakage", val: "0.0 - 1.0", desc: "Detects if the hint inadvertently gives away the answer too early in the sequence.", icon: <ShieldCheck className="w-5 h-5" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { title: "Familiarity", val: "0.0 - 1.0", desc: "Estimates if the concepts used are appropriate for the target student's knowledge level.", icon: <BookOpen className="w-5 h-5" />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
              { title: "Relevance", val: "0.0 - 1.0", desc: "Ensures the hint is contextually related to the solution path without drifting.", icon: <Search className="w-5 h-5" />, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20" },
              { title: "Readability", val: "0 / 1 / 2", desc: "Classifies linguistic complexity: Easy (0), Intermediate (1), or Difficult (2).", icon: <Eye className="w-5 h-5" />, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
            ].map((m, i) => (
              <div 
                key={i} 
                className="w-full md:w-[45%] lg:w-[30%] bg-card border border-border p-6 rounded-2xl hover:border-primary/50 transition-all duration-300 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex items-center gap-3 font-bold text-lg ${m.color}`}>
                    <div className={`p-2 rounded-lg ${m.bg} ${m.border} border`}>
                       {m.icon} 
                    </div>
                    {m.title}
                  </div>
                </div>

                {/* Range Badge */}
                <div className="mb-4">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-secondary border border-border text-xs font-mono text-muted-foreground shadow-sm">
                    Range: <span className="text-foreground">{m.val}</span>
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* EXAMPLE SECTION */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-foreground">
            Example: "Capital of Australia"
          </h2>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Content */}
            <Card className="border-border bg-card shadow-lg">
              <CardContent className="p-4 sm:p-6 space-y-6">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Question</p>
                  <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-foreground text-base sm:text-lg font-medium">
                    Which city is the capital of Australia?
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Generated Hints</p>
                  {[
                    { text: "It is not the largest city.", label: "Hint 1" },
                    { text: "It was chosen as a compromise and is inland.", label: "Hint 2" },
                    { text: "The name starts with 'C' and houses Parliament.", label: "Hint 3" }
                  ].map((h, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase mt-0.5 shrink-0">{h.label}</span>
                      <p className="text-sm text-foreground">{h.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Right: Metrics Table */}
            <Card className="border-border bg-card shadow-lg">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Hint</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Conv.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Leak</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Read.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium text-foreground">Hint 1</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-mono">0.45</td>
                      <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-mono">0.96</td>
                      <td className="px-4 py-3 text-purple-600 dark:text-purple-400 font-mono">0.94</td>
                    </tr>
                    <tr className="hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium text-foreground">Hint 2</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-mono">0.70</td>
                      <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-mono">0.88</td>
                      <td className="px-4 py-3 text-purple-600 dark:text-purple-400 font-mono">0.90</td>
                    </tr>
                    <tr className="hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium text-foreground">Hint 3</td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400 font-mono">0.92</td>
                      <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400 font-mono">0.62</td>
                      <td className="px-4 py-3 text-purple-600 dark:text-purple-400 font-mono">0.86</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
              <div className="p-4 bg-muted/50 text-xs text-muted-foreground italic border-t border-border">
                  * Note how Hint 3 has high convergence but lower leakage avoidance (it gives away too much).
                </div>
            </Card>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-border pt-8 pb-10 text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Ready to evaluate? <a href="/generation_and_evaluation" className="text-primary hover:text-foreground font-bold underline decoration-primary/30 underline-offset-4">Launch Console</a>
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
            <a href="https://github.com/DataScienceUIBK/HintEval" target="_blank" className="hover:text-foreground">GitHub</a>
             <a href="https://hinteval.readthedocs.io" target="_blank" className="hover:text-foreground">Documentation</a>
             <a href="https://arxiv.org/pdf/2502.00857" target="_blank" className="hover:text-foreground">Read the Paper</a>
          </div>
        </footer>
      </div>
    </div>
  );
}