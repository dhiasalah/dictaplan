"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AppShell } from "@/components/shell/AppShell";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button, Icon } from "@/components/ui/primitives";
import { formatMoney, planTotal } from "@/lib/plan/compute";
import { phaseColor } from "@/lib/plan/fdi";

export default function HistoryPage() {
  const t = useT();
  const router = useRouter();
  const plans = useStore((s) => s.plans);
  const lang = useStore((s) => s.uiLang);
  const openPlan = useStore((s) => s.openPlan);
  const duplicatePlan = useStore((s) => s.duplicatePlan);
  const deletePlan = useStore((s) => s.deletePlan);
  const [confirm, setConfirm] = useState<string | null>(null);

  const list = Object.values(plans).sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const open = (id: string) => {
    openPlan(id);
    router.push("/");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-10 md:px-8">
        <p className="eyebrow mb-2">{t.history.local}</p>
        <h1 className="mb-10 font-serif text-[48px] leading-none tracking-[-0.015em]">{t.history.title}</h1>

        {list.length === 0 ? (
          <p className="border-t border-rule pt-6 text-ink-2">{t.history.empty}</p>
        ) : (
          <ul className="border-t border-rule">
            <AnimatePresence initial={false}>
              {list.map((p) => {
                const total = planTotal(p);
                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule py-4"
                  >
                    <button onClick={() => open(p.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-serif text-[22px] leading-tight group-hover:text-accent">
                        {p.patient.name || p.patient.reference || t.history.untitled}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-3">
                        <span className="num">{fmtDate(p.updatedAt ?? p.createdAt)}</span>
                        <span className="flex gap-0.5" aria-hidden>
                          {p.phases.map((ph) => (
                            <span key={ph.id} className="h-1.5 w-4 rounded-[1px]" style={{ background: phaseColor(ph.order) }} />
                          ))}
                        </span>
                        <span>
                          {p.phases.length} {t.pdf.phases}
                        </span>
                        <span className={p.status === "final" ? "text-accent" : ""}>{p.status === "final" ? t.history.final : t.history.draft}</span>
                      </span>
                    </button>
                    <span className="num text-[17px]">{formatMoney(total.total, lang)}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => open(p.id)}>
                        {t.history.open}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicatePlan(p.id)} aria-label={t.history.duplicate} title={t.history.duplicate}>
                        <Icon.Copy size={14} />
                      </Button>
                      {confirm === p.id ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            deletePlan(p.id);
                            setConfirm(null);
                          }}
                          onBlur={() => setConfirm(null)}
                          autoFocus
                        >
                          {t.history.confirmDelete}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(p.id)} aria-label={t.history.delete} title={t.history.delete}>
                          <Icon.Trash size={14} />
                        </Button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </AppShell>
  );
}
