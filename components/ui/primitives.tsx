"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink border border-accent hover:border-accent-ink",
  secondary: "bg-surface text-ink border border-rule hover:border-rule-strong",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-black/[0.03] border border-transparent",
  danger: "bg-transparent text-record border border-transparent hover:bg-record-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex items-center justify-center rounded-[6px] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap",
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      />
    );
  },
);

export function Chip({
  selected,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      aria-pressed={selected}
      className={cx(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-45",
        selected ? "border-accent bg-accent text-white" : "border-rule-strong bg-surface text-ink hover:border-accent hover:text-accent",
        className,
      )}
      {...rest}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-rule-strong focus:border-accent focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(
        "w-full rounded-[6px] border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-rule-strong focus:border-accent focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
});

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("mb-1.5 block text-[12px] font-medium text-ink-2", className)}>
      {children}
    </label>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-[10px] border border-rule bg-surface", className)}>{children}</section>;
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-rule", className)} />;
}

/** Segmented control: FR | EN etc. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[6px] border border-rule bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-[4px] px-2.5 text-[12px] font-medium tracking-wide transition-colors duration-150",
            value === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Line icons (1.5px stroke, drawn for this app) ── */
type IconProps = { size?: number; className?: string };
const svg = (size: number, className: string | undefined, children: ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);
export const Icon = {
  Mic: ({ size = 18, className }: IconProps) => svg(size, className, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>),
  Stop: ({ size = 18, className }: IconProps) => svg(size, className, <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />),
  Plus: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M12 5v14M5 12h14" />),
  Trash: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M5 7h14M10 11v6M14 11v6M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />),
  Grip: ({ size = 16, className }: IconProps) => svg(size, className, <><circle cx="9" cy="7" r=".6" fill="currentColor" /><circle cx="15" cy="7" r=".6" fill="currentColor" /><circle cx="9" cy="12" r=".6" fill="currentColor" /><circle cx="15" cy="12" r=".6" fill="currentColor" /><circle cx="9" cy="17" r=".6" fill="currentColor" /><circle cx="15" cy="17" r=".6" fill="currentColor" /></>),
  Arrow: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M5 12h14M13 6l6 6-6 6" />),
  Back: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M19 12H5M11 6l-6 6 6 6" />),
  Download: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />),
  Check: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M5 12.5l4.5 4.5L19 7.5" />),
  Close: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M6 6l12 12M18 6L6 18" />),
  Upload: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />),
  Copy: ({ size = 16, className }: IconProps) => svg(size, className, <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>),
  Pen: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M14.5 5.5l4 4M4 20l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19 4 20z" />),
  Refresh: ({ size = 16, className }: IconProps) => svg(size, className, <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" />),
};
