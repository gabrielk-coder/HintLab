// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { 
  Brain, 
  Home, 
  Sparkles, 
  BarChart3, 
  Save, 
  BookOpen, 
  FileText,
  Github
} from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HintEval UI",
  description: "Interactive UI for HintEval: generating, evaluating and visualizing hints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-200 min-h-screen flex flex-col selection:bg-indigo-500/30`}
      >
        {/* --- GLOBAL HEADER --- */}
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-[1900px] items-center justify-between px-6">
            
            {/* Logo Area */}
            <Link 
              href="/" 
              className="flex items-center gap-3 group transition-opacity hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 border border-white/10">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold tracking-tight text-white text-lg">
                HintEval
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <NavLink href="/" icon={<Home className="w-4 h-4" />} label="Home" />
              <NavLink href="/generation_and_evaluation" icon={<Sparkles className="w-4 h-4" />} label="Generate Hints" />
              <NavLink href="/metrics" icon={<BarChart3 className="w-4 h-4" />} label="Metrics" />
              <NavLink href="/save_and_load" icon={<Save className="w-4 h-4" />} label="Save / Load" />
            </div>

            <div className="md:hidden">
              <span className="text-xs text-slate-500 font-medium">Menu</span>
            </div>
          </nav>
        </header>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 relative">
          {children}
        </main>

        {/* --- FOOTER --- */}
        <footer className="border-t border-white/10 bg-slate-950 py-6 mt-auto">
          <div className="mx-auto max-w-[1900px] px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">HintEval UI</span>
              <span className="hidden sm:inline text-slate-700">|</span>
              <span>v1.0</span>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://github.com/DataScienceUIBK/HintEval" 
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-indigo-400 transition-colors"
              >
                <Github className="w-3.5 h-3.5" /> GitHub
              </a>
              <a
                href="https://hinteval.readthedocs.io/en/latest/index.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-indigo-400 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" /> Documentation
              </a>
              <a
                href="https://arxiv.org/pdf/2502.00857"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-indigo-400 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Research Paper
              </a>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}