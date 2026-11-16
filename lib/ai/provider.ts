import "server-only";
import { AI_CONFIG } from "./config";
import { LLMPlanSchema, type LLMPlan, type Lang } from "./schema";
import { WHISPER_PROMPT, repairPrompt } from "./prompts";

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public provider?: string,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

const retryable = (e: unknown) =>
  e instanceof ProviderError &&
  (e.status === 429 || (e.status ?? 0) >= 500 || e.status === undefined || e.status === 408 || /failed to generate json/i.test(e.message));

/** fetch with a hard timeout so a slow provider can't hang the request */
async function fetchT(url: string, init: RequestInit, ms: number, provider: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new ProviderError(`${provider} ${name === "TimeoutError" ? "timeout" : "network error"}`, name === "TimeoutError" ? 408 : undefined, provider);
  }
}

/** Longest we are willing to wait for a rate-limit window before falling back. */
const MAX_WAIT_MS = 30_000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!retryable(e)) throw e;
    const wait = e instanceof ProviderError && e.retryAfterMs != null ? e.retryAfterMs : 800;
    if (wait > MAX_WAIT_MS) throw e;
    await new Promise((r) => setTimeout(r, wait + 250));
    return fn();
  }
}

/** Groq says "Please try again in 7.39s" / "in 850ms"; also honour Retry-After. */
function parseRetryAfter(res: Response, message: string): number | undefined {
  const m = /try again in\s+(?:(\d+)m)?([\d.]+)(ms|s)/i.exec(message);
  if (m) return (m[1] ? Number(m[1]) * 60_000 : 0) + Number(m[2]) * (m[3] === "ms" ? 1 : 1000);
  const h = res.headers.get("retry-after");
  if (h && !Number.isNaN(Number(h))) return Number(h) * 1000;
  return undefined;
}

async function readError(res: Response, provider: string): Promise<ProviderError> {
  let detail = "";
  try {
    const j = await res.json();
    detail = j?.error?.message ?? JSON.stringify(j).slice(0, 300);
  } catch {
    detail = res.statusText;
  }
  return new ProviderError(`${provider} ${res.status}: ${detail}`, res.status, provider, res.status === 429 ? parseRetryAfter(res, detail) : undefined);
}

/* ───────────────────────────── Speech-to-text ───────────────────────────── */

export interface TranscribeResult {
  text: string;
  provider: string;
  model: string;
}

interface WhisperSegment {
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
}

/** Drop segments Whisper most likely hallucinated on silence (e.g. echoing the prompt). */
function cleanSegments(segments: WhisperSegment[] | undefined, fallback: string): string {
  if (!segments?.length) return fallback.trim();
  const kept = segments.filter(
    (s) => !((s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -1) && (s.compression_ratio ?? 1) < 2.6,
  );
  return kept
    .map((s) => s.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function groqTranscribe(audio: Blob, filename: string, lang: Lang, model: string): Promise<TranscribeResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ProviderError("GROQ_API_KEY missing", 401, "groq");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  form.append("language", lang);
  form.append("prompt", WHISPER_PROMPT[lang]);
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");
  const res = await fetchT(
    `${AI_CONFIG.groq.baseUrl}/audio/transcriptions`,
    { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form },
    30_000,
    "groq",
  );
  if (!res.ok) throw await readError(res, "groq");
  const j = (await res.json()) as { text: string; segments?: WhisperSegment[] };
  return { text: cleanSegments(j.segments, j.text), provider: "groq", model };
}

async function geminiTranscribe(audio: Blob, lang: Lang): Promise<TranscribeResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError("GEMINI_API_KEY missing", 401, "gemini");
  const b64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const mime = (audio.type || "audio/webm").split(";")[0];
  const instruction =
    lang === "fr"
      ? "Transcris mot pour mot cet enregistrement d'un dentiste qui dicte un plan de traitement, en français. Écris les numéros de dents en chiffres (ex. « la 36 »). Réponds uniquement avec la transcription."
      : "Transcribe this recording of a dentist dictating a treatment plan verbatim, in English. Write tooth numbers as digits (e.g. 'tooth 36'). Reply with the transcript only.";
  const vocab = lang === "fr" ? "Vocabulaire possible (ne pas recopier s'il n'est pas prononcé)" : "Possible vocabulary (do not copy unless spoken)";
  const res = await fetchT(
    `${AI_CONFIG.gemini.baseUrl}/models/${AI_CONFIG.gemini.model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${instruction}\n${vocab}: ${WHISPER_PROMPT[lang]}` }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { temperature: 0 },
      }),
    },
    40_000,
    "gemini",
  );
  if (!res.ok) throw await readError(res, "gemini");
  const j = await res.json();
  const text: string = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { text: text.trim(), provider: "gemini", model: AI_CONFIG.gemini.model };
}

