import { ArrowLeft, Phone } from "lucide-react";

import { mainSite, trust } from "@/config";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-3">
        <img src="/logo-mark.png" alt="" width={44} height={44} className="size-11 shrink-0" />
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.3rem] font-semibold tracking-[-0.01em] text-ink">{trust.wordmarkTop}</span>
          <span className="mt-1 text-[0.68rem] font-semibold tracking-[0.2em] text-ink-muted uppercase">{trust.wordmarkBottom}</span>
        </span>
      </span>
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 supports-[backdrop-filter]:md:bg-white/85 supports-[backdrop-filter]:md:backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href={mainSite.home} className="-m-1 rounded-lg p-1" aria-label={`${trust.name} — main website`}>
          <Logo />
        </a>
        <nav aria-label="Help" className="flex items-center gap-1 sm:gap-3">
          <a
            href={trust.phoneHref}
            className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-[0.95rem] text-ink-muted hover:text-ink md:inline-flex"
          >
            <Phone className="size-4" aria-hidden />
            <span>
              Need help? <span className="font-medium text-ink tabular">{trust.phone}</span>
            </span>
          </a>
          <a
            href={mainSite.home}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.95rem] font-medium text-ink ring-1 ring-ink/15 ring-inset hover:bg-paper-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="sm:hidden">Website</span>
            <span className="hidden sm:inline">Back to website</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
