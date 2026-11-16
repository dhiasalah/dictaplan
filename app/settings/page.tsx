"use client";

import { useRef } from "react";
import { nanoid } from "nanoid";
import { AppShell } from "@/components/shell/AppShell";
import { useStore, type Practice } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button, Icon, Input, Label } from "@/components/ui/primitives";
import { SEED_PRICE_LIST, type PriceItem } from "@/lib/seed/price-list.fr";
import { parseMoney } from "@/components/plan/editing";

/** Downscale uploaded images so they stay small in IndexedDB and in the PDF. */
function readImage(file: File, maxW = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ImageField({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-[6px] border border-rule bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain p-1" /> : <span className="text-[11px] text-ink-3">—</span>}
        </div>
        <Button size="sm" onClick={() => ref.current?.click()}>
          <Icon.Upload size={14} /> {t.settings.upload}
        </Button>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            {t.settings.remove}
          </Button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onChange(await readImage(f));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const practice = useStore((s) => s.practice);
  const setPractice = useStore((s) => s.setPractice);
  const priceList = useStore((s) => s.priceList);
  const setPriceList = useStore((s) => s.setPriceList);
  const uiLang = useStore((s) => s.uiLang);

  const field = (key: keyof Practice, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Input id={`f-${key}`} value={(practice[key] as string) ?? ""} onChange={(e) => setPractice({ [key]: e.target.value })} {...props} />
    </div>
  );

  const setItem = (id: string, patch: Partial<PriceItem>) => setPriceList(priceList.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-10 md:px-8">
        <p className="eyebrow mb-2">{t.settings.saved}</p>
        <h1 className="mb-10 font-serif text-[48px] leading-none tracking-[-0.015em]">{t.settings.title}</h1>

        <section className="mb-14 grid gap-10 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="font-serif text-[26px] leading-tight">{t.settings.practice}</h2>
            <p className="mt-2 text-[13px] text-ink-2">{t.settings.onboarding}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {field("name", t.settings.practiceName)}
            {field("dentist", t.settings.dentistName)}
            <div className="sm:col-span-2">{field("address", t.settings.address)}</div>
            {field("phone", t.settings.phone, { type: "tel" })}
            {field("email", t.settings.email, { type: "email" })}
            {field("rpps", t.settings.rpps, { inputMode: "numeric", className: "num" })}
            <div>
              <Label htmlFor="f-validity">{t.settings.validity}</Label>
              <Input
                id="f-validity"
                inputMode="numeric"
                className="num"
                value={practice.validityMonths}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setPractice({ validityMonths: Number.isFinite(n) && n > 0 && n < 37 ? n : 3 });
                }}
              />
            </div>
            <ImageField label={t.settings.logo} value={practice.logo} onChange={(logo) => setPractice({ logo })} />
            <ImageField label={t.settings.signature} value={practice.signature} onChange={(signature) => setPractice({ signature })} />
            <p className="rounded-[6px] border border-rule bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-ink-2 sm:col-span-2">{t.settings.privacy}</p>
          </div>
        </section>

        <section className="grid gap-10 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="font-serif text-[26px] leading-tight">{t.settings.prices}</h2>
            <p className="mt-2 text-[13px] text-ink-2">{t.settings.pricesHint}</p>
          </div>
          <div className="min-w-0">
            <div className="overflow-x-auto rounded-[10px] border border-rule bg-surface">
              <table className="w-full min-w-[600px] border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-rule text-left text-[11px] uppercase tracking-[0.08em] text-ink-3">
                    <th className="w-[110px] px-3 py-2.5 font-medium">{t.settings.code}</th>
                    <th className="px-3 py-2.5 font-medium">{t.settings.label}</th>
                    <th className="w-[110px] px-3 py-2.5 text-right font-medium">{t.settings.price}</th>
                    <th className="w-[80px] px-3 py-2.5 text-center font-medium">{t.settings.perTooth}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {priceList.map((p) => (
                    <tr key={p.id} className="group border-b border-rule/70 last:border-0">
                      <td className="px-2 py-1">
                        <input
                          value={p.code ?? ""}
                          onChange={(e) => setItem(p.id, { code: e.target.value || undefined })}
                          aria-label={t.settings.code}
                          className="field-quiet num h-8 w-full px-1.5 text-[12px] uppercase"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={uiLang === "en" && p.labelEn ? p.labelEn : p.label}
                          onChange={(e) => setItem(p.id, uiLang === "en" ? { labelEn: e.target.value } : { label: e.target.value })}
                          aria-label={t.settings.label}
                          className="field-quiet h-8 w-full px-1.5"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          key={`${p.id}-${p.price}`}
                          defaultValue={p.price.toFixed(2)}
                          onBlur={(e) => {
                            const n = parseMoney(e.target.value);
                            if (n != null) setItem(p.id, { price: n });
                            e.target.value = (n ?? p.price).toFixed(2);
                          }}
                          inputMode="decimal"
                          aria-label={t.settings.price}
                          className="field-quiet num h-8 w-full px-1.5 text-right"
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={p.perTooth}
                          onChange={(e) => setItem(p.id, { perTooth: e.target.checked })}
                          aria-label={t.settings.perTooth}
                          className="size-4 accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => setPriceList(priceList.filter((x) => x.id !== p.id))}
                          className="text-ink-3 opacity-0 transition-opacity hover:text-record focus:opacity-100 group-hover:opacity-100"
                          aria-label={t.history.delete}
                        >
                          <Icon.Close size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPriceList([...priceList, { id: nanoid(8), label: uiLang === "fr" ? "Nouvel acte" : "New procedure", price: 0, perTooth: true }])}>
                <Icon.Plus size={14} /> {t.settings.addRow}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPriceList(SEED_PRICE_LIST)}>
                {t.settings.reset}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
