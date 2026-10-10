"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useFlags } from "@/lib/useFlags";
import { cn } from "@/lib/utils";

/** Chrono-aperture mark: three time arcs, a playhead and the pinned annotation, on a dark tile. */
export function Logo({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="8 8 84 84" className={cn("w-8 h-8", className)} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={`${id}g`} x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <filter id={`${id}f`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect x="8" y="8" width="84" height="84" rx="20" fill="#0f172a" />
      <path d="M 22 52 A 32 32 0 0 1 48 18" stroke={`url(#${id}g)`} strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <path d="M 64 22 A 32 32 0 0 1 82 54" stroke={`url(#${id}g)`} strokeWidth="8" strokeLinecap="round" />
      <path d="M 78 68 A 32 32 0 0 1 30 78" stroke={`url(#${id}g)`} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      <circle cx="50" cy="50" r="20" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.5" />
      <line x1="50" y1="20" x2="50" y2="80" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="38" r="5.5" fill="#00F5FF" filter={`url(#${id}f)`} />
      <circle cx="50" cy="38" r="2.2" fill="#FFFFFF" />
      <circle cx="34" cy="56" r="2.6" fill="#818CF8" opacity="0.85" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="VoicePraxis home">
      <Logo />
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">VoicePraxis</span>
    </Link>
  );
}

const HEADER = "sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70";

/** Top bar for every page; the route-aware links stream in after the static shell. */
export function SiteHeader() {
  return (
    <React.Suspense
      fallback={
        <header className={HEADER}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center">
            <Brand />
          </div>
        </header>
      }
    >
      <SiteHeaderLinks />
    </React.Suspense>
  );
}

/** Marketing links on the home page, app links elsewhere. */
function SiteHeaderLinks() {
  const pathname = usePathname() || "/";
  const flags = useFlags();
  const home = pathname === "/";

  const links = home
    ? [
        { href: "#how", label: "How it works" },
        { href: "#case", label: "Case study" },
        { href: "#results", label: "Results" },
      ]
    : [
        { href: "/capture", label: "Record" },
        ...(flags?.TEMPLATES ? [{ href: "/templates", label: "Template check" }] : []),
      ];

  return (
    <header className={HEADER}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Brand />
        <nav className="flex items-center gap-1 sm:gap-2 min-w-0">
          <div className={cn("items-center gap-1", home ? "hidden md:flex" : "flex")}>
            {links.map((l) => {
              const active = !home && (pathname === l.href || pathname.startsWith(`${l.href}/`));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "px-2.5 sm:px-3 h-8 rounded-md text-sm inline-flex items-center whitespace-nowrap transition-colors",
                    active ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          {home && (
            <Link
              href="/capture"
              className="ml-1 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Open the app <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2.5">
          <Logo className="w-6 h-6" />
          <span>VoicePraxis · task-level annotation from narrated video</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/capture" className="hover:text-slate-900">Record</Link>
          <Link href="/templates" className="hover:text-slate-900">Template check</Link>
          <a href="https://github.com/ripunjay-kashyap/VoicePraxis" className="hover:text-slate-900" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

/** Title row under the header for app pages: optional back link, title, subtitle and actions. */
export function PageTitle({
  back,
  title,
  subtitle,
  actions,
}: {
  back?: { href: string; label: string };
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-1.5">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" /> {back.label}
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
