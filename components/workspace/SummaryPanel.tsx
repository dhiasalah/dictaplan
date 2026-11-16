"use client";

import type { TreatmentPlan } from "@/lib/ai/schema";
import { addDays, formatDuration, formatMoney, phaseTotals, planTotal, sortedPhases, totalDurationDays } from "@/lib/plan/compute";
import { phaseColor } from "@/lib/plan/fdi";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/primitives";
import { today } from "@/lib/client/api";

function fmt(iso: string, months: string[], lang: "fr" | "en") {
  const [y, m, d] = iso.split("-").map(Number);
  return lang === "fr" ? `${d} ${months[m - 1]} ${y}` : `${months[m - 1]} ${d}, ${y}`;
}

/** Live totals + a miniature of the PDF's first page. */
export function SummaryPanel({ plan }: { plan: TreatmentPlan }) {
  const t = useT();
  const lang = useStore((s) => s.uiLang);
  const setStep = useStore((s) => s.setStep);
  const practice = useStore((s) => s.practice);
  const phases = sortedPhases(plan);
  const total = planTotal(plan);
  const days = totalDurationDays(plan);
  const start = plan.startDate ?? today();

  return (
    <div className="space-y-6">
      <section>
        <h2 className="eyebrow mb-3">{t.summary.title}</h2>
        <ul className="space-y-2 border-b border-rule pb-3">
          {phases.map((ph) => (
            <li key={ph.id} className="flex items-baseline gap-2 text-[13px]">
              <span className="size-2 shrink-0 translate-y-[-1px] rounded-[2px]" style={{ background: phaseColor(ph.order) }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{ph.title}</span>
              <span className="num text-ink">{formatMoney(phaseTotals(ph).total, lang)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[13px] text-ink-2">{t.plan.total}</span>
          <span className="num text-[26px] tracking-tight text-accent">{formatMoney(total.total, lang)}</span>
        </div>
        {total.missingPrices > 0 && (
          <p className="mt-1 text-right text-[12px] text-warn">
            {total.missingPrices} {t.summary.missing}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[12px]">
          <dt className="text-ink-3">{t.plan.duration}</dt>
          <dd className="num text-right">{formatDuration(days, lang)}</dd>
          <dt className="text-ink-3">{t.summary.start}</dt>
          <dd className="num text-right">{fmt(start, t.months, lang)}</dd>
          <dt className="text-ink-3">{t.summary.end}</dt>
          <dd className="num text-right">{fmt(addDays(start, days), t.months, lang)}</dd>
        </dl>
      </section>

      <section>
        <h2 className="eyebrow mb-3">{t.summary.preview}</h2>
        <button
          type="button"
          onClick={() => setStep("export")}
          className="group block w-full rounded-[4px] border border-rule bg-white p-4 text-left shadow-[0_1px_2px_rgba(22,24,29,0.04),0_8px_24px_-12px_rgba(22,24,29,0.12)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
          aria-label={t.summary.preview}
          style={{ aspectRatio: "210 / 297" }}
        >
          <div className="flex items-start justify-between border-b border-rule pb-1.5">
            <span className="truncate text-[7px] font-semibold">{practice.name || "—"}</span>
            <span className="text-[6px] text-ink-3">{practice.dentist}</span>
          </div>
          <p className="mt-3 font-serif text-[17px] leading-none">{t.pdf.title}</p>
          <p className="mt-1 truncate text-[6.5px] text-ink-2">{plan.patient.name ?? plan.patient.reference ?? "—"}</p>
          <div className="mt-2.5 grid grid-cols-3 border-y border-rule py-1.5">
            <span className="num text-[10px]">{phases.length}</span>
            <span className="num border-l border-rule pl-1 text-[10px]">{formatDuration(days, plan.language)}</span>
            <span className="num truncate border-l border-rule pl-1 text-[10px] text-accent">{formatMoney(total.total, plan.language)}</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {phases.slice(0, 4).map((ph) => (
              <div key={ph.id}>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-[2px]" style={{ background: phaseColor(ph.order) }} />
                  <span className="truncate font-serif text-[8.5px]">{ph.title}</span>
                </div>
                {ph.procedures.slice(0, 3).map((p) => (
                  <div key={p.id} className="mt-0.5 flex justify-between border-b border-rule/70 pb-0.5 text-[5.5px] text-ink-2">
                    <span className="truncate">{p.label}</span>
                    <span className="num">{p.unitPrice != null ? (p.unitPrice * p.quantity).toFixed(0) : "—"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-accent opacity-0 transition-opacity group-hover:opacity-100">
            {t.steps.export} <Icon.Arrow size={10} />
          </span>
        </button>
      </section>
    </div>
  );
}
