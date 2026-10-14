export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Bir kart iskeleti: başlık + birkaç satır */
export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card card-pad ${className}`} aria-busy="true">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-7 w-32 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 mb-2 ${i % 3 === 0 ? "w-5/6" : i % 3 === 1 ? "w-2/3" : "w-1/2"}`} />
      ))}
    </div>
  );
}

/** KPI satırı iskeleti (4 küçük kart) */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card card-pad">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-16 mb-2" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Tablo iskeleti */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 pt-2 border-t border-ink-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 flex-1 ${c === 0 ? "max-w-[40%]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
