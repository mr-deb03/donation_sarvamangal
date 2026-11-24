import { Lock } from "lucide-react";

import { mainSite, trust } from "@/config";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="on-ink text-[0.95rem]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-12 lg:px-8 lg:py-16">
        <div className="md:col-span-4">
          <a href={mainSite.home} className="inline-flex items-center gap-3 rounded-lg">
            <img src="/logo-mark.png" alt="" width={44} height={44} className="size-11" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-semibold text-white">{trust.wordmarkTop}</span>
              <span className="mt-1 text-[0.68rem] font-semibold tracking-[0.2em] uppercase">{trust.wordmarkBottom}</span>
            </span>
          </a>
          <p className="mt-5 flex max-w-md gap-2.5 leading-relaxed">
            <Lock className="mt-1 size-4 shrink-0 text-marigold" aria-hidden />
            <span>
              <span className="font-semibold text-white">Secure online donations.</span> Payments are processed by
              Easebuzz. We can only accept donations from Indian citizens living in India — not from NRIs or from abroad.
            </span>
          </p>
        </div>

        <div className="md:col-span-4">
          <h2 className="eyebrow text-white">Contact</h2>
          <address className="mt-3 leading-relaxed not-italic">
            {trust.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <ul className="mt-3 space-y-1">
            <li>
              <a href={trust.phoneHref} className="inline-flex min-h-11 items-center text-white hover:text-marigold">
                {trust.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${trust.email}`} className="inline-flex min-h-11 items-center break-all text-white hover:text-marigold">
                {trust.email}
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h2 className="eyebrow text-white">Registration</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-white">Public trust reg.</dt>
            <dd>{trust.legal.registrationNo}</dd>
            <dt className="text-white">PAN</dt>
            <dd>{trust.legal.pan}</dd>
            <dt className="text-white">80G</dt>
            <dd className="break-words">{trust.legal.eightyGNo}</dd>
          </dl>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            © {year} {trust.name}. All rights reserved.
          </p>
          <nav aria-label="Policies">
            <ul className="flex flex-wrap gap-x-5">
              <li>
                <a className="inline-flex min-h-11 items-center hover:text-white" href={mainSite.privacy}>
                  Privacy policy
                </a>
              </li>
              <li>
                <a className="inline-flex min-h-11 items-center hover:text-white" href={mainSite.terms}>
                  Terms
                </a>
              </li>
              <li>
                <a className="inline-flex min-h-11 items-center hover:text-white" href={mainSite.contact}>
                  Contact
                </a>
              </li>
              <li>
                <a className="inline-flex min-h-11 items-center hover:text-white" href={mainSite.home}>
                  Main website
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
