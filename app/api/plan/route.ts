import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePlanJson, ProviderError } from "@/lib/ai/provider";
import { planSystemPrompt, planUserPrompt, refineUserPrompt } from "@/lib/ai/prompts";
import { normalizeLLMPlan } from "@/lib/ai/normalize";
import { TreatmentPlanSchema } from "@/lib/ai/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const PriceItemSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  label: z.string(),
  labelEn: z.string().optional(),
  price: z.number(),
  perTooth: z.boolean(),
});

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    transcript: z.string().min(3).max(20_000),
    lang: z.enum(["fr", "en"]),
    priceList: z.array(PriceItemSchema).max(500),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    mode: z.literal("refine"),
    plan: TreatmentPlanSchema,
    instruction: z.string().min(1).max(5_000),
    priceList: z.array(PriceItemSchema).max(500),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

/** Stateless proxy: transcript (or plan + instruction) in, validated plan out. Nothing is logged or stored. */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    if (body.mode === "create") {
      const system = planSystemPrompt({ lang: body.lang, priceList: body.priceList, today: body.today });
      const { plan, provider } = await generatePlanJson(system, planUserPrompt(body.transcript));
      return NextResponse.json({ plan: normalizeLLMPlan(plan, { transcript: body.transcript, language: body.lang }), provider });
    }

    const current = body.plan;
    const system = planSystemPrompt({ lang: current.language, priceList: body.priceList, today: body.today });
    const slim = {
      patient: current.patient,
      startDate: current.startDate ?? null,
      phases: current.phases,
      generalNotes: current.generalNotes ?? null,
    };
    const { plan, provider } = await generatePlanJson(system, refineUserPrompt(JSON.stringify(slim), body.instruction));
    const next = normalizeLLMPlan(plan, {
      id: current.id,
      createdAt: current.createdAt,
      transcript: current.transcript,
      language: current.language,
      keepQuestions: current.questions,
    });
    // a refine never resets a start date the dentist set by hand
    if (!next.startDate && current.startDate) next.startDate = current.startDate;
    return NextResponse.json({ plan: next, provider });
  } catch (e) {
    const status = e instanceof ProviderError && e.status ? e.status : 502;
    const code = status === 429 ? "rate_limited" : status === 503 ? "not_configured" : status === 422 ? "invalid_output" : "provider_error";
    return NextResponse.json({ error: code }, { status: status === 429 || status === 503 || status === 422 ? status : 502 });
  }
}
