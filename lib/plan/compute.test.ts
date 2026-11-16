import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDuration,
  offsetLabel,
  phaseSpans,
  phaseTotals,
  planTotal,
  procedureSubtotal,
  schedule,
  teethByPhase,
  totalDurationDays,
  LAST_PHASE_DAYS,
} from "./compute";
import { DURAND_PLAN } from "@/lib/fixtures/durand";
import type { Procedure } from "@/lib/ai/schema";

const proc = (o: Partial<Procedure>): Procedure => ({ id: "x", label: "x", teeth: [], quantity: 1, unitPrice: 10, priceSource: "list", ...o });

describe("totals", () => {
  it("subtotal = unit × qty, rounded to cents", () => {
    expect(procedureSubtotal(proc({ unitPrice: 26.97, quantity: 3 }))).toBe(80.91);
    expect(procedureSubtotal(proc({ unitPrice: 0.1, quantity: 3 }))).toBe(0.3);
    expect(procedureSubtotal(proc({ unitPrice: null }))).toBeNull();
  });

  it("phase total skips missing prices and counts them", () => {
    const t = phaseTotals({ id: "a", title: "", order: 0, delayFromPreviousDays: 0, procedures: [proc({ unitPrice: 10 }), proc({ unitPrice: null, priceSource: "missing" })] });
    expect(t).toEqual({ total: 10, missingPrices: 1 });
  });

  it("plan total for the Durand fixture", () => {
    expect(planTotal(DURAND_PLAN)).toEqual({ total: 1944.46, missingPrices: 0 });
  });

  it("empty plan", () => {
    expect(planTotal({ phases: [] })).toEqual({ total: 0, missingPrices: 0 });
    expect(totalDurationDays({ phases: [] })).toBe(0);
  });
});

describe("schedule", () => {
  it("accumulates delays from the start date", () => {
    const s = schedule(DURAND_PLAN);
    expect(s.map((x) => x.offsetDays)).toEqual([0, 21, 90]);
    expect(s.map((x) => x.startDate)).toEqual(["2026-11-23", "2026-12-14", "2027-02-21"]);
  });

  it("null delays count as 0 and no startDate yields null dates", () => {
    const s = schedule({
      phases: [
        { id: "a", title: "", order: 0, delayFromPreviousDays: null, procedures: [] },
        { id: "b", title: "", order: 1, delayFromPreviousDays: null, procedures: [] },
      ],
    });
    expect(s).toEqual([
      { phaseId: "a", offsetDays: 0, startDate: null },
      { phaseId: "b", offsetDays: 0, startDate: null },
    ]);
  });

  it("follows `order`, not array position", () => {
    const s = schedule({
      phases: [
        { id: "b", title: "", order: 1, delayFromPreviousDays: 7, procedures: [] },
        { id: "a", title: "", order: 0, delayFromPreviousDays: 0, procedures: [] },
      ],
    });
    expect(s.map((x) => x.phaseId)).toEqual(["a", "b"]);
  });

  it("duration and spans", () => {
    expect(totalDurationDays(DURAND_PLAN)).toBe(90 + LAST_PHASE_DAYS);
    expect(phaseSpans(DURAND_PLAN)).toEqual([
      { phaseId: "ph1", start: 0, end: 21 },
      { phaseId: "ph2", start: 21, end: 90 },
      { phaseId: "ph3", start: 90, end: 90 + LAST_PHASE_DAYS },
    ]);
  });

  it("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("labels", () => {
  it("formats durations and offsets", () => {
    expect(formatDuration(5, "fr")).toBe("5 j");
    expect(formatDuration(21, "fr")).toBe("3 sem.");
    expect(formatDuration(104, "fr")).toBe("3 mois");
    expect(formatDuration(104, "en")).toBe("3 mo");
    expect(offsetLabel(0, "fr")).toBe("Dès le début");
    expect(offsetLabel(21, "fr")).toBe("à partir de S+3");
    expect(offsetLabel(90, "en")).toBe("from M+3");
  });

  it("teethByPhase maps teeth to phases", () => {
    const m = teethByPhase(DURAND_PLAN);
    expect(m.get(36)).toEqual(["ph1", "ph2"]);
    expect(m.get(48)).toEqual(["ph1"]);
    expect(m.get(46)).toEqual(["ph3"]);
  });
});
