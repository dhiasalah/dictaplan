"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cx, Segmented } from "@/components/ui/primitives";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const uiLang = useStore((s) => s.uiLang);
  const setUiLang = useStore((s) => s.setUiLang);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  const links = [
    { href: "/", label: t.nav.workspace },
    { href: "/history", label: t.nav.history },
    { href: "/settings", label: t.nav.settings },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur-[2px]">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-5 md:px-8">
          <Link href="/" className="flex items-baseline gap-2" aria-label={t.app.name}>
            <span className="font-serif text-[26px] leading-none tracking-[-0.01em]">Dictaplan</span>
            <span className="hidden text-[12px] text-ink-3 sm:inline">{t.app.tagline}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1" aria-label="Navigation">
            {links.map((l) => {
              const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cx(
                    "relative px-3 py-1.5 text-[13px] transition-colors duration-150",
                    active ? "text-ink" : "text-ink-2 hover:text-ink",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                  {active && <span className="absolute inset-x-3 -bottom-[13px] h-px bg-ink" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          <Segmented
            label="Langue / Language"
            value={uiLang}
            onChange={setUiLang}
            options={[
              { value: "fr", label: "FR" },
              { value: "en", label: "EN" },
            ]}
          />
        </div>
      </header>
      <div className={cx("transition-opacity duration-200", hydrated ? "opacity-100" : "opacity-0")}>{children}</div>
    </div>
  );
}
