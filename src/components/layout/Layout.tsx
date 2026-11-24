import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";

import { Footer } from "./Footer";
import { Header } from "./Header";

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {import.meta.env.MODE === "mock" ? (
        <p className="bg-marigold px-4 py-2 text-center text-sm font-medium text-ink">
          Demo mode — fake API, no real payments. Try 9876543210 (₹600 given this year) or 9811111111 (PAN on file).
        </p>
      ) : null}
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
