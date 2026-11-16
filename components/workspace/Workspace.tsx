"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCurrentPlan, useStore, type Step } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cx, Icon } from "@/components/ui/primitives";
import { DictateStep } from "@/components/transcript/DictateStep";
import { ClarifyStep } from "@/components/clarify/ClarifyStep";
import { ReviewStep } from "@/components/plan/ReviewStep";
import { ExportStep, downloadBlob, pdfFileName, renderPlanPdf } from "@/components/pdf/ExportStep";
import { SummaryPanel } from "./SummaryPanel";

const STEPS: Step[] = ["dictate", "clarify", "review", "export"];

export function Workspace() {
  const t = useT();
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const newPlan = useStore((s) => s.newPlan);
  const practice = useStore((s) => s.practice);
  const hydrated = useStore((s) => s.hydrated);
  const plan = useCurrentPlan();
  const reduce = useReducedMotion();

  // a step that needs a plan falls back to dictation
  const current: Step = plan || step === "dictate" ? step : "dictate";
  const openQuestions = plan?.questions.filter((q) => !q.answered).length ?? 0;

  // Ctrl/⌘+P → export PDF
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        const s = useStore.getState();
        const p = s.currentId ? s.plans[s.currentId] : null;
        if (!p) return;
        e.preventDefault();
        s.setStep("export");
        downloadBlob(await renderPlanPdf(p, s.practice), pdfFileName(p));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showSummary = !!plan && current !== "dictate" && current !== "export";
  const needsOnboarding = hydrated && !practice.name && !practice.dentist;

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-24 pt-8 md:px-8">
      {needsOnboarding && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-rule bg-surface px-4 py-3 text-[13px]">
          <span className="text-ink-2">{t.settings.onboarding}</span>
          <Link href="/settings" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
            {t.nav.settings} <Icon.Arrow size={14} />
          </Link>
        </div>
      )}
      <div className={cx("grid gap-10", showSummary ? "lg:grid-cols-[170px_minmax(0,1fr)_280px]" : "lg:grid-cols-[170px_minmax(0,1fr)]")}>
        {/* stepper */}
        <nav aria-label="Étapes" className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
            {STEPS.map((s, i) => {
              const enabled = s === "dictate" || !!plan;
              const active = current === s;
              const done = STEPS.indexOf(current) > i;
              return (
                <li key={s} className="relative shrink-0">
                  {i > 0 && <span aria-hidden className="absolute -top-2 left-[11px] hidden h-4 w-px bg-rule lg:block" />}
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => setStep(s)}
                    aria-current={active ? "step" : undefined}
                    className={cx(
                      "group flex w-full items-start gap-3 rounded-[6px] px-0 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 lg:py-3",
                      "pr-3",
                    )}
                  >
                    <span
                      className={cx(
                        "num grid size-6 shrink-0 place-items-center rounded-full border text-[11px] transition-colors duration-200",
                        active ? "border-ink bg-ink text-white" : done ? "border-accent text-accent" : "border-rule-strong text-ink-2",
                      )}
                    >
                      {done ? <Icon.Check size={12} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cx("block text-[14px] leading-6", active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink")}>
                        {t.steps[s]}
                        {s === "clarify" && openQuestions > 0 && <span className="num ml-1.5 text-[11px] text-warn">{openQuestions}</span>}
                      </span>
                      <span className="hidden text-[12px] leading-tight text-ink-3 lg:block">{t.stepHints[s]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {plan && (
            <button
              type="button"
              onClick={newPlan}
              className="mt-6 hidden items-center gap-1.5 text-[13px] text-ink-2 hover:text-accent lg:inline-flex"
            >
              <Icon.Plus size={14} /> {t.plan.newPlan}
            </button>
          )}
        </nav>

        {/* current step */}
        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {current === "dictate" && <DictateStep />}
              {current === "clarify" && <ClarifyStep />}
              {current === "review" && <ReviewStep />}
              {current === "export" && <ExportStep />}
            </motion.div>
          </AnimatePresence>
        </main>

        {showSummary && plan && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SummaryPanel plan={plan} />
          </aside>
        )}
      </div>
    </div>
  );
}
