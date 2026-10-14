"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Icon } from "./icons";
import { useLang } from "@/lib/i18n";

/**
 * Responsive uygulama kabuğu.
 * - md ve üstü: sabit sol sidebar + içerik.
 * - md altı: üstte ince bir çubuk (marka + menü), sidebar çekmece olarak açılır.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, brandName } = useLang();

  // Rota değişince çekmeceyi kapat
  useEffect(() => { setOpen(false); }, [pathname]);

  // Çekmece açıkken body scroll'u kilitle + Esc ile kapat
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayBrand = brandName || "Trend Dashboard";

  return (
    <div className="min-h-screen bg-ink-50/60 md:flex">
      {/* Mobil üst çubuk */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ink-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand text-white text-sm font-semibold flex items-center justify-center shrink-0">
              {displayBrand.trim().charAt(0).toUpperCase() || "T"}
            </div>
            <div className="text-sm font-semibold text-ink-900 truncate">{displayBrand}</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost btn-sm -mr-2"
            aria-label={t.nav.openMenu}
            aria-expanded={open}
            aria-controls="mobile-drawer"
          >
            <Icon.Menu size={20} />
          </button>
        </div>
      </header>

      {/* Masaüstü sidebar */}
      <div className="hidden md:block sticky top-0 h-screen border-r border-ink-200 bg-white">
        <Sidebar />
      </div>

      {/* Mobil çekmece */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" id="mobile-drawer">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-white shadow-xl drawer-in flex flex-col">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 btn-ghost btn-sm"
              aria-label={t.nav.closeMenu}
            >
              <Icon.Close size={18} />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="px-4 py-5 sm:px-6 md:px-8 md:py-8 lg:px-10 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
