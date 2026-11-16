"use client";

import { useMemo } from "react";
import { chartLayout, isDeciduous, phaseColor, phaseTint } from "@/lib/plan/fdi";

/**
 * Line-drawn FDI chart. Treated teeth are tinted with their phase colour;
 * a tooth treated in several phases gets its first phase's colour and a
 * small dot per extra phase. Clicking a tooth toggles a filter.
 */
export function FDIChart({
  treated,
  phaseOrder,
  selected,
  onSelect,
  label,
}: {
  treated: Map<number, string[]>;
  phaseOrder: Map<string, number>;
  selected?: number | null;
  onSelect?: (fdi: number | null) => void;
  label: string;
}) {
  const withDeciduous = useMemo(() => [...treated.keys()].some(isDeciduous), [treated]);
  const layout = useMemo(() => chartLayout(withDeciduous), [withDeciduous]);
  const pad = 4;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
      className="h-auto w-full select-none"
      role="group"
      aria-label={label}
    >
      {/* midlines */}
      <line x1={layout.midX} x2={layout.midX} y1={-2} y2={layout.height + 2} stroke="var(--rule-strong)" strokeWidth={0.3} strokeDasharray="1 1.4" />
      <line x1={-2} x2={layout.width + 2} y1={layout.midY} y2={layout.midY} stroke="var(--rule-strong)" strokeWidth={0.3} strokeDasharray="1 1.4" />
      {layout.teeth.map((t) => {
        const phases = treated.get(t.fdi) ?? [];
        const orders = phases.map((p) => phaseOrder.get(p) ?? 0);
        const isTreated = orders.length > 0;
        const isSel = selected === t.fdi;
        const color = isTreated ? phaseColor(orders[0]) : "var(--ink)";
        return (
          <g
            key={t.fdi}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect && isTreated ? 0 : -1}
            aria-label={`${t.fdi}`}
            aria-pressed={onSelect ? isSel : undefined}
            onClick={onSelect && isTreated ? () => onSelect(isSel ? null : t.fdi) : undefined}
            onKeyDown={
              onSelect && isTreated
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSel ? null : t.fdi);
                    }
                  }
                : undefined
            }
            className={onSelect && isTreated ? "cursor-pointer outline-none [&:focus-visible_path]:stroke-[0.9]" : undefined}
          >
            <path
              d={t.crown}
              fill={isTreated ? phaseTint(orders[0]) : "var(--surface)"}
              stroke={isTreated ? color : "var(--ink-3)"}
              strokeWidth={isSel ? 0.9 : isTreated ? 0.55 : 0.35}
              style={{ transition: "fill 200ms, stroke-width 150ms" }}
            />
            {isTreated && <path d={t.crown} fill={color} fillOpacity={isSel ? 0.55 : 0.32} stroke="none" />}
            <path d={t.roots} fill="none" stroke={isTreated ? color : "var(--ink-3)"} strokeWidth={isTreated ? 0.5 : 0.3} strokeOpacity={isTreated ? 0.9 : 0.6} />
            <text
              x={t.cx}
              y={t.labelY}
              textAnchor="middle"
              fontSize={isDeciduous(t.fdi) ? 2.6 : 3}
              fontFamily="var(--font-mono)"
              fill={isTreated ? color : "var(--ink-3)"}
              fontWeight={isTreated ? 600 : 400}
            >
              {t.fdi}
            </text>
            {orders.slice(1).map((o, i) => (
              <circle key={i} cx={t.cx - ((orders.length - 2) * 1.6) / 2 + i * 1.6} cy={t.cy} r={0.6} fill={phaseColor(o)} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
