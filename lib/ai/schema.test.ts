import { describe, expect, it } from "vitest";
import { isValidFDI, LLMPlanSchema, TreatmentPlanSchema } from "./schema";
import { normalizeLLMPlan } from "./normalize";
import { DURAND_PLAN } from "@/lib/fixtures/durand";

describe("FDI validation", () => {
  it("accepts permanent and deciduous teeth", () => {
    for (const n of [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 65, 71, 75, 81, 85]) expect(isValidFDI(n)).toBe(true);
  });
  it("rejects invalid numbers", () => {
    for (const n of [0, 10, 19, 49, 50, 56, 86, 90, 36.5, -36]) expect(isValidFDI(n)).toBe(false);
  });
});

describe("TreatmentPlanSchema", () => {
  it("accepts the fixture", () => {
    expect(TreatmentPlanSchema.safeParse(DURAND_PLAN).success).toBe(true);
  });
  it("rejects more than 5 questions", () => {
    const q = DURAND_PLAN.questions[0];
    const plan = { ...DURAND_PLAN, questions: Array.from({ length: 6 }, (_, i) => ({ ...q, id: `q${i}` })) };
    expect(TreatmentPlanSchema.safeParse(plan).success).toBe(false);
  });
  it("rejects bad price source and negative price", () => {
    const bad = structuredClone(DURAND_PLAN);
    bad.phases[0].procedures[0].unitPrice = -1;
    expect(TreatmentPlanSchema.safeParse(bad).success).toBe(false);
  });
});

describe("LLM output normalisation", () => {
  const llmOutput = {
    patient: { name: "Mme Durand", age: "45", reference: null },
    startDate: null,
    phases: [
      {
        id: "ph1",
        title: "Phase 1 · Assainissement",
        delayFromPreviousDays: null,
        procedures: [
          { id: "pr1", label: "Détartrage", code: "HBJD001", teeth: [], quantity: 1, unitPrice: 28.92, priceSource: "list" },
          { id: "pr2", label: "Extraction", teeth: [48, 99, "36"], quantity: null, unitPrice: null, priceSource: "list" },
        ],
      },
      { id: "ph1", title: "Phase 2", delayFromPreviousDays: 21, procedures: [{ id: "pr1", label: "Couronne", teeth: [36], unitPrice: 650 }] },
    ],
    questions: [
      {
        id: "q1",
        question: "Matériau ?",
        options: [
          { label: "Zircone", patch: [{ op: "replace", path: "/phases/ph1/procedures/pr1/unitPrice", value: 550 }] },
          { label: "Broken", patch: [{ op: "replace", path: "/phases/nope/title", value: "x" }] },
          { label: "Non", patch: [] },
        ],
      },
    ],
    generalNotes: "",
  };

  it("parses lenient LLM output and produces a strict plan", () => {
    const parsed = LLMPlanSchema.parse(llmOutput);
    const plan = normalizeLLMPlan(parsed, { transcript: "t", language: "fr" });
    expect(TreatmentPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.patient).toEqual({ name: "Mme Durand", age: 45, reference: undefined });
    // invalid tooth dropped, string coerced, quantity inferred from teeth
    expect(plan.phases[0].procedures[1]).toMatchObject({ teeth: [48, 36], quantity: 2, unitPrice: null, priceSource: "missing" });
    // first phase delay defaults to 0; duplicate ids are renamed
    expect(plan.phases[0].delayFromPreviousDays).toBe(0);
    expect(plan.phases[1].id).not.toBe("ph1");
    expect(plan.phases[1].procedures[0].id).not.toBe("pr1");
    expect(plan.phases[1].procedures[0].quantity).toBe(1);
    // broken patch → refine flag, valid and empty patches kept
    const opts = plan.questions[0].options;
    expect(opts[0].patch).toHaveLength(1);
    expect(opts[1]).toEqual({ label: "Broken", patch: [], refine: true });
    expect(opts[2]).toEqual({ label: "Non", patch: [] });
    expect(plan.generalNotes).toBeUndefined();
  });

  it("keeps previous questions and caps at 5", () => {
    const parsed = LLMPlanSchema.parse({
      ...llmOutput,
      questions: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, question: `Q${i}`, options: [{ label: "a", patch: [] }] })),
    });
    const plan = normalizeLLMPlan(parsed, { transcript: "t", language: "fr", keepQuestions: DURAND_PLAN.questions });
    expect(plan.questions).toHaveLength(5);
    expect(plan.questions.slice(0, 2).map((q) => q.id)).toEqual(["q1", "q2"]);
  });
});
