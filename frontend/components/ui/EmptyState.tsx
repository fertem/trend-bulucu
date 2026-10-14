import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Boş durum: ikon + başlık + açıklama + (opsiyonel) aksiyon.
 * Küçük varyant (compact) kart içinde, büyük varyant sayfa ortasında kullanılır.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
  className?: string;
}) {
  const pad = compact ? "py-6" : "py-12";
  return (
    <div className={`flex flex-col items-center text-center ${pad} px-4 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-full bg-ink-100 text-ink-400 mb-3 ${
          compact ? "w-9 h-9" : "w-12 h-12"
        }`}
      >
        {icon ?? <DefaultIcon />}
      </div>
      <div className={`font-medium text-ink-900 ${compact ? "text-sm" : "text-base"}`}>{title}</div>
      {description && (
        <p className={`text-ink-500 mt-1 max-w-sm ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
      )}
      {action && (
        action.href ? (
          <Link href={action.href} className="btn-primary btn-sm mt-4">{action.label}</Link>
        ) : (
          <button onClick={action.onClick} className="btn-primary btn-sm mt-4">{action.label}</button>
        )
      )}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M2 12h20" />
    </svg>
  );
}
