"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { RecordButton } from "@/components/recorder/RecordButton";
import { useRecorder, formatClock } from "@/components/recorder/useRecorder";
import { useLiveCaption, liveCaptionSupported } from "@/components/recorder/useLiveCaption";
import { Button, Icon, Segmented } from "@/components/ui/primitives";
import { ApiError, createPlan, today, transcribeAudio } from "@/lib/client/api";
import { DURAND_TRANSCRIPT } from "@/lib/fixtures/durand";
import { PlanSkeleton } from "@/components/plan/PlanSkeleton";

type Phase = "idle" | "recording" | "transcribing" | "generating";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function DictateStep() {
  const t = useT();
  const reduce = useReducedMotion();
  const dictationLang = useStore((s) => s.dictationLang);
  const setDictationLang = useStore((s) => s.setDictationLang);
  const transcript = useStore((s) => s.draftTranscript);
  const setTranscript = useStore((s) => s.setDraftTranscript);
  const priceList = useStore((s) => s.priceList);
  const savePlan = useStore((s) => s.savePlan);
  const setStep = useStore((s) => s.setStep);

  const rec = useRecorder();
  const live = useLiveCaption();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [reveal, setReveal] = useState<string | null>(null); // freshly transcribed text being "written"
  const lastBlobRef = useRef<Blob | null>(null);
  const baseTextRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const errText = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError) return (t.errors as Record<string, string>)[e.code] ?? fallback;
      return fallback;
    },
    [t],
  );

  const appendText = useCallback(
    (base: string, add: string) => {
      const next = [base.trim(), add.trim()].filter(Boolean).join(base.trim().endsWith(".") || !base.trim() ? " " : ". ");
      setTranscript(next);
      return next;
    },
    [setTranscript],
  );

  const runTranscription = useCallback(
    async (blob: Blob, liveText: string) => {
      setPhase("transcribing");
      setError(null);
      setNotice(null);
      try {
        const r = await transcribeAudio(blob, dictationLang);
        lastBlobRef.current = null;
        setEngine(`${r.model}`);
        if (r.text.trim()) {
          appendText(baseTextRef.current, r.text);
          if (!reduce) setReveal(r.text);
        }
      } catch (e) {
        if (liveText) {
          appendText(baseTextRef.current, liveText);
          setEngine("Web Speech API");
          setNotice(t.transcript.fallbackUsed);
          lastBlobRef.current = blob;
        } else {
          lastBlobRef.current = blob;
          setError(errText(e, t.errors.transcribe));
        }
      } finally {
        setPhase("idle");
        live.reset();
      }
    },
    [appendText, dictationLang, errText, live, reduce, t],
  );

  const startRecording = useCallback(async () => {
    if (phase !== "idle") return;
    setError(null);
    setNotice(null);
    baseTextRef.current = useStore.getState().draftTranscript;
    const ok = await rec.start();
    if (ok) {
      setPhase("recording");
      if (liveCaptionSupported()) live.start(dictationLang);
    }
  }, [dictationLang, live, phase, rec]);

  const stopRecording = useCallback(async () => {
    if (phase !== "recording") return;
    const liveText = live.stop();
    const blob = await rec.stop();
    if (!blob || blob.size < 1200) {
      setPhase("idle");
      setError(t.errors.tooShort);
      return;
    }
    await runTranscription(blob, liveText);
  }, [live, phase, rec, runTranscription, t]);

  const toggle = useCallback(() => (phase === "recording" ? stopRecording() : startRecording()), [phase, startRecording, stopRecording]);

  const generate = useCallback(async () => {
    const text = useStore.getState().draftTranscript.trim();
    if (text.length < 3 || phase !== "idle") return;
    setPhase("generating");
    setError(null);
    try {
      const plan = await createPlan(text, dictationLang, priceList);
      savePlan({ ...plan, startDate: plan.startDate ?? today() });
      setStep(plan.questions.some((q) => !q.answered) ? "clarify" : "review");
    } catch (e) {
      setError(errText(e, t.errors.generic));
    } finally {
      setPhase("idle");
    }
  }, [dictationLang, errText, phase, priceList, savePlan, setStep, t]);

  // keyboard: hold Space to talk, Ctrl/⌘+Enter to generate
  const spaceHeldRef = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
        return;
      }
      if (e.code === "Space" && !e.repeat && !isTypingTarget(e.target) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (phase === "idle") {
          spaceHeldRef.current = true;
          startRecording();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = false;
        stopRecording();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [generate, phase, startRecording, stopRecording]);

  // auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(180, el.scrollHeight)}px`;
  }, [transcript, reveal]);

  // end the "manuscript" reveal after the words have faded in
  useEffect(() => {
    if (!reveal) return;
    const words = reveal.split(/\s+/).length;
    const id = setTimeout(() => setReveal(null), Math.min(2400, words * 28 + 400));
    return () => clearTimeout(id);
  }, [reveal]);

  const onUpload = async (f: File | undefined) => {
    if (!f) return;
    baseTextRef.current = useStore.getState().draftTranscript;
    await runTranscription(f, "");
    if (fileRef.current) fileRef.current.value = "";
  };

  const recording = phase === "recording";
  const busy = phase === "transcribing" || phase === "generating";
  const liveText = `${live.finalText} ${live.interim}`.trim();
  const revealBase = reveal ? transcript.slice(0, Math.max(0, transcript.length - reveal.length)).trim() : "";

  if (phase === "generating") {
    return (
      <div>
        <StepHeading eyebrow={`01 · ${t.steps.dictate}`} title={t.transcript.generating} />
        <p className="mb-8 max-w-[60ch] font-serif text-[20px] leading-[1.45] text-ink-2">{transcript}</p>
        <PlanSkeleton label={t.transcript.generating} />
      </div>
    );
  }

  return (
    <div>
      <StepHeading eyebrow={`01 · ${t.steps.dictate}`} title={t.stepHints.dictate} />

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* recorder column */}
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <RecordButton
            recording={recording}
            busy={phase === "transcribing"}
            levelRef={rec.levelRef}
            onClick={toggle}
            label={recording ? t.record.stop : t.record.idle}
          />
          <div className="text-center lg:pl-2 lg:text-left" aria-live="polite">
            {recording ? (
              <p className="flex items-center gap-2 text-sm text-record">
                <span className="inline-block size-1.5 rounded-full bg-record" style={{ animation: "breathe 1.6s ease-in-out infinite" }} />
                {t.record.recording} <span className="num">{formatClock(rec.elapsed)}</span>
              </p>
            ) : phase === "transcribing" ? (
              <p className="text-sm text-accent">{t.record.transcribing}</p>
            ) : (
              <>
                <p className="text-sm text-ink">{transcript ? t.record.append : t.record.idle}</p>
                <p className="text-[12px] text-ink-3">{t.record.idleHint}</p>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-col items-center gap-3 lg:items-start lg:pl-2">
            <div>
              <p className="eyebrow mb-1.5">{t.record.dictationLang}</p>
              <Segmented
                label={t.record.dictationLang}
                value={dictationLang}
                onChange={setDictationLang}
                options={[
                  { value: "fr", label: "Français" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || recording}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink disabled:opacity-40"
            >
              <Icon.Upload size={13} /> {t.record.upload}
            </button>
            <input ref={fileRef} type="file" accept="audio/*" className="sr-only" tabIndex={-1} onChange={(e) => onUpload(e.target.files?.[0])} />
          </div>
          {rec.error && (
            <p role="alert" className="max-w-[220px] text-[13px] text-record">
              {rec.error === "denied" ? t.record.micDenied : t.record.micMissing}
            </p>
          )}
        </div>

        {/* transcript column */}
        <div className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <h2 className="eyebrow">{t.transcript.title}</h2>
            <div className="flex items-center gap-3 text-[12px] text-ink-3">
              {recording && liveCaptionSupported() && <span className="italic">{t.transcript.live}</span>}
              {engine && !recording && (
                <span>
                  {t.transcript.engine} · <span className="num">{engine}</span>
                </span>
              )}
            </div>
          </div>

          {recording || phase === "transcribing" ? (
            <div className="min-h-[180px] font-serif text-[26px] leading-[1.4] tracking-[-0.005em]" aria-live="polite">
              {transcript && <span className="text-ink">{transcript} </span>}
              <span className="text-ink-2">
                {liveText.split(/\s+/).filter(Boolean).map((w, i) => (
                  <motion.span key={i} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    {w}{" "}
                  </motion.span>
                ))}
              </span>
              {recording && <span className="ml-0.5 inline-block h-[0.9em] w-px translate-y-[0.12em] bg-record align-baseline" style={{ animation: "breathe 1s steps(2) infinite" }} />}
              {!transcript && !liveText && <span className="text-ink-3">{t.record.example}</span>}
            </div>
          ) : reveal ? (
            <div className="min-h-[180px] font-serif text-[26px] leading-[1.4] tracking-[-0.005em]">
              {revealBase && <span>{revealBase} </span>}
              {reveal.split(/\s+/).map((w, i) => (
                <motion.span key={i} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.028, duration: 0.22, ease: "easeOut" }}>
                  {w}{" "}
                </motion.span>
              ))}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={t.transcript.placeholder}
              aria-label={t.transcript.title}
              spellCheck
              lang={dictationLang}
              className="block min-h-[180px] w-full resize-none bg-transparent font-serif text-[26px] leading-[1.4] tracking-[-0.005em] text-ink placeholder:text-ink-3 focus:outline-none"
            />
          )}

          <AnimatePresence>
            {(error || notice) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role={error ? "alert" : "status"}
                className={`mt-4 flex flex-wrap items-center gap-3 rounded-[6px] border px-3 py-2 text-[13px] ${error ? "border-record/30 bg-record-soft text-record" : "border-warn/30 bg-warn-soft text-warn"}`}
              >
                <span>{error ?? notice}</span>
                {lastBlobRef.current && (
                  <Button size="sm" variant="ghost" onClick={() => lastBlobRef.current && runTranscription(lastBlobRef.current, "")}>
                    <Icon.Refresh size={14} /> {t.plan.retry}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
            <Button variant="primary" size="lg" onClick={generate} disabled={busy || recording || transcript.trim().length < 3}>
              {t.transcript.generate}
              <Icon.Arrow />
            </Button>
            <span className="hidden text-[12px] text-ink-3 sm:inline">
              <kbd className="num">Ctrl</kbd> + <kbd className="num">↵</kbd>
            </span>
            <div className="ml-auto flex gap-1">
              {!transcript && (
                <Button variant="ghost" size="sm" onClick={() => setTranscript(DURAND_TRANSCRIPT)}>
                  {t.transcript.demo}
                </Button>
              )}
              {transcript && (
                <Button variant="ghost" size="sm" onClick={() => setTranscript("")} disabled={busy || recording}>
                  {t.transcript.clear}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.015em] md:text-[48px]">{title}</h1>
      </div>
      {children}
    </div>
  );
}
