"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCurrentPlan, useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { answerQuestion, markAnswered } from "@/lib/plan/patch";
import { ApiError, refinePlan } from "@/lib/client/api";
import type { ClarifyQuestion } from "@/lib/ai/schema";
import { Button, Chip, Icon, Input } from "@/components/ui/primitives";
import { StepHeading } from "@/components/transcript/DictateStep";

export function ClarifyStep() {
  const t = useT();
  const plan = useCurrentPlan();
  const setStep = useStore((s) => s.setStep);
  const reduce = useReducedMotion();
  if (!plan) return null;

  const open = plan.questions.filter((q) => !q.answered).length;

  return (
    <div>
      <StepHeading eyebrow={`02 · ${t.steps.clarify}`} title={t.clarify.title}>
        {open > 0 && (
          <Button variant="ghost" onClick={() => setStep("review")}>
            {t.clarify.skipAll}
          </Button>
        )}
      </StepHeading>
      <p className="-mt-4 mb-8 max-w-[60ch] text-ink-2">{t.clarify.subtitle}</p>

      {plan.questions.length === 0 ? (
        <p className="text-ink-2">{t.clarify.none}</p>
      ) : (
        <ol className="space-y-3">
          {plan.questions.map((q, i) => (
            <motion.li
              key={q.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.22, ease: "easeOut" }}
            >
              <QuestionCard index={i + 1} q={q} />
            </motion.li>
          ))}
        </ol>
      )}

      <div className="mt-8 flex items-center gap-3 border-t border-rule pt-5">
        <Button variant="primary" size="lg" onClick={() => setStep("review")}>
          {t.clarify.continue} <Icon.Arrow />
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({ q, index }: { q: ClarifyQuestion; index: number }) {
  const t = useT();
  const updateCurrent = useStore((s) => s.updateCurrent);
  const priceList = useStore((s) => s.priceList);
  const [custom, setCustom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viaLLM = async (answer: string) => {
    const plan = useStore.getState().plans[useStore.getState().currentId!];
    setBusy(true);
    setError(null);
    try {
      const next = await refinePlan(plan, `${q.question} → ${answer}`, priceList);
      updateCurrent(() => markAnswered(next, q.id, answer));
      setCustom(null);
    } catch (e) {
      setError(e instanceof ApiError ? ((t.errors as Record<string, string>)[e.code] ?? t.errors.generic) : t.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const choose = (i: number) => {
    const opt = q.options[i];
    if (opt.refine) return viaLLM(opt.label);
    let failed = false;
    updateCurrent((p) => {
      const r = answerQuestion(p, q.id, i);
      if (!r.ok) failed = true;
      return r.ok ? r.plan : p;
    });
    if (failed) viaLLM(opt.label);
  };

  const answered = q.answered;

  return (
    <div className={`rounded-[10px] border bg-surface p-5 transition-colors duration-200 ${answered ? "border-rule" : "border-rule-strong"}`}>
      <div className="flex items-baseline gap-4">
        <span className="num w-5 shrink-0 text-[13px] text-ink-3">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <p className={`font-serif text-[22px] leading-snug ${answered ? "text-ink-2" : "text-ink"}`}>{q.question}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {q.options.map((o, i) => (
              <Chip key={i} selected={answered === o.label} disabled={busy || (!!answered && answered !== o.label)} onClick={() => !answered && choose(i)}>
                {answered === o.label && <Icon.Check size={14} className="-ml-1 mr-1.5" />}
                {o.label}
              </Chip>
            ))}
            {q.allowCustom && !answered && custom === null && (
              <Chip disabled={busy} onClick={() => setCustom("")} className="border-dashed">
                {t.clarify.other}
              </Chip>
            )}
            {answered && !q.options.some((o) => o.label === answered) && (
              <Chip selected disabled>
                <Icon.Check size={14} className="-ml-1 mr-1.5" />
                {answered}
              </Chip>
            )}
          </div>
          {custom !== null && !answered && (
            <form
              className="mt-3 flex max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim()) viaLLM(custom.trim());
              }}
            >
              <Input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t.clarify.otherPlaceholder} aria-label={t.clarify.otherPlaceholder} />
              <Button type="submit" variant="primary" disabled={busy || !custom.trim()}>
                {t.clarify.apply}
              </Button>
            </form>
          )}
          {busy && <p className="mt-3 text-[13px] text-accent">{t.clarify.updating}</p>}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-record">
              {error}
            </p>
          )}
        </div>
        {answered && <span className="eyebrow shrink-0 text-accent">{t.clarify.answered}</span>}
      </div>
    </div>
  );
}
