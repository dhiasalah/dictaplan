"use client";

import { useEffect, useState } from "react";
import { Reorder, useDragControls, motion, AnimatePresence } from "motion/react";
import type { Phase, Procedure, TreatmentPlan } from "@/lib/ai/schema";
import { formatDuration, formatMoney, offsetLabel, phaseTotals, procedureSubtotal } from "@/lib/plan/compute";
import { phaseColor } from "@/lib/plan/fdi";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cx, Icon } from "@/components/ui/primitives";
import { addProcedure, findPriceItem, parseMoney, parseTeeth, removePhase, removeProcedure, updatePhase, updateProcedure } from "./editing";

/** Text input that keeps a local draft while focused and commits on blur/Enter. */
function DraftInput({
  value,
  onCommit,
  className,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  return (
    <input
      {...rest}
      value={focused ? draft : value}
      onFocus={(e) => {
        setDraft(value);
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setTimeout(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={cx("field-quiet h-8 px-1.5", className)}
    />
  );
}

export function PhaseCard({
  plan,
  phase,
  offsetDays,
  toothFilter,
  index,
}: {
  plan: TreatmentPlan;
  phase: Phase;
  offsetDays: number;
  toothFilter: number | null;
  index: number;
}) {
  const t = useT();
  const lang = plan.language;
  const uiLang = useStore((s) => s.uiLang);
  const update = useStore((s) => s.updateCurrent);
  const priceList = useStore((s) => s.priceList);
  const controls = useDragControls();
  const totals = phaseTotals(phase);
  const color = phaseColor(phase.order);
  const procs = toothFilter == null ? phase.procedures : phase.procedures.filter((p) => p.teeth.includes(toothFilter));

  const setProc = (procId: string, fn: (p: Procedure) => Procedure) => update((pl) => updateProcedure(pl, phase.id, procId, fn));

  return (
    <Reorder.Item value={phase.id} dragListener={false} dragControls={controls} className="list-none" layout="position">
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.24, ease: "easeOut" }}
        className="group/phase relative rounded-[10px] border border-rule bg-surface"
      >
        <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-[2px]" style={{ background: color }} aria-hidden />
        <header className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 pb-3 pt-4 pl-6">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            className="mt-1.5 cursor-grab touch-none text-ink-3 hover:text-ink active:cursor-grabbing"
            aria-label={t.plan.dragHint}
            title={t.plan.dragHint}
          >
            <Icon.Grip />
          </button>
          <div className="min-w-0 flex-1">
            <DraftInput
              value={phase.title}
              onCommit={(v) => update((pl) => updatePhase(pl, phase.id, (p) => ({ ...p, title: v.trim() || p.title })))}
              aria-label={t.plan.phase}
              className="-ml-1.5 h-10 w-full font-serif text-[24px] leading-tight"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
              <span className="font-medium" style={{ color }}>
                {offsetLabel(offsetDays, uiLang)}
              </span>
              {phase.order > 0 && (
                <label className="flex items-center gap-1">
                  <span className="text-ink-3">{t.plan.interval}</span>
                  <DraftInput
                    value={phase.delayFromPreviousDays == null ? "" : String(phase.delayFromPreviousDays)}
                    onCommit={(v) =>
                      update((pl) =>
                        updatePhase(pl, phase.id, (p) => {
                          const n = parseInt(v, 10);
                          return { ...p, delayFromPreviousDays: Number.isFinite(n) && n >= 0 ? n : null };
                        }),
                      )
                    }
                    inputMode="numeric"
                    aria-label={t.plan.interval}
                    className="num h-6 w-12 text-right"
                    placeholder="—"
                  />
                  <span className="text-ink-3">
                    {t.plan.days}
                    {phase.delayFromPreviousDays != null && phase.delayFromPreviousDays >= 14 && ` · ${formatDuration(phase.delayFromPreviousDays, uiLang)}`}
                  </span>
                </label>
              )}
              <label className="flex items-center gap-1">
                <DraftInput
                  value={phase.estimatedSessions ? String(phase.estimatedSessions) : ""}
                  onCommit={(v) =>
                    update((pl) =>
                      updatePhase(pl, phase.id, (p) => {
                        const n = parseInt(v, 10);
                        return { ...p, estimatedSessions: Number.isFinite(n) && n > 0 ? n : undefined };
                      }),
                    )
                  }
                  inputMode="numeric"
                  aria-label={t.plan.sessions}
                  className="num h-6 w-8 text-right"
                  placeholder="—"
                />
                <span className="text-ink-3">{t.plan.sessions}</span>
              </label>
            </div>
          </div>
          <div className="text-right">
            <p className="eyebrow">{t.plan.phaseTotal}</p>
            <p className="num text-[18px]">{formatMoney(totals.total, uiLang)}</p>
          </div>
          <button
            type="button"
            onClick={() => update((pl) => removePhase(pl, phase.id))}
            className="mt-1 text-ink-3 opacity-0 transition-opacity hover:text-record focus:opacity-100 group-hover/phase:opacity-100"
            aria-label={t.plan.removePhase}
            title={t.plan.removePhase}
          >
            <Icon.Trash />
          </button>
        </header>

        <div className="overflow-x-auto px-5 pl-6">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <thead>
              <tr className="border-y border-rule text-left text-[11px] uppercase tracking-[0.08em] text-ink-3">
                <th className="py-2 pr-2 font-medium">{t.plan.procedure}</th>
                <th className="w-[120px] py-2 pr-2 font-medium">{t.plan.teeth}</th>
                <th className="w-[56px] py-2 pr-2 text-right font-medium">{t.plan.qty}</th>
                <th className="w-[104px] py-2 pr-2 text-right font-medium">{t.plan.unitPrice}</th>
                <th className="w-[104px] py-2 text-right font-medium">{t.plan.subtotal}</th>
                <th className="w-7" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {procs.map((p) => (
                  <motion.tr
                    key={p.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group/row border-b border-rule/70 align-middle"
                  >
                    <td className="py-1 pr-2">
                      <DraftInput
                        value={p.label}
                        list="price-list-labels"
                        placeholder={t.plan.procedure}
                        aria-label={t.plan.procedure}
                        onCommit={(v) =>
                          setProc(p.id, (x) => {
                            const item = findPriceItem(priceList, v);
                            if (item) {
                              const label = lang === "en" && item.labelEn ? item.labelEn : item.label;
                              return { ...x, label, code: item.code, unitPrice: item.price, priceSource: "list" };
                            }
                            return { ...x, label: v.trim() || x.label };
                          })
                        }
                        className="-ml-1.5 w-full"
                      />
                      {p.code && <span className="num ml-0 block pl-0 text-[10px] text-ink-3">{p.code}</span>}
                    </td>
                    <td className="py-1 pr-2">
                      <DraftInput
                        value={p.teeth.join(" ")}
                        placeholder={t.plan.noTeeth}
                        aria-label={t.plan.teeth}
                        onCommit={(v) =>
                          setProc(p.id, (x) => {
                            const teeth = parseTeeth(v);
                            const item = priceList.find((i) => i.label === x.label || i.labelEn === x.label);
                            // per-tooth items follow the tooth count
                            const quantity = item?.perTooth && teeth.length > 0 ? teeth.length : x.quantity;
                            return { ...x, teeth, quantity };
                          })
                        }
                        className="num -ml-1.5 w-full placeholder:font-sans placeholder:text-[12px]"
                      />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <DraftInput
                        value={String(p.quantity)}
                        inputMode="numeric"
                        aria-label={t.plan.qty}
                        onCommit={(v) =>
                          setProc(p.id, (x) => {
                            const n = Number(v.replace(",", "."));
                            return { ...x, quantity: Number.isFinite(n) && n > 0 ? n : x.quantity };
                          })
                        }
                        className="num w-full text-right"
                      />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <DraftInput
                        value={p.unitPrice == null ? "" : p.unitPrice.toFixed(2)}
                        inputMode="decimal"
                        placeholder={t.plan.missingPrice}
                        aria-label={t.plan.unitPrice}
                        onCommit={(v) => setProc(p.id, (x) => {
                          const n = parseMoney(v);
                          return { ...x, unitPrice: n, priceSource: n == null ? "missing" : "manual" };
                        })}
                        className={cx("num w-full text-right", p.unitPrice == null && "border-warn/50 bg-warn-soft placeholder:text-[11px] placeholder:text-warn")}
                      />
                    </td>
                    <td className="num py-1 text-right">{formatMoney(procedureSubtotal(p), uiLang)}</td>
                    <td className="py-1 pl-1 text-right">
                      <button
                        type="button"
                        onClick={() => update((pl) => removeProcedure(pl, phase.id, p.id))}
                        className="text-ink-3 opacity-0 transition-opacity hover:text-record focus:opacity-100 group-hover/row:opacity-100"
                        aria-label={t.plan.removeProcedure}
                      >
                        <Icon.Close size={14} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-2 pl-6">
          {toothFilter == null && (
            <button
              type="button"
              onClick={() => update((pl) => addProcedure(pl, phase.id))}
              className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-accent"
            >
              <Icon.Plus size={14} /> {t.plan.addProcedure}
            </button>
          )}
          <DraftInput
            value={phase.notes ?? ""}
            placeholder={`${t.plan.notes}…`}
            aria-label={t.plan.notes}
            onCommit={(v) => update((pl) => updatePhase(pl, phase.id, (p) => ({ ...p, notes: v.trim() || undefined })))}
            className="ml-auto min-w-0 flex-1 text-[13px] italic text-ink-2 sm:max-w-[50%]"
          />
          {totals.missingPrices > 0 && <span className="text-[12px] text-warn">{totals.missingPrices} × {t.plan.missingPrice.toLowerCase()}</span>}
        </footer>
      </motion.article>
    </Reorder.Item>
  );
}
