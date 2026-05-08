export function formatVolume(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return "0";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Backend naive UTC ISO döndürüyor (örn. "2026-05-08T12:30:00" — Z YOK).
 * JS bunu YEREL saat sanıyor → Türkiye'de UTC+3 → her şey 3 saat eski görünüyordu.
 * Bu helper Z suffix'i yoksa ekler ki JS UTC olarak yorumlasın.
 */
export function parseBackendDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const safe = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  return new Date(safe);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "henüz çekilmedi";
  const d = parseBackendDate(iso);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return d.toLocaleString("tr-TR");

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "az önce";
  if (min < 60) return `${min} dk önce`;
  if (hr < 24) return `${hr} saat önce`;
  if (day < 7) return `${day} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export function competitionLabel(c: string | null | undefined): { text: string; cls: string } {
  switch (c) {
    case "LOW":
      return { text: "Düşük rekabet", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
    case "MEDIUM":
      return { text: "Orta rekabet", cls: "bg-amber-50 text-amber-700 border border-amber-100" };
    case "HIGH":
      return { text: "Yüksek rekabet", cls: "bg-red-50 text-red-700 border border-red-100" };
    default:
      return { text: "—", cls: "bg-ink-100 text-ink-500 border border-ink-200" };
  }
}
