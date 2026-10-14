"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Icon } from "./icons";

type NavItem = { href: string; label: string; icon: (p: { size?: number; className?: string }) => JSX.Element };
type NavGroup = { title: string; items: NavItem[] };

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang, brandName } = useLang();
  const { pref, setPref } = useTheme();

  const GROUPS: NavGroup[] = [
    {
      title: t.nav.groups.analysis,
      items: [
        { href: "/", label: t.nav.overview, icon: Icon.Overview },
        { href: "/explorer", label: t.nav.explorer, icon: Icon.Explore },
        { href: "/opportunities", label: t.nav.opportunities, icon: Icon.Opportunity },
        { href: "/categories", label: t.nav.categories, icon: Icon.Category },
        { href: "/alerts", label: t.nav.alerts, icon: Icon.Alert },
      ],
    },
    {
      title: t.nav.groups.content,
      items: [
        { href: "/chat", label: t.nav.chat, icon: Icon.Chat },
        { href: "/seo", label: t.nav.seo, icon: Icon.Seo },
      ],
    },
    {
      title: t.nav.groups.system,
      items: [
        { href: "/admin", label: t.nav.admin, icon: Icon.Admin },
        { href: "/setup", label: t.nav.setup, icon: Icon.Setup },
        { href: "/settings", label: t.nav.settings, icon: Icon.Settings },
      ],
    },
  ];

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  const displayBrand = brandName || "Trend Dashboard";
  const initial = displayBrand.trim().charAt(0).toUpperCase() || "T";

  return (
    <aside className="w-64 shrink-0 bg-surface flex flex-col h-full">
      <div className="px-4 py-4 border-b border-ink-200 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand text-white font-semibold flex items-center justify-center shrink-0 shadow-sm">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">{displayBrand}</div>
          <div className="text-[11px] text-ink-500 truncate">{t.nav.panelSubtitle}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Ana menü">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                const I = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`nav-link ${active ? "nav-link-active" : ""}`}
                    >
                      <I size={18} className={active ? "text-brand-600" : "text-ink-400"} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-ink-200 space-y-2">
        <div className="segmented" role="group" aria-label={t.nav.theme}>
          {(["system", "light", "dark"] as const).map((opt) => {
            const I = opt === "system" ? Icon.Monitor : opt === "light" ? Icon.Sun : Icon.Moon;
            const label = opt === "system" ? t.nav.themeSystem : opt === "light" ? t.nav.themeLight : t.nav.themeDark;
            return (
              <button
                key={opt}
                onClick={() => setPref(opt)}
                className={`segmented-item flex items-center justify-center gap-1 ${pref === opt ? "segmented-item-active" : ""}`}
                aria-pressed={pref === opt}
                title={label}
              >
                <I size={13} />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="segmented" role="group" aria-label="Dil">
          <button
            onClick={() => setLang("tr")}
            className={`segmented-item ${lang === "tr" ? "segmented-item-active" : ""}`}
            aria-pressed={lang === "tr"}
          >
            TR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`segmented-item ${lang === "en" ? "segmented-item-active" : ""}`}
            aria-pressed={lang === "en"}
          >
            EN
          </button>
        </div>
        <button onClick={logout} className="nav-link w-full text-ink-500 hover:text-ink-900">
          <Icon.Logout size={18} className="text-ink-400" />
          <span>{t.nav.logout}</span>
        </button>
      </div>
    </aside>
  );
}
