"use client";

import { useMemo, useState } from "react";
import { Reorder } from "motion/react";
import { useCurrentPlan, useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { schedule, sortedPhases, teethByPhase } from "@/lib/plan/compute";
import { FDIChart } from "@/components/tooth-chart/FDIChart";
import { Timeline } from "./Timeline";
import { PhaseCard } from "./PhaseCard";
import { EditBar } from "./EditBar";
import { addPhase, reorderPhases } from "./editing";
import { Button, Icon, Input, Label, Textarea } from "@/components/ui/primitives";
import { StepHeading } from "@/components/transcript/DictateStep";
import { today } from "@/lib/client/api";

export function ReviewStep() {
  const t = useT();
  const plan = useCurrentPlan();
  const update = useStore((s) => s.updateCurrent);
  const setStep = useStore((s) => s.setStep);
  const priceList = useStore((s) => s.priceList);
  const [tooth, setTooth] = useState<number | null>(null);

  const phases = useMemo(() => (plan ? sortedPhases(plan) : []), [plan]);
  const sched = useMemo(() => (plan ? schedule(plan) : []), [plan]);
  const treated = useMemo(() => (plan ? teethByPhase(plan) : new Map()), [plan]);
  const phaseOrder = useMemo(() => new Map(phases.map((p) => [p.id, p.order])), [phases]);
  if (!plan) return null;

  const visible = tooth == null ? phases : phases.filter((p) => p.procedures.some((x) => x.teeth.includes(tooth)));

  return (
    <div>
      <StepHeading eyebrow={`03 · ${t.steps.review}`} title={t.plan.title}>
        <Button variant="primary" onClick={() => setStep("export")}>
          {t.steps.export} <Icon.Arrow />
        </Button>
      </StepHeading>

      {/* patient strip */}
      <div className="mb-8 grid gap-4 border-y border-rule py-4 sm:grid-cols-[2fr_80px_1fr_1fr]">
        <div>
          <Label htmlFor="pname">{t.plan.patientName}</Label>
          <Input
            id="pname"
            value={plan.patient.name ?? ""}
            onChange={(e) => update((p) => ({ ...p, patient: { ...p.patient, name: e.target.value || undefined } }))}
          />
        </div>
        <div>
          <Label htmlFor="page">{t.plan.age}</Label>
          <Input
            id="page"
            inputMode="numeric"
            className="num"
            value={plan.patient.age ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              update((p) => ({ ...p, patient: { ...p.patient, age: Number.isFinite(n) && n >= 0 && n < 130 ? n : undefined } }));
            }}
          />
        </div>
        <div>
          <Label htmlFor="pref">{t.plan.reference}</Label>
          <Input
            id="pref"
            value={plan.patient.reference ?? ""}
            onChange={(e) => update((p) => ({ ...p, patient: { ...p.patient, reference: e.target.value || undefined } }))}
          />
        </div>
        <div>
          <Label htmlFor="pstart">{t.plan.startDate}</Label>
          <Input
            id="pstart"
            type="date"
            className="num"
            value={plan.startDate ?? today()}
            onChange={(e) => update((p) => ({ ...p, startDate: e.target.value || undefined }))}
          />
        </div>
      </div>

      {/* chart + timeline */}
      <div className="mb-8 grid gap-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="eyebrow">{t.plan.teeth}</h2>
            {tooth != null && (
              <button onClick={() => setTooth(null)} className="text-[12px] text-accent underline-offset-4 hover:underline">
                {t.plan.filterTooth} {tooth} · {t.plan.clearFilter}
              </button>
            )}
          </div>
          <div className="rounded-[10px] border border-rule bg-surface px-6 py-6 md:px-10">
            <FDIChart treated={treated} phaseOrder={phaseOrder} selected={tooth} onSelect={setTooth} label={t.plan.teeth} />
          </div>
        </div>
        <div>
          <h2 className="eyebrow mb-2">{t.pdf.timeline}</h2>
          <div className="rounded-[10px] border border-rule bg-surface px-5 pb-5 pt-6">
            <Timeline plan={plan} weekLabel={t.pdf.week} monthLabel={t.pdf.month} />
          </div>
        </div>
      </div>

      <datalist id="price-list-labels">
        {priceList.map((p) => (
          <option key={p.id} value={plan.language === "en" && p.labelEn ? p.labelEn : p.label} />
        ))}
      </datalist>

      <Reorder.Group axis="y" values={phases.map((p) => p.id)} onReorder={(ids) => update((p) => reorderPhases(p, ids))} className="space-y-4">
        {visible.map((ph, i) => (
          <PhaseCard
            key={ph.id}
            plan={plan}
            phase={ph}
            index={i}
            offsetDays={sched.find((s) => s.phaseId === ph.id)?.offsetDays ?? 0}
            toothFilter={tooth}
          />
        ))}
      </Reorder.Group>

      {tooth == null && (
        <button
          type="button"
          onClick={() => update((p) => addPhase(p, `${t.plan.phase} ${p.phases.length + 1} · `))}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-rule-strong py-4 text-[13px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
        >
          <Icon.Plus size={14} /> {t.plan.addPhase}
        </button>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="gnotes">{t.plan.generalNotes}</Label>
          <Textarea
            id="gnotes"
            rows={3}
            value={plan.generalNotes ?? ""}
            onChange={(e) => update((p) => ({ ...p, generalNotes: e.target.value || undefined }))}
          />
        </div>
        <div>
          <Label htmlFor="secu">{t.pdf.secu} (€)</Label>
          <Input
            id="secu"
            inputMode="decimal"
            className="num"
            placeholder="—"
            value={plan.insuranceShare ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".");
              const n = Number(v);
              update((p) => ({ ...p, insuranceShare: v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n }));
            }}
          />
        </div>
      </div>

      <EditBar />
    </div>
  );
}
