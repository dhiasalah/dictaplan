"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cx, Icon } from "@/components/ui/primitives";

/**
 * The signature record control: a large circle whose thin outer ring follows
 * the voice amplitude in real time. Idle = ink outline; recording = brick red
 * with a breathing halo.
 */
export function RecordButton({
  recording,
  busy,
  levelRef,
  onClick,
  label,
  size = 168,
}: {
  recording: boolean;
  busy?: boolean;
  levelRef: RefObject<number>;
  onClick: () => void;
  label: string;
  size?: number;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const ring2Ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!recording) {
      ringRef.current?.setAttribute("r", "46");
      ring2Ref.current?.setAttribute("r", "46");
      return;
    }
    let raf = 0;
    const loop = () => {
      const l = levelRef.current ?? 0;
      ringRef.current?.setAttribute("r", String(46 + l * 8));
      ring2Ref.current?.setAttribute("r", String(46 + l * 3.5));
      ringRef.current?.setAttribute("stroke-opacity", String(0.25 + l * 0.75));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [recording, levelRef]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-pressed={recording}
      className={cx("group relative grid place-items-center rounded-full transition-transform duration-200 ease-out active:scale-[0.98] disabled:opacity-60")}
      style={{ width: size, height: size }}
    >
      {recording && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-record/15"
          style={{ animation: "breathe 2.4s ease-in-out infinite" }}
        />
      )}
      <svg viewBox="0 0 120 120" width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden>
        <circle
          ref={ringRef}
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={recording ? "var(--record)" : "var(--ink)"}
          strokeWidth={recording ? 1 : 1}
          strokeOpacity={recording ? 0.6 : 0.18}
        />
        <circle ref={ring2Ref} cx="60" cy="60" r="46" fill="none" stroke={recording ? "var(--record)" : "var(--ink)"} strokeWidth="1.25" strokeOpacity={recording ? 0.9 : 0.9} />
        <circle
          cx="60"
          cy="60"
          r="38"
          className="transition-[fill] duration-200"
          fill={recording ? "var(--record)" : "var(--surface)"}
          stroke={recording ? "none" : "var(--rule-strong)"}
        />
        {busy && (
          <circle cx="60" cy="60" r="46" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="40 250" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <span className={cx("relative transition-colors duration-200", recording ? "text-white" : "text-ink group-hover:text-accent")}>
        {recording ? <Icon.Stop size={26} /> : <Icon.Mic size={30} />}
      </span>
    </button>
  );
}
