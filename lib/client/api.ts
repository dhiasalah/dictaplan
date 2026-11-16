"use client";

import type { Lang, TreatmentPlan } from "@/lib/ai/schema";
import type { PriceItem } from "@/lib/seed/price-list.fr";

export type ApiErrorCode = "rate_limited" | "not_configured" | "invalid_output" | "provider_error" | "network" | "bad_request" | "audio_too_large" | "no_audio";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode) {
    super(code);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("network");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((j?.error as ApiErrorCode) ?? "provider_error");
  return j as T;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function transcribeAudio(audio: Blob, lang: Lang): Promise<{ text: string; provider: string; model: string }> {
  const form = new FormData();
  form.append("audio", audio, "dictation");
  form.append("lang", lang);
  return call("/api/transcribe", { method: "POST", body: form });
}

export async function createPlan(transcript: string, lang: Lang, priceList: PriceItem[]): Promise<TreatmentPlan> {
  const r = await call<{ plan: TreatmentPlan }>("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "create", transcript, lang, priceList, today: today() }),
  });
  return r.plan;
}

export async function refinePlan(plan: TreatmentPlan, instruction: string, priceList: PriceItem[]): Promise<TreatmentPlan> {
  const r = await call<{ plan: TreatmentPlan }>("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "refine", plan, instruction, priceList, today: today() }),
  });
  return r.plan;
}
