"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentPlan, useStore } from "@/lib/store";
import { useT, DICTS } from "@/lib/i18n";
import { Button, Icon } from "@/components/ui/primitives";
import { StepHeading } from "@/components/transcript/DictateStep";
import type { TreatmentPlan } from "@/lib/ai/schema";
import type { Practice } from "@/lib/store";

/** Renders the PDF in the browser (react-pdf is loaded lazily, only on this step). */
export async function renderPlanPdf(plan: TreatmentPlan, practice: Practice): Promise<Blob> {
  const [{ pdf }, { PlanDocument, registerPdfFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./PlanDocument")]);
  registerPdfFonts(window.location.origin);
  return pdf(<PlanDocument plan={plan} practice={practice} t={DICTS[plan.language]} />).toBlob();
}

export function pdfFileName(plan: TreatmentPlan): string {
  const who = (plan.patient.reference || plan.patient.name || plan.id.slice(0, 6))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = (plan.updatedAt ?? plan.createdAt).slice(0, 10);
  return `${plan.language === "fr" ? "plan-de-traitement" : "treatment-plan"}_${who}_${date}.pdf`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function ExportStep() {
  const t = useT();
  const plan = useCurrentPlan();
  const practice = useStore((s) => s.practice);
  const setStep = useStore((s) => s.setStep);
  const update = useStore((s) => s.updateCurrent);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  // re-render (debounced) whenever the plan or practice changes
  const planKey = plan ? JSON.stringify({ ...plan, updatedAt: undefined, status: undefined }) : "";
  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const b = await renderPlanPdf(plan, practice);
        if (cancelled) return;
        const u = URL.createObjectURL(b);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = u;
        setBlob(b);
        setUrl(u);
        setError(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(true);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, practice]);

  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), []);

  if (!plan) return null;

  return (
    <div>
      <StepHeading eyebrow={`04 · ${t.steps.export}`} title={t.export.title}>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setStep("review")}>
            <Icon.Back /> {t.export.back}
          </Button>
          <Button
            variant={plan.status === "final" ? "secondary" : "ghost"}
            onClick={() => update((p) => ({ ...p, status: p.status === "final" ? "draft" : "final" }))}
            aria-pressed={plan.status === "final"}
          >
            {plan.status === "final" && <Icon.Check />} {plan.status === "final" ? t.export.finalized : t.export.finalize}
          </Button>
          <Button variant="primary" disabled={!blob} onClick={() => blob && downloadBlob(blob, pdfFileName(plan))}>
            <Icon.Download /> {t.export.download}
          </Button>
        </div>
      </StepHeading>

      <p role="note" className="mb-6 flex max-w-[80ch] items-start gap-2 rounded-[6px] border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
        {t.export.check}
      </p>

      <div className="relative overflow-hidden rounded-[10px] border border-rule bg-[#e9e6df]" style={{ height: "min(1100px, 80vh)" }}>
        {url ? (
          <iframe key={url} src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={t.summary.preview} className="h-full w-full" />
        ) : (
          <div className="grid h-full place-items-center text-[13px] text-ink-2">{error ? t.errors.generic : t.export.rendering}</div>
        )}
      </div>
    </div>
  );
}
