import { describe, expect, it } from "vitest";
import { answerQuestion, applyPlanPatch, parsePath } from "./patch";
import { DURAND_PLAN } from "@/lib/fixtures/durand";

describe("parsePath", () => {
  it("splits and decodes", () => {
    expect(parsePath("/phases/0/a~1b/c~0d")).toEqual(["phases", "0", "a/b", "c~d"]);
    expect(() => parsePath("phases")).toThrow();
  });
});

describe("applyPlanPatch", () => {
  it("replaces by id path", () => {
    const r = applyPlanPatch(DURAND_PLAN, [{ op: "replace", path: "/phases/ph2/procedures/pr4/unitPrice", value: 550 }]);
    expect(r.ok).toBe(true);
    expect(r.plan.phases[1].procedures[0].unitPrice).toBe(550);
    expect(DURAND_PLAN.phases[1].procedures[0].unitPrice).toBe(650); // immutable
  });

  it("replaces by index path", () => {
    const r = applyPlanPatch(DURAND_PLAN, [{ op: "replace", path: "/phases/2/delayFromPreviousDays", value: 120 }]);
    expect(r.ok && r.plan.phases[2].delayFromPreviousDays).toBe(120);
  });

  it("id paths survive reordering", () => {
    const reordered = { ...DURAND_PLAN, phases: [...DURAND_PLAN.phases].reverse() };
    const r = applyPlanPatch(reordered, [{ op: "replace", path: "/phases/ph3/title", value: "X" }]);
    expect(r.ok).toBe(true);
    expect(r.plan.phases.find((p) => p.id === "ph3")!.title).toBe("X");
  });

  it("appends with -", () => {
    const r = applyPlanPatch(DURAND_PLAN, [
      { op: "add", path: "/phases/ph3/procedures/-", value: { id: "n", label: "Greffe", teeth: [46], quantity: 1, unitPrice: 500, priceSource: "list" } },
    ]);
    expect(r.ok && r.plan.phases[2].procedures.map((p) => p.id)).toEqual(["pr5", "n"]);
  });

  it("tolerates LLM-style nulls for optional fields", () => {
    const r = applyPlanPatch(DURAND_PLAN, [
      { op: "add", path: "/phases/ph3/procedures/-", value: { id: "n", label: "Pilier", code: null, notes: null, teeth: [46], quantity: 1, unitPrice: null, priceSource: "missing" } },
      { op: "replace", path: "/phases/ph1/procedures/pr1/code", value: null },
      { op: "replace", path: "/phases/ph2/procedures/pr4/notes", value: null },
    ]);
    expect(r.ok).toBe(true);
    expect(r.plan.phases[2].procedures[1]).toEqual({ id: "n", label: "Pilier", teeth: [46], quantity: 1, unitPrice: null, priceSource: "missing" });
    expect(r.plan.phases[0].procedures[0].code).toBeUndefined();
  });

  it("removes", () => {
    const r = applyPlanPatch(DURAND_PLAN, [{ op: "remove", path: "/phases/ph1/procedures/pr1" }]);
    expect(r.ok && r.plan.phases[0].procedures.length).toBe(2);
  });

  it("creates optional nested objects", () => {
    const r = applyPlanPatch({ ...DURAND_PLAN, patient: {} }, [{ op: "add", path: "/patient/age", value: 50 }]);
    expect(r.ok && r.plan.patient.age).toBe(50);
  });

  it("is atomic: a failing op leaves the plan untouched", () => {
    const r = applyPlanPatch(DURAND_PLAN, [
      { op: "replace", path: "/phases/ph1/title", value: "changed" },
      { op: "replace", path: "/phases/nope/title", value: "x" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.plan).toBe(DURAND_PLAN);
  });

  it("rejects results that break the schema", () => {
    const r = applyPlanPatch(DURAND_PLAN, [{ op: "replace", path: "/phases/ph1/procedures/pr2/teeth", value: [99] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/FDI/);
  });

  it("refuses protected roots", () => {
    expect(applyPlanPatch(DURAND_PLAN, [{ op: "replace", path: "/transcript", value: "" }]).ok).toBe(false);
    expect(applyPlanPatch(DURAND_PLAN, [{ op: "replace", path: "", value: {} }]).ok).toBe(false);
  });

  it("renumbers order after adding a phase", () => {
    const r = applyPlanPatch(DURAND_PLAN, [
      { op: "add", path: "/phases/-", value: { id: "ph4", title: "Maintenance", order: 3, delayFromPreviousDays: 180, procedures: [] } },
    ]);
    expect(r.ok && r.plan.phases.map((p) => p.order)).toEqual([0, 1, 2, 3]);
  });
});

describe("answerQuestion", () => {
  it("applies the option patch and marks answered", () => {
    const r = answerQuestion(DURAND_PLAN, "q1", 0);
    expect(r.ok).toBe(true);
    expect(r.plan.phases[1].procedures[0]).toMatchObject({ label: "Couronne zircone", unitPrice: 550 });
    expect(r.plan.questions[0].answered).toBe("Zircone");
  });

  it("an empty patch only marks answered", () => {
    const r = answerQuestion(DURAND_PLAN, "q2", 1);
    expect(r.ok && r.plan.phases).toEqual(DURAND_PLAN.phases);
    expect(r.plan.questions[1].answered).toBe("Non");
  });

  it("unknown ids fail", () => {
    expect(answerQuestion(DURAND_PLAN, "zz", 0).ok).toBe(false);
    expect(answerQuestion(DURAND_PLAN, "q1", 9).ok).toBe(false);
  });
});
