export function PlanSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="mb-4 flex items-center gap-2 text-[13px] text-ink-2">
        <span className="inline-block size-1.5 rounded-full bg-accent" style={{ animation: "breathe 1.4s ease-in-out infinite" }} />
        {label}
      </p>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[10px] border border-rule bg-surface p-5" style={{ opacity: 1 - i * 0.22 }}>
            <div className="skeleton mb-4 h-5 w-48" />
            <div className="space-y-2.5">
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-[86%]" />
              <div className="skeleton h-3.5 w-[64%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
