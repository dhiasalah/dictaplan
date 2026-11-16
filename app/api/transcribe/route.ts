import { NextResponse } from "next/server";
import { transcribe, ProviderError } from "@/lib/ai/provider";
import { AI_CONFIG } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stateless proxy: audio in, text out. Nothing is logged or stored. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const audio = form.get("audio");
  const lang = form.get("lang") === "en" ? "en" : "fr";
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "no_audio" }, { status: 400 });
  if (audio.size > AI_CONFIG.maxAudioBytes) return NextResponse.json({ error: "audio_too_large" }, { status: 413 });

  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") ? "mp3" : "webm";

  try {
    const r = await transcribe(audio, `dictation.${ext}`, lang);
    return NextResponse.json(r);
  } catch (e) {
    const status = e instanceof ProviderError && e.status ? (e.status === 429 ? 429 : e.status === 503 ? 503 : 502) : 502;
    return NextResponse.json({ error: status === 429 ? "rate_limited" : status === 503 ? "not_configured" : "provider_error" }, { status });
  }
}
