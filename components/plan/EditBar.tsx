"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { ApiError, refinePlan, transcribeAudio } from "@/lib/client/api";
import { useRecorder } from "@/components/recorder/useRecorder";
import { Button, cx, Icon, Input } from "@/components/ui/primitives";

/** "Regenerate with modifications": type or dictate a change, the LLM returns the updated plan. */
export function EditBar() {
  const t = useT();
  const update = useStore((s) => s.updateCurrent);
  const priceList = useStore((s) => s.priceList);
  const lang = useStore((s) => s.dictationLang);
  const rec = useRecorder();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "transcribing" | "applying">(null);
  const [error, setError] = useState<string | null>(null);

  const errMsg = (e: unknown) => (e instanceof ApiError ? ((t.errors as Record<string, string>)[e.code] ?? t.errors.generic) : t.errors.generic);

  const apply = async (instruction: string) => {
    const s = useStore.getState();
    const plan = s.currentId ? s.plans[s.currentId] : null;
    if (!plan || !instruction.trim()) return;
    setBusy("applying");
    setError(null);
    try {
      const next = await refinePlan(plan, instruction, priceList);
      update(() => next);
      setText("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleMic = async () => {
    if (rec.recording) {
      const blob = await rec.stop();
      if (!blob) return;
      setBusy("transcribing");
      try {
        const r = await transcribeAudio(blob, lang);
        setText(r.text);
        setBusy(null);
        if (r.text.trim()) await apply(r.text);
      } catch (e) {
        setError(errMsg(e));
        setBusy(null);
      }
    } else {
      setError(null);
      await rec.start();
    }
  };

  return (
    <div className="mt-10 rounded-[10px] border border-rule bg-surface p-4">
      <p className="eyebrow mb-3">{t.plan.voiceEdit}</p>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply(text);
        }}
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={!!busy}
          aria-label={rec.recording ? t.record.stop : t.plan.voiceEdit}
          aria-pressed={rec.recording}
          className={cx(
            "grid size-10 shrink-0 place-items-center rounded-full border transition-colors duration-150 disabled:opacity-40",
            rec.recording ? "border-record bg-record text-white" : "border-rule-strong text-ink hover:border-accent hover:text-accent",
          )}
        >
          {rec.recording ? <Icon.Stop size={14} /> : <Icon.Mic size={17} />}
        </button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={rec.recording ? t.record.recording + "…" : `${t.plan.textEditPlaceholder} ${t.plan.voiceEditHint}`}
          aria-label={t.plan.textEditPlaceholder}
          disabled={!!busy || rec.recording}
          className="font-serif text-[17px]"
        />
        <Button type="submit" variant="primary" disabled={!!busy || !text.trim()}>
          {busy === "applying" ? t.clarify.updating : busy === "transcribing" ? t.record.transcribing : t.plan.applyEdit}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-record">
          {error}
        </p>
      )}
    </div>
  );
}
