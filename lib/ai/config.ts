/**
 * All model IDs in one place. Verified against provider /models endpoints on 2026-11-16.
 * Groq retired llama-3.3-70b-versatile on 2026-08-16 → gpt-oss-120b is Groq's recommended replacement.
 */
export const AI_CONFIG = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    /** Full large-v3: best accuracy for French/English (turbo is faster but slightly less accurate). */
    sttModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3",
    sttFallbackModel: "whisper-large-v3-turbo",
    llmModel: process.env.GROQ_LLM_MODEL ?? "openai/gpt-oss-120b",
    /** second Groq model if the first is rate-limited (separate quota) */
    llmFallbackModel: "openai/gpt-oss-20b",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    /** tried in order; the free tier often returns 503 "high demand" on the newest model */
    models: [process.env.GEMINI_MODEL ?? "gemini-3.8-flash", "gemini-3.5-flash"],
  },
  llm: {
    temperature: 0.2,
    maxOutputTokens: 8000,
  },
  /** Groq hard limit is 25 MB on free tier */
  maxAudioBytes: 24 * 1024 * 1024,
} as const;
