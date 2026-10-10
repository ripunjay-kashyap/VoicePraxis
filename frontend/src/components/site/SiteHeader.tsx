"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useFlags } from "@/lib/useFlags";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("w-7 h-7", className)} aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#0f172a" />
      <rect x="6.5" y="11" width="2.6" height="6" rx="1.3" fill="#fff" />
      <rect x="11" y="7.5" width="2.6" height="13" rx="1.3" fill="#fff" />
      <rect x="15.5" y="10" width="2.6" height="8" rx="1.3" fill="#fff" />
      <rect x="20" y="12.5" width="2.6" height="3" rx="1.3" fill="#fb923c" />
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
