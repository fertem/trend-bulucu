"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/", label: "Genel Bakış" },
  { href: "/chat", label: "🤖 AI Sohbet" },
  { href: "/explorer", label: "Keşif" },
  { href: "/opportunities", label: "Fırsatlar" },
  { href: "/categories", label: "Kategoriler" },
  { href: "/alerts", label: "Uyarılar" },
  { href: "/seo", label: "🎯 SEO Derinliği" },
  { href: "/admin", label: "Yönetim" },
  { href: "/setup", label: "Kurulum" },
  { href: "/settings", label: "Ayarlar" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <aside className="w-56 shrink-0 border-r border-ink-200 bg-white min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-ink-200">
        <div className="text-base font-semibold text-ink-900">1e1kod</div>
        <div className="text-xs text-ink-500 mt-0.5">Trend Paneli</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm transition ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-ink-700 hover:bg-ink-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-ink-200">
        <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition">
          Çıkış yap
        </button>
      </div>
    </aside>
  );
}
