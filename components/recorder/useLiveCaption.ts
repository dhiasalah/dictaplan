"use client";

import { useCallback, useRef, useState } from "react";
import type { Lang } from "@/lib/ai/schema";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getSR(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const liveCaptionSupported = () => getSR() !== null;

/**
 * Browser-native live captions (Chrome/Edge). Used only as an instant preview while
 * recording, and as a fallback when the server transcription is unavailable.
 * The high-quality Whisper transcript replaces it when recording stops.
 */
export function useLiveCaption() {
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRec | null>(null);
  const activeRef = useRef(false);
  const finalRef = useRef("");

  const start = useCallback((lang: Lang) => {
    const SR = getSR();
    if (!SR) return;
    finalRef.current = "";
    setFinalText("");
    setInterim("");
    const rec = new SR();
    rec.lang = lang === "fr" ? "fr-FR" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current = `${finalRef.current} ${r[0].transcript}`.trim();
        else interimText += r[0].transcript;
      }
      setFinalText(finalRef.current);
      setInterim(interimText);
    };
    rec.onerror = () => {};
    // Chrome stops after silences; restart while we're still recording
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {}
      }
    };
    activeRef.current = true;
    recRef.current = rec;
    try {
      rec.start();
    } catch {}
  }, []);

  /** Stops and returns the best text captured so far (final + pending interim). */
  const stop = useCallback((): string => {
    activeRef.current = false;
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    const text = `${finalRef.current} ${interim}`.trim();
    return text;
  }, [interim]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinalText("");
    setInterim("");
  }, []);

  return { finalText, interim, start, stop, reset };
}
