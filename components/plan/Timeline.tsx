"use client";

import type { TreatmentPlan } from "@/lib/ai/schema";
import { phaseSpans, sortedPhases } from "@/lib/plan/compute";
import { phaseColor } from "@/lib/plan/fdi";

/** Ruler-style timeline: weeks as ticks, months labelled, phases as thin bars. */
export function Timeline({ plan, weekLabel, monthLabel }: { plan: TreatmentPlan; weekLabel: string; monthLabel: string }) {
  const phases = sortedPhases(plan);
  const spans = phaseSpans(plan);
  if (phases.length === 0) return null;
  const total = Math.max(28, ...spans.map((s) => s.end));
  const weeks = Math.ceil(total / 7);
  const useMonths = weeks > 16;
  const pct = (d: number) => `${(d / (weeks * 7)) * 100}%`;

  return (
    <div className="w-full">
      <div className="relative h-7 border-b border-ink/70">
        {Array.from({ length: weeks + 1 }, (_, w) => {
          const step = useMonths ? 4 : weeks > 8 ? 2 : 1;
          const major = w % step === 0;
          return (
            <div key={w} className="absolute bottom-0" style={{ left: pct(w * 7) }}>
              <div className={`w-px bg-ink/70 ${major ? "h-2.5" : "h-1.5"}`} />
              {major && (
                <span className="num absolute bottom-3 -translate-x-1/2 text-[10px] text-ink-3">
                  {useMonths ? `${monthLabel}${w / 4}` : `${weekLabel}${w}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative mt-3 space-y-1.5">
        {phases.map((ph) => {
          const s = spans.find((x) => x.phaseId === ph.id)!;
          const labelLeft = s.end / (weeks * 7) > 0.6;
          return (
            <div key={ph.id} className="relative h-5">
              <div
                className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-[2px]"
                style={{ left: pct(s.start), width: `max(6px, ${pct(s.end - s.start)})`, background: phaseColor(ph.order), transition: "left 250ms ease-out, width 250ms ease-out" }}
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 truncate text-[11px] text-ink-2 ${labelLeft ? "pr-2 text-right" : "pl-2"}`}
                style={labelLeft ? { right: `calc(100% - ${pct(s.start)})`, maxWidth: "55%" } : { left: pct(s.end), maxWidth: "55%" }}
              >
                {ph.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
