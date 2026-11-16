import type { TreatmentPlan } from "@/lib/ai/schema";

/** Fixture matching the §1 example dictation; used by tests and the "demo" button. */
export const DURAND_TRANSCRIPT =
  "Patient Mme Durand, 45 ans. Phase 1 assainissement : détartrage, extraction de la 48, traitement canalaire sur la 36. Phase 2 dans 3 semaines : couronne céramique sur la 36. Phase 3 : implant en 46, pose 3 mois après extraction.";

export const DURAND_PLAN: TreatmentPlan = {
  id: "fixture-durand",
  createdAt: "2026-11-16T09:00:00.000Z",
  patient: { name: "Mme Durand", age: 45 },
  startDate: "2026-11-23",
  language: "fr",
  status: "draft",
  transcript: DURAND_TRANSCRIPT,
  phases: [
    {
      id: "ph1",
      title: "Phase 1 · Assainissement",
      order: 0,
      delayFromPreviousDays: 0,
      estimatedSessions: 2,
      procedures: [
        { id: "pr1", label: "Détartrage et polissage", code: "HBJD001", teeth: [], quantity: 1, unitPrice: 28.92, priceSource: "list" },
        { id: "pr2", label: "Extraction dent de sagesse", teeth: [48], quantity: 1, unitPrice: 83.6, priceSource: "list" },
        { id: "pr3", label: "Traitement canalaire molaire", teeth: [36], quantity: 1, unitPrice: 81.94, priceSource: "list" },
      ],
    },
    {
      id: "ph2",
      title: "Phase 2 · Prothèse",
      order: 1,
      delayFromPreviousDays: 21,
      procedures: [{ id: "pr4", label: "Couronne céramique pure", teeth: [36], quantity: 1, unitPrice: 650, priceSource: "list" }],
    },
    {
      id: "ph3",
      title: "Phase 3 · Implantologie",
      order: 2,
      delayFromPreviousDays: 69,
      procedures: [{ id: "pr5", label: "Implant (pose chirurgicale)", teeth: [46], quantity: 1, unitPrice: 1100, priceSource: "list" }],
    },
  ],
  questions: [
    {
      id: "q1",
      question: "Matériau de la couronne sur la 36 ?",
      allowCustom: true,
      options: [
        {
          label: "Zircone",
          patch: [
            { op: "replace", path: "/phases/ph2/procedures/pr4/label", value: "Couronne zircone" },
            { op: "replace", path: "/phases/ph2/procedures/pr4/unitPrice", value: 550 },
          ],
        },
        {
          label: "Céramo-métallique",
          patch: [
            { op: "replace", path: "/phases/ph2/procedures/pr4/label", value: "Couronne céramo-métallique" },
            { op: "replace", path: "/phases/ph2/procedures/pr4/unitPrice", value: 500 },
          ],
        },
        { label: "Céramique pure", patch: [] },
      ],
    },
    {
      id: "q2",
      question: "Prévoir une greffe osseuse en 46 ?",
      allowCustom: true,
      options: [
        {
          label: "Oui",
          patch: [
            {
              op: "add",
              path: "/phases/ph3/procedures/-",
              value: { id: "pr6", label: "Greffe osseuse / régénération osseuse", teeth: [46], quantity: 1, unitPrice: 500, priceSource: "list" },
            },
          ],
        },
        { label: "Non", patch: [] },
      ],
    },
  ],
};
