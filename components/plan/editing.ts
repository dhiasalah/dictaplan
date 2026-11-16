import { nanoid } from "nanoid";
import { isValidFDI, type Phase, type Procedure, type TreatmentPlan } from "@/lib/ai/schema";
import type { PriceItem } from "@/lib/seed/price-list.fr";

export function updatePhase(plan: TreatmentPlan, phaseId: string, fn: (p: Phase) => Phase): TreatmentPlan {
  return { ...plan, phases: plan.phases.map((p) => (p.id === phaseId ? fn(p) : p)) };
}

export function updateProcedure(plan: TreatmentPlan, phaseId: string, procId: string, fn: (p: Procedure) => Procedure): TreatmentPlan {
  return updatePhase(plan, phaseId, (ph) => ({ ...ph, procedures: ph.procedures.map((p) => (p.id === procId ? fn(p) : p)) }));
}

export function removeProcedure(plan: TreatmentPlan, phaseId: string, procId: string): TreatmentPlan {
  return updatePhase(plan, phaseId, (ph) => ({ ...ph, procedures: ph.procedures.filter((p) => p.id !== procId) }));
}

export function addProcedure(plan: TreatmentPlan, phaseId: string): TreatmentPlan {
  const proc: Procedure = { id: `pr_${nanoid(6)}`, label: "", teeth: [], quantity: 1, unitPrice: null, priceSource: "missing" };
  return updatePhase(plan, phaseId, (ph) => ({ ...ph, procedures: [...ph.procedures, proc] }));
}

export function addPhase(plan: TreatmentPlan, title: string): TreatmentPlan {
  const order = plan.phases.length;
  const ph: Phase = { id: `ph_${nanoid(6)}`, title, order, delayFromPreviousDays: order === 0 ? 0 : 14, procedures: [] };
  return { ...plan, phases: [...plan.phases, ph] };
}

export function removePhase(plan: TreatmentPlan, phaseId: string): TreatmentPlan {
  const phases = plan.phases
    .filter((p) => p.id !== phaseId)
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({ ...p, order: i }));
  return { ...plan, phases };
}

export function reorderPhases(plan: TreatmentPlan, ids: string[]): TreatmentPlan {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return { ...plan, phases: plan.phases.map((p) => ({ ...p, order: pos.get(p.id) ?? p.order })) };
}

/** "36, 37 46" → [36, 37, 46] (invalid numbers dropped) */
export function parseTeeth(s: string): number[] {
  return [...new Set((s.match(/\d{2}/g) ?? []).map(Number).filter(isValidFDI))];
}

/** "1 234,50" / "1234.5" → 1234.5 */
export function parseMoney(s: string): number | null {
  const clean = s.replace(/[\s  €]/g, "").replace(",", ".");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function findPriceItem(list: PriceItem[], label: string): PriceItem | undefined {
  const l = label.trim().toLowerCase();
  return list.find((p) => p.label.toLowerCase() === l || p.labelEn?.toLowerCase() === l);
}
