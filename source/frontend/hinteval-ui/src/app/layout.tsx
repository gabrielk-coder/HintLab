import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/ui/navbar"; // Import the new component
import { BookOpen, FileText, Github } from "lucide-react";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hint Generation and Evaluation",
  description: "Interactive UI for generating, evaluating and visualizing hints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col selection:bg-primary/30`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Replaced hardcoded header with the responsive Client Component */}
          <Navbar />

          <main className="flex-1 relative">
            {children}
          </main>

          {/* Footer: Added flex-col for mobile stacking and centered text */}
          <footer className="border-t border-border bg-background py-6 mt-auto">
            <div className="mx-auto max-w-[1900px] px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
              
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Hint Generation and Evaluation</span>
                <span className="hidden sm:inline text-border">|</span>
                <span>v1.0</span>
              </div>

              {/* Flex wrap added to prevent overflow on very small screens */}
              <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
                <a
                  href="https://github.com/DataScienceUIBK/HintEval" 
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
                <a
                  href="https://hinteval.readthedocs.io/en/latest/index.html"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Documentation
                </a>
                <a
                  href="https://arxiv.org/pdf/2502.00857"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Research Paper
                </a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}