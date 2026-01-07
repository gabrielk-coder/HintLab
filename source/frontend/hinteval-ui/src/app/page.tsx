// src/app/page.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Brain, Layers, ListFilter, Target, ShieldCheck, BookOpen, Search, Eye } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-[#0f121a] min-h-screen text-slate-50 selection:bg-indigo-500/30">
      <div className="mx-auto max-w-7xl px-6 py-20 space-y-20">
        
        <section className="space-y-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4">
            <Brain className="w-3.5 h-3.5" /> AI for Education
          </div>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-6">
            HintEval
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed font-light">
            Design, generate, and mathematically evaluate step-by-step hints for open questions.<br></br>
            Stop guessing and start measuring hint quality.
          </p>
        </section>

        {/* WORKFLOW CARDS */}
        <section>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { 
                step: "01", 
                title: "Design", 
                desc: "Start by inserting a factual question.",
                icon: <Target className="w-6 h-6 text-indigo-400" />
              },
              { 
                step: "02", 
                title: "Generate", 
                desc: "Use LLMs to create multiple hint sequences that guide students step-by-step.",
                icon: <Layers className="w-6 h-6 text-purple-400" />
              },
              { 
                step: "03", 
                title: "Evaluate", 
                desc: "Analyze metrics like Leakage and Convergence to pick the perfect hints.",
                icon: <ListFilter className="w-6 h-6 text-emerald-400" />
              }
            ].map((item, idx) => (
              <Card key={idx} className="group border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 shadow-xl">
                <CardContent className="pt-8 px-6 pb-8 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-slate-600 select-none group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg w-fit border border-slate-800 group-hover:border-slate-600 transition-colors">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-xl text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

        {/* METRICS SECTION */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center">
          Metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Convergence", val: "0.0 - 1.0", desc: "How strongly does the hint steer towards the target?", icon: <Target className="w-5 h-5" />, color: "text-emerald-400" },
              { title: "Leakage Avoidance", val: "0.0 - 1.0", desc: "Does the hint avoid giving away the answer too early?", icon: <ShieldCheck className="w-5 h-5" />, color: "text-blue-400" },
              { title: "Familiarity", val: "0.0 - 1.0", desc: "Are the concepts appropriate for the student's level?", icon: <BookOpen className="w-5 h-5" />, color: "text-indigo-400" },
              { title: "Relevance", val: "0.0 - 1.0", desc: "Is the hint focused on the solution path?", icon: <Search className="w-5 h-5" />, color: "text-slate-300" },
              { title: "Readability", val: "Discrete (0=Easy, 1=Intermediate, 2=Difficult)", desc: "Is the language clear and easy to understand?", icon: <Eye className="w-5 h-5" />, color: "text-purple-400" },
            ].map((m, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-600 transition-colors">
                <div className={`flex items-center gap-2 mb-2 font-bold ${m.color}`}>
                  {m.icon} {m.title}
                </div>
                <div className="text-xs font-mono text-slate-500 mb-2">{m.val}</div>
                <p className="text-sm text-slate-300">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

        {/* EXAMPLE SECTION */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-white">
            Example: "Capital of Australia"
          </h2>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Content */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
              <CardContent className="p-6 space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Question</p>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-white text-lg font-medium">
                    Which city is the capital of Australia?
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generated Hints</p>
                  {[
                    { text: "It is not the largest city.", label: "Hint 1" },
                    { text: "It was chosen as a compromise and is inland.", label: "Hint 2" },
                    { text: "The name starts with 'C' and houses Parliament.", label: "Hint 3" }
                  ].map((h, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/10">
                      <span className="text-xs font-bold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded uppercase mt-0.5">{h.label}</span>
                      <p className="text-sm text-slate-200">{h.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Right: Metrics Table */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
              <CardContent className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Hint</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-emerald-400 uppercase">Conv.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-blue-400 uppercase">Leak</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-purple-400 uppercase">Read.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    <tr className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-white">Hint 1</td>
                      <td className="px-4 py-3 text-slate-300">0.45</td>
                      <td className="px-4 py-3 text-slate-300">0.96</td>
                      <td className="px-4 py-3 text-slate-300">0.94</td>
                    </tr>
                    <tr className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-white">Hint 2</td>
                      <td className="px-4 py-3 text-slate-300">0.70</td>
                      <td className="px-4 py-3 text-slate-300">0.88</td>
                      <td className="px-4 py-3 text-slate-300">0.90</td>
                    </tr>
                    <tr className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-white">Hint 3</td>
                      <td className="px-4 py-3 text-slate-300 font-bold text-emerald-400">0.92</td>
                      <td className="px-4 py-3 text-slate-300 font-bold text-red-400">0.62</td>
                      <td className="px-4 py-3 text-slate-300">0.86</td>
                    </tr>
                  </tbody>
                </table>
                <div className="p-4 bg-slate-950/30 text-xs text-slate-400 italic">
                  * Note how Hint 3 has high convergence but lower leakage avoidance (it gives away too much).
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 pt-8 pb-10 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            Ready to evaluate? <a href="/generation_and_evaluation" className="text-indigo-400 hover:text-white font-bold underline decoration-indigo-500/30 underline-offset-4">Launch Console</a>
          </p>
          <div className="flex justify-center gap-6 text-xs text-slate-600">
            <a href="https://github.com/DataScienceUIBK/HintEval" target="_blank" className="hover:text-slate-400">GitHub</a>
             <a href="https://hinteval.readthedocs.io" target="_blank" className="hover:text-slate-400">Documentation</a>
             <a href="https://arxiv.org/pdf/2502.00857" target="_blank" className="hover:text-slate-400">Read the Paper</a>
          </div>
        </footer>
      </div>
    </div>
  );
}