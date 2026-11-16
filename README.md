# Dictaplan

Dictate a dental treatment plan, check it, export a premium PDF to give the patient.
French-first, English toggle. 100% free stack.

```
[1 Dicter] → [2 Préciser] → [3 Vérifier] → [4 Exporter]
```

## Run it

```bash
pnpm install
cp .env.local.example .env.local   # then paste your keys (see below)
pnpm dev                           # http://localhost:3000
```

Other scripts: `pnpm test` (Vitest), `pnpm build`, `pnpm lint`.

## Free API keys

| Key | Where | Used for |
|---|---|---|
| `GROQ_API_KEY` (**required**) | https://console.groq.com/keys, sign in, **Create API Key** (no card) | Speech-to-text (Whisper large-v3) and plan generation (gpt-oss-120b) |
| `GEMINI_API_KEY` (optional) | https://aistudio.google.com/apikey, **Create API key** | Fallback when Groq is rate-limited or down |

Keys are only read by the API routes (`app/api/*`). They are never sent to the browser (`pnpm build` and then grep `.next/static`: no match).

## Speech recognition: how quality is maximised (FR and EN)

1. **Groq `whisper-large-v3`**: the full model, not turbo. It is the most accurate free option for French and accented speech, and it still transcribes a 1–2 minute dictation in about 2 s.
2. **Explicit language** (`fr` / `en` from the "Langue de dictée" toggle) instead of auto-detect, which often fails on short clips.
3. **Dental vocabulary prompt** (`lib/ai/prompts.ts → WHISPER_PROMPT`) primes Whisper with détartrage, céramo-métallique, zircone, inlay-core, FDI numbers… so terms come out spelled correctly.
4. `temperature 0` + segment filtering (drops segments Whisper hallucinated on silence).
5. **Fallback chain:** large-v3, then large-v3-turbo, then Gemini audio. If the server is unreachable, the browser's live Web Speech text is kept.
6. **Live preview:** in Chrome/Edge, words appear while you speak (Web Speech API), then they're replaced by the higher-quality Whisper transcript when you stop.

## Models (verified 2026-11-16, all in `lib/ai/config.ts`)

- STT: `whisper-large-v3`, falling back to `whisper-large-v3-turbo` (Groq)
- LLM: `openai/gpt-oss-120b` (Groq, JSON mode, medium reasoning), falling back to `gemini-3.8-flash`, then `gemini-3.5-flash`, then `openai/gpt-oss-20b`
  *(Groq retired `llama-3.3-70b-versatile` on 2026-08-16, the model named in the original spec.)*
- Override with env vars `GROQ_STT_MODEL`, `GROQ_LLM_MODEL`, `GEMINI_MODEL`.

**Free-tier limit to know about:** gpt-oss-120b allows about 8,000 tokens/min, roughly one plan generation per minute. When the limit is hit, the server waits the few seconds Groq asks for (up to 30 s) before falling back to another model.

## Keyboard

- **Space** (hold): talk
- **Ctrl/⌘ + Enter**: generate the plan
- **Ctrl/⌘ + P**: export the PDF

## How it works

- `lib/ai/schema.ts`: Zod schema (plan, phases, procedures, FDI teeth, questions + JSON-patch options).
- `lib/ai/prompts.ts`: system prompt (FDI conversion, phases, intervals, price-list matching, "never invent", ≤ 5 questions).
- `lib/ai/provider.ts`: `transcribe()` and `generatePlanJson()`. Retry, rate-limit wait, Zod validation, one "fix this JSON" repair round, provider fallback.
- `lib/ai/normalize.ts`: turns lenient LLM output into a strict plan and dry-runs every option patch.
- `lib/plan/patch.ts`: applies option patches (`/phases/<id>/procedures/<id>/…`) atomically, so a click on a chip updates the plan **without another LLM call**. Free-text answers and edits go through a "refine" LLM call.
- `lib/plan/compute.ts`: totals, schedule, durations. Always computed, never stored.
- `lib/plan/fdi.ts`: tooth-chart geometry shared by the screen and the PDF.
- `components/pdf/PlanDocument.tsx`: A4 PDF (@react-pdf, client-side, embedded Instrument Serif / Geist / Geist Mono).
- `lib/store.ts`: Zustand, persisted to IndexedDB (plans, practice settings, price list).

## Privacy

Nothing is stored server-side: the API routes are stateless proxies and log no transcripts. Plans live only in the browser's IndexedDB. Audio and text are processed by Groq/Google. Prefer a patient reference to a full name. Commercial use in France would need HDS-certified hosting and a GDPR review; that is out of scope for this MVP.

## Deploy (Vercel Hobby, free)

1. Push the repo to GitHub, then go to https://vercel.com/new and import it.
2. Add `GROQ_API_KEY` (and `GEMINI_API_KEY`) under *Settings → Environment Variables*.
3. Deploy. The API routes run on Node with `maxDuration = 60`.
