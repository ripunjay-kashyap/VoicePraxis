/**
 * VoicePraxis Theme Tokens
 * Dark theme lab-instrument / video editor design language.
 * Defined in one central place and mapped to Tailwind utilities.
 */

export const THEME_TOKENS = {
  seen: {
    key: "seen",
    label: "Seen",
    description: "Physical video observation & detected actions",
    hex: "#38bdf8", // Sky / Blue
    borderHex: "#0284c7",
    bgMutedHex: "rgba(56, 189, 248, 0.12)",
    textClass: "text-sky-400",
    bgClass: "bg-sky-500",
    borderClass: "border-sky-500/40",
    badgeClass: "bg-sky-950/70 text-sky-300 border-sky-800/80",
    glowClass: "shadow-[0_0_12px_rgba(56,189,248,0.25)]",
    dotClass: "bg-sky-400",
    icon: "Eye",
  },
  said: {
    key: "said",
    label: "Said",
    description: "Verbatim speech & spoken intentions",
    hex: "#fb923c", // Orange
    borderHex: "#ea580c",
    bgMutedHex: "rgba(251, 146, 60, 0.12)",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500",
    borderClass: "border-orange-500/40",
    badgeClass: "bg-orange-950/70 text-orange-300 border-orange-800/80",
    glowClass: "shadow-[0_0_12px_rgba(251,146,60,0.25)]",
    dotClass: "bg-orange-400",
    icon: "Mic",
  },
  why: {
    key: "why",
    label: "Why",
    description: "The hero token - reasoning, intent linkage, & recovery insight",
    isHero: true,
    hex: "#22c55e", // Emerald / Green hero
    borderHex: "#16a34a",
    bgMutedHex: "rgba(34, 197, 94, 0.15)",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-500/50",
    badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-700/80 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
    glowClass: "shadow-[0_0_16px_rgba(34,197,94,0.35)]",
    dotClass: "bg-emerald-400 animate-pulse",
    icon: "Sparkles",
  },
  missed: {
    key: "missed",
    label: "Missed",
    description: "Failures, template deviations, & missing reasons",
    hex: "#ef4444", // Red
    borderHex: "#dc2626",
    bgMutedHex: "rgba(239, 68, 68, 0.12)",
    textClass: "text-red-400",
    bgClass: "bg-red-500",
    borderClass: "border-red-500/40",
    badgeClass: "bg-red-950/70 text-red-300 border-red-800/80",
    glowClass: "shadow-[0_0_12px_rgba(239,68,68,0.25)]",
    dotClass: "bg-red-400",
    icon: "AlertTriangle",
  },
  info: {
    key: "info",
    label: "Info",
    description: "Pipeline provenance, timestamps, & metadata",
    hex: "#94a3b8", // Blue-grey / Slate
    borderHex: "#64748b",
    bgMutedHex: "rgba(148, 163, 184, 0.12)",
    textClass: "text-slate-400",
    bgClass: "bg-slate-500",
    borderClass: "border-slate-500/40",
    badgeClass: "bg-slate-900/80 text-slate-300 border-slate-700/80",
    glowClass: "shadow-[0_0_10px_rgba(148,163,184,0.15)]",
    dotClass: "bg-slate-400",
    icon: "Info",
  },
} as const;

export type ThemeTokenKey = keyof typeof THEME_TOKENS;
