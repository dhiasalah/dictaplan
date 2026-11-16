import { z } from "zod";

/** FDI tooth number: permanent 11–48, deciduous 51–85. */
export function isValidFDI(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  const q = Math.floor(n / 10);
  const t = n % 10;
  if (q >= 1 && q <= 4) return t >= 1 && t <= 8;
  if (q >= 5 && q <= 8) return t >= 1 && t <= 5;
  return false;
}

export const ToothFDISchema = z.number().int().refine(isValidFDI, { message: "Invalid FDI tooth number" });

export const PriceSourceSchema = z.enum(["list", "dictated", "manual", "missing"]);

export const ProcedureSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  code: z.string().optional(),
  teeth: z.array(ToothFDISchema),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().nullable(),
  priceSource: PriceSourceSchema,
  notes: z.string().optional(),
});

export const PhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  order: z.number().int().nonnegative(),
  delayFromPreviousDays: z.number().int().nonnegative().nullable(),
  estimatedSessions: z.number().int().positive().optional(),
  procedures: z.array(ProcedureSchema),
  notes: z.string().optional(),
});

export const JsonPatchOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("remove"), path: z.string() }),
]);

export const ClarifyOptionSchema = z.object({
  label: z.string().min(1),
  patch: z.array(JsonPatchOpSchema),
  /** true when the patch could not be applied locally → resolve via a refine LLM call */
  refine: z.boolean().optional(),
});

export const ClarifyQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(ClarifyOptionSchema).min(1).max(4),
  allowCustom: z.boolean(),
  answered: z.string().optional(),
});

export const PatientSchema = z.object({
  name: z.string().optional(),
  age: z.number().int().nonnegative().optional(),
  reference: z.string().optional(),
});

export const TreatmentPlanSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  patient: PatientSchema,
  startDate: z.string().optional(),
  phases: z.array(PhaseSchema),
  questions: z.array(ClarifyQuestionSchema).max(5),
  generalNotes: z.string().optional(),
  transcript: z.string(),
  language: z.enum(["fr", "en"]),
  status: z.enum(["draft", "final"]),
  /** manual "part estimée Sécurité sociale"; never produced by the LLM */
  insuranceShare: z.number().nonnegative().optional(),
  updatedAt: z.string().optional(),
});

export type ToothFDI = number;
export type PriceSource = z.infer<typeof PriceSourceSchema>;
export type Procedure = z.infer<typeof ProcedureSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;
export type ClarifyOption = z.infer<typeof ClarifyOptionSchema>;
export type ClarifyQuestion = z.infer<typeof ClarifyQuestionSchema>;
export type TreatmentPlan = z.infer<typeof TreatmentPlanSchema>;
export type Lang = TreatmentPlan["language"];

/**
 * Lenient schema for what the LLM returns (ids optional, nullable fields tolerated).
 * `normalizeLLMPlan` turns it into a strict TreatmentPlan.
 */
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish();

export const LLMPlanSchema = z.object({
  patient: z
    .object({
      name: nullish(z.string()),
      age: nullish(z.coerce.number()),
      reference: nullish(z.string()),
    })
    .nullish(),
  startDate: nullish(z.string()),
  phases: z.array(
    z.object({
      id: nullish(z.string()),
      title: z.string(),
      delayFromPreviousDays: nullish(z.coerce.number()),
      estimatedSessions: nullish(z.coerce.number()),
      notes: nullish(z.string()),
      procedures: z.array(
        z.object({
          id: nullish(z.string()),
          label: z.string(),
          code: nullish(z.string()),
          teeth: z.array(z.coerce.number()).nullish(),
          quantity: nullish(z.coerce.number()),
          unitPrice: nullish(z.coerce.number()),
          priceSource: nullish(PriceSourceSchema),
          notes: nullish(z.string()),
        }),
      ),
    }),
  ),
  questions: z
    .array(
      z.object({
        id: nullish(z.string()),
        question: z.string(),
        options: z.array(z.object({ label: z.string(), patch: z.array(JsonPatchOpSchema).nullish() })),
        allowCustom: nullish(z.boolean()),
      }),
    )
    .nullish(),
  generalNotes: nullish(z.string()),
});

export type LLMPlan = z.infer<typeof LLMPlanSchema>;
