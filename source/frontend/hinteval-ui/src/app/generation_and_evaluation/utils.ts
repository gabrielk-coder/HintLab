import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- CONSTANTS ---
export const DEFAULT_METRICS = [
  "convergence",
  "leakage-avoidance",
  "relevance",
  "familiarity",
  "readability",
] as const;

export const EXAMPLE_QUESTIONS = [
  "What is the capital of Brazil?",
  "Which planet is known as the Red Planet?",
  "Who wrote The Hobbit?",
  "What is the tallest mountain in the world?",
  "Who discovered penicillin?",
  "What is the largest ocean on Earth?",
  "What is the chemical symbol for Gold?",
  "Who painted the Mona Lisa?",
  "What is the powerhouse of the cell?",
  "Who was the first person to walk on the Moon?",
  "What is the largest mammal in the world?",
  "What is the capital of Japan?",
  "What is the currency of the United Kingdom?",
  "What is the freezing point of water in Celsius?",
  "Who wrote the play 'Romeo and Juliet'?"
];


export const shortify = (text: string, maxLen: number = 100) => {
  if (!text) return "";
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
};

export const arraysEqual = (a: any[], b: any[]) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const toFiniteNumber = (value: any, fallback: number = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const coerceToPlainText = (val: any): string => {
  if (typeof val === 'string') return val;
  return String(val ?? "");
};

export const shuffledRange = (len: number) => {
  const arr = Array.from({ length: len }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- COLOR UTILS ---

/** Converts HSL values to a Hex string */
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Generates a consistent pastel color based on an ID */
export const colorFromId = (id: number) => {
  const hue = (id * 137.508) % 360; 
  return hslToHex(hue, 75, 60);
};

/** * Mixes the hint's base color with a gray slate color based on the convergence score.
 * High convergence (1.0) = Original Color.
 * Low convergence (0.0) = Dull Slate Color.
 */
export const colorWithConvergence = (hex: string | undefined, convergence: number) => {
  const baseHex = hex || "#6366f1"; // Default Indigo
  if (!Number.isFinite(convergence)) return baseHex;
  
  // Parse Hex to RGB
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);

  // Target "Dull" Color (Slate-800 equivalent: roughly #1e293b)
  const tr = 30, tg = 41, tb = 59; 

  // Interpolate
  const amount = Math.max(0, Math.min(1, convergence)); // Clamp 0-1
  const nr = Math.round(r * amount + tr * (1 - amount));
  const ng = Math.round(g * amount + tg * (1 - amount));
  const nb = Math.round(b * amount + tb * (1 - amount));

  return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
};