/** Best-quality chain: Groq whisper-large-v3 → Groq turbo → Gemini audio. */
export async function transcribe(audio: Blob, filename: string, lang: Lang): Promise<TranscribeResult> {
  const attempts: Array<() => Promise<TranscribeResult>> = [];
  if (process.env.GROQ_API_KEY) {
    attempts.push(() => withRetry(() => groqTranscribe(audio, filename, lang, AI_CONFIG.groq.sttModel)));
    attempts.push(() => groqTranscribe(audio, filename, lang, AI_CONFIG.groq.sttFallbackModel));
  }
  if (process.env.GEMINI_API_KEY) attempts.push(() => withRetry(() => geminiTranscribe(audio, lang)));
  if (attempts.length === 0) throw new ProviderError("No speech-to-text provider configured (set GROQ_API_KEY)", 503);

  let last: unknown;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      last = e;
      console.warn("[transcribe] provider failed:", (e as Error).message);
    }
  }
  throw last;
}

/* ───────────────────────────── LLM ───────────────────────────── */

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function groqChat(messages: Msg[], model: string = AI_CONFIG.groq.llmModel): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ProviderError("GROQ_API_KEY missing", 401, "groq");
  const res = await fetchT(`${AI_CONFIG.groq.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: AI_CONFIG.llm.temperature,
      max_completion_tokens: AI_CONFIG.llm.maxOutputTokens,
      response_format: { type: "json_object" },
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "medium", include_reasoning: false } : {}),
    }),
  }, 40_000, "groq");
  if (!res.ok) throw await readError(res, "groq");
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

async function geminiChat(messages: Msg[], model: string = AI_CONFIG.gemini.model): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError("GEMINI_API_KEY missing", 401, "gemini");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetchT(`${AI_CONFIG.gemini.baseUrl}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: AI_CONFIG.llm.temperature,
        maxOutputTokens: AI_CONFIG.llm.maxOutputTokens,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 },
      },
    }),
  }, 25_000, "gemini");
  if (!res.ok) throw await readError(res, "gemini");
  const j = await res.json();
  return j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("Response is not JSON");
  }
}

function validate(text: string): { ok: true; plan: LLMPlan } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const r = LLMPlanSchema.safeParse(data);
  if (r.success) return { ok: true, plan: r.data };
  return { ok: false, error: r.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n") };
}

/** Call one provider, validate, and do one repair round-trip on invalid output. */
async function planWith(chat: (m: Msg[]) => Promise<string>, messages: Msg[]): Promise<LLMPlan> {
  const first = await withRetry(() => chat(messages));
  const v1 = validate(first);
  if (v1.ok) return v1.plan;
  const second = await chat([...messages, { role: "assistant", content: first }, { role: "user", content: repairPrompt(v1.error) }]);
  const v2 = validate(second);
  if (v2.ok) return v2.plan;
  throw new ProviderError(`Invalid plan JSON after repair: ${v2.error}`, 422);
}

export async function generatePlanJson(system: string, user: string): Promise<{ plan: LLMPlan; provider: string }> {
  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const providers: Array<[string, (m: Msg[]) => Promise<string>]> = [];
  // quality first: best Groq model (waits out short rate limits) → Gemini → smaller Groq model as last resort
  if (process.env.GROQ_API_KEY) providers.push([`groq:${AI_CONFIG.groq.llmModel}`, (m) => groqChat(m, AI_CONFIG.groq.llmModel)]);
  if (process.env.GEMINI_API_KEY) {
    for (const gm of AI_CONFIG.gemini.models) providers.push([`gemini:${gm}`, (m) => geminiChat(m, gm)]);
  }
  if (process.env.GROQ_API_KEY) providers.push([`groq:${AI_CONFIG.groq.llmFallbackModel}`, (m) => groqChat(m, AI_CONFIG.groq.llmFallbackModel)]);
  if (providers.length === 0) throw new ProviderError("No LLM provider configured (set GROQ_API_KEY)", 503);

  let last: unknown;
  for (const [name, chat] of providers) {
    try {
      return { plan: await planWith(chat, messages), provider: name };
    } catch (e) {
      last = e;
      console.warn(`[plan] ${name} failed:`, (e as Error).message);
    }
  }
  throw last;
}
