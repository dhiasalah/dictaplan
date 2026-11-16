import { nanoid } from "nanoid";
import {
  isValidFDI,
  TreatmentPlanSchema,
  type ClarifyQuestion,
  type Lang,
  type LLMPlan,
  type Phase,
  type TreatmentPlan,
} from "./schema";
import { applyPlanPatch } from "@/lib/plan/patch";

const s = (v: string | null | undefined) => (v == null || v.trim() === "" ? undefined : v.trim());

/**
 * Turn the lenient LLM output into a strict, valid TreatmentPlan.
 * - keeps LLM ids when present and unique (patches reference them)
 * - drops invalid FDI numbers
 * - dry-runs every option patch; an option whose patch fails keeps an empty patch,
 *   which the UI resolves through a refine call instead
 */
export function normalizeLLMPlan(
  raw: LLMPlan,
  base: { id?: string; createdAt?: string; transcript: string; language: Lang; keepQuestions?: ClarifyQuestion[] },
): TreatmentPlan {
  const used = new Set<string>();
  const uid = (preferred: string | null | undefined, prefix: string) => {
    let id = s(preferred);
    if (!id || used.has(id)) id = `${prefix}_${nanoid(6)}`;
    used.add(id);
    return id;
  };

  const phases: Phase[] = raw.phases.map((ph, i) => ({
    id: uid(ph.id, "ph"),
    title: ph.title.trim() || `Phase ${i + 1}`,
    order: i,
    delayFromPreviousDays:
      i === 0 ? Math.max(0, Math.round(ph.delayFromPreviousDays ?? 0)) : ph.delayFromPreviousDays == null ? null : Math.max(0, Math.round(ph.delayFromPreviousDays)),
    estimatedSessions: ph.estimatedSessions && ph.estimatedSessions > 0 ? Math.round(ph.estimatedSessions) : undefined,
    notes: s(ph.notes),
    procedures: ph.procedures.map((p) => {
      const teeth = [...new Set((p.teeth ?? []).map(Number).filter(isValidFDI))];
      const unitPrice = p.unitPrice == null || Number.isNaN(p.unitPrice) || p.unitPrice < 0 ? null : p.unitPrice;
      return {
        id: uid(p.id, "pr"),
        label: p.label.trim(),
        code: s(p.code),
        teeth,
        quantity: p.quantity && p.quantity > 0 ? p.quantity : Math.max(1, teeth.length),
        unitPrice,
        priceSource: unitPrice == null ? "missing" : p.priceSource && p.priceSource !== "missing" ? p.priceSource : "list",
        notes: s(p.notes),
      };
    }),
  }));

  const age = raw.patient?.age;
  const plan: TreatmentPlan = {
    id: base.id ?? nanoid(10),
    createdAt: base.createdAt ?? new Date().toISOString(),
    patient: {
      name: s(raw.patient?.name),
      age: age != null && Number.isFinite(age) && age >= 0 && age < 130 ? Math.round(age) : undefined,
      reference: s(raw.patient?.reference),
    },
    startDate: s(raw.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate!.trim()) ? raw.startDate!.trim() : undefined,
    phases,
    questions: [],
    generalNotes: s(raw.generalNotes),
    transcript: base.transcript,
    language: base.language,
    status: "draft",
  };

  const kept = base.keepQuestions ?? [];
  const room = Math.max(0, 5 - kept.length);
  const questions: ClarifyQuestion[] = (raw.questions ?? [])
    .filter((q) => q.question.trim() && q.options.length > 0)
    .slice(0, room)
    .map((q) => ({
      id: uid(q.id, "q"),
      question: q.question.trim(),
      allowCustom: q.allowCustom ?? true,
      options: q.options.slice(0, 4).map((o) => {
        const patch = o.patch ?? [];
        const dry = patch.length === 0 ? null : applyPlanPatch(plan, patch);
        const ok = !dry || dry.ok;
        if (dry && !dry.ok && process.env.NODE_ENV !== "production") {
          console.warn("[normalize] option patch rejected:", o.label, dry.error, JSON.stringify(patch).slice(0, 400));
        }
        return ok ? { label: o.label.trim(), patch } : { label: o.label.trim(), patch: [], refine: true };
      }),
    }));

  plan.questions = [...kept, ...questions];
  return TreatmentPlanSchema.parse(plan);
}
