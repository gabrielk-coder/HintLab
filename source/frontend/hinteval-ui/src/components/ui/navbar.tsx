"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Home, Sparkles, BarChart3, Save, Menu, X } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";

const navItems = [
  { href: "/", icon: <Home className="w-4 h-4" />, label: "Home" },
  { href: "/generation_and_evaluation", icon: <Sparkles className="w-4 h-4" />, label: "Generate Hints" },
  { href: "/metrics", icon: <BarChart3 className="w-4 h-4" />, label: "Metrics" },
  { href: "/save_and_load", icon: <Save className="w-4 h-4" />, label: "Save / Load" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1900px] items-center justify-between px-4 sm:px-6">
        
        {/* --- Logo Area --- */}
        <Link 
          href="/" 
          className="flex items-center gap-3 group transition-opacity hover:opacity-90"
          onClick={() => setIsOpen(false)}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20 border border-white/10 text-primary-foreground">
            <Brain className="h-5 w-5" />
          </div>
          {/* Text hidden on very small phones to save space, visible on slightly larger screens */}
          <span className="font-bold tracking-tight text-foreground text-lg hidden xs:block">
            Hint Generation and Evaluation
          </span>
        </Link>

        {/* --- Desktop Navigation --- */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-transparent 
                ${pathname === item.href 
                  ? "bg-accent text-foreground border-border" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent hover:border-border"
                }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* --- Mobile Menu Toggle & Theme --- */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ModeToggle />
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* --- Mobile Dropdown Menu --- */}
      {isOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-background border-b border-border shadow-2xl animate-in slide-in-from-top-1">
          <div className="flex flex-col p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${pathname === item.href 
                    ? "bg-primary/10 text-primary" 
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}