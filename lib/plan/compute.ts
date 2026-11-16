import type { Phase, Procedure, TreatmentPlan } from "@/lib/ai/schema";

const DAY_MS = 86_400_000;

/** Round to cents, avoiding float noise. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function procedureSubtotal(p: Procedure): number | null {
  if (p.unitPrice == null) return null;
  return round2(p.unitPrice * p.quantity);
}

export interface PhaseTotals {
  total: number;
  /** number of procedures without a price */
  missingPrices: number;
}

export function phaseTotals(phase: Phase): PhaseTotals {
  let total = 0;
  let missingPrices = 0;
  for (const p of phase.procedures) {
    const s = procedureSubtotal(p);
    if (s == null) missingPrices++;
    else total += s;
  }
  return { total: round2(total), missingPrices };
}

export function sortedPhases(plan: Pick<TreatmentPlan, "phases">): Phase[] {
  return [...plan.phases].sort((a, b) => a.order - b.order);
}

export function planTotal(plan: Pick<TreatmentPlan, "phases">): PhaseTotals {
  let total = 0;
  let missingPrices = 0;
  for (const ph of plan.phases) {
    const t = phaseTotals(ph);
    total += t.total;
    missingPrices += t.missingPrices;
  }
  return { total: round2(total), missingPrices };
}

/** Parse "YYYY-MM-DD" (or ISO) as a local-midnight UTC-safe day. */
export function parseDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return formatDay(new Date(parseDay(day).getTime() + n * DAY_MS));
}

export interface PhaseSchedule {
  phaseId: string;
  /** days from the plan start to the beginning of this phase */
  offsetDays: number;
  /** ISO day, only when a startDate is set */
  startDate: string | null;
}

/**
 * Phases are sequential: each starts `delayFromPreviousDays` after the previous
 * phase's start (null → 0). The first phase's delay is relative to the plan start.
 */
export function schedule(plan: Pick<TreatmentPlan, "phases" | "startDate">): PhaseSchedule[] {
  let offset = 0;
  return sortedPhases(plan).map((ph) => {
    offset += Math.max(0, ph.delayFromPreviousDays ?? 0);
    return {
      phaseId: ph.id,
      offsetDays: offset,
      startDate: plan.startDate ? addDays(plan.startDate, offset) : null,
    };
  });
}

/** Default length given to the last phase on the timeline (it has no successor). */
export const LAST_PHASE_DAYS = 14;

/** Estimated total duration in days, from plan start to the end of the last phase. */
export function totalDurationDays(plan: Pick<TreatmentPlan, "phases" | "startDate">): number {
  const s = schedule(plan);
  if (s.length === 0) return 0;
  return s[s.length - 1].offsetDays + LAST_PHASE_DAYS;
}

/** Spans for the timeline: [start, end) in days for each phase. */
export function phaseSpans(plan: Pick<TreatmentPlan, "phases" | "startDate">) {
  const s = schedule(plan);
  return s.map((x, i) => ({
    phaseId: x.phaseId,
    start: x.offsetDays,
    end: i < s.length - 1 ? Math.max(s[i + 1].offsetDays, x.offsetDays + 1) : x.offsetDays + LAST_PHASE_DAYS,
  }));
}

/** Human duration: "3 sem.", "4 mois"… */
export function formatDuration(days: number, lang: "fr" | "en"): string {
  if (days < 14) return lang === "fr" ? `${days} j` : `${days} d`;
  if (days < 70) {
    const w = Math.round(days / 7);
    return lang === "fr" ? `${w} sem.` : `${w} wk`;
  }
  const m = Math.round(days / 30.4);
  return lang === "fr" ? `${m} mois` : `${m} mo`;
}

/** "S+3" / "W+3" style label for when a phase starts. */
export function offsetLabel(days: number, lang: "fr" | "en"): string {
  if (days === 0) return lang === "fr" ? "Dès le début" : "From start";
  if (days < 70) {
    const w = Math.round(days / 7);
    return lang === "fr" ? `à partir de S+${w}` : `from W+${w}`;
  }
  const m = Math.round(days / 30.4);
  return lang === "fr" ? `à partir de M+${m}` : `from M+${m}`;
}

/** Map of tooth → phase ids that treat it. */
export function teethByPhase(plan: Pick<TreatmentPlan, "phases">): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const ph of sortedPhases(plan)) {
    for (const p of ph.procedures) {
      for (const t of p.teeth) {
        const arr = map.get(t) ?? [];
        if (!arr.includes(ph.id)) arr.push(ph.id);
        map.set(t, arr);
      }
    }
  }
  return map;
}

export function formatMoney(n: number | null, lang: "fr" | "en", currency = "EUR"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/ | /g, " ");
}
