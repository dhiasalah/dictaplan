/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> has no alt prop */
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View, G, Line } from "@react-pdf/renderer";
import type { TreatmentPlan } from "@/lib/ai/schema";
import type { Practice } from "@/lib/practice";
import type { Dict } from "@/lib/i18n/fr";
import {
  formatDuration,
  formatMoney,
  offsetLabel,
  phaseSpans,
  phaseTotals,
  planTotal,
  procedureSubtotal,
  schedule,
  sortedPhases,
  teethByPhase,
  totalDurationDays,
  addDays,
} from "@/lib/plan/compute";
import { chartLayout, isDeciduous, phaseColor, phaseTint } from "@/lib/plan/fdi";

let fontsRegistered = false;
export function registerPdfFonts(origin: string) {
  if (fontsRegistered) return;
  const f = (n: string) => `${origin}/fonts/${n}`;
  Font.register({
    family: "Geist",
    fonts: [
      { src: f("geist-400.woff"), fontWeight: 400 },
      { src: f("geist-500.woff"), fontWeight: 500 },
      { src: f("geist-600.woff"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "GeistMono",
    fonts: [
      { src: f("geist-mono-400.woff"), fontWeight: 400 },
      { src: f("geist-mono-500.woff"), fontWeight: 500 },
    ],
  });
  Font.register({
    family: "Instrument",
    fonts: [
      { src: f("instrument-serif-400.woff"), fontWeight: 400 },
      { src: f("instrument-serif-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  fontsRegistered = true;
}

const C = {
  ink: "#16181D",
  ink2: "#5B606B",
  ink3: "#8B8F98",
  rule: "#E4E0D8",
  accent: "#1F4D45",
  paper: "#FFFFFF",
};
const MM = 2.8346;

const s = StyleSheet.create({
  page: { paddingTop: 20 * MM, paddingBottom: 22 * MM, paddingHorizontal: 20 * MM, fontFamily: "Geist", fontSize: 9, color: C.ink, lineHeight: 1.4, backgroundColor: C.paper },
  hair: { borderBottomWidth: 0.5, borderBottomColor: C.rule },
  eyebrow: { fontSize: 6.5, letterSpacing: 1.1, textTransform: "uppercase", color: C.ink2, fontWeight: 500 },
  mono: { fontFamily: "GeistMono" },
  serif: { fontFamily: "Instrument" },
  th: { fontSize: 6.5, letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3, fontWeight: 500 },
  row: { flexDirection: "row", alignItems: "flex-start" },
});

const COLS = { label: "48%", teeth: "16%", qty: "8%", unit: "14%", sub: "14%" };

export interface PlanDocumentProps {
  plan: TreatmentPlan;
  practice: Practice;
  t: Dict;
}

function fmtDate(iso: string, t: Dict, lang: "fr" | "en") {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return lang === "fr" ? `${d} ${t.months[m - 1]} ${y}` : `${t.months[m - 1]} ${d}, ${y}`;
}

export function PlanDocument({ plan, practice, t }: PlanDocumentProps) {
  const lang = plan.language;
  const money = (n: number | null) => formatMoney(n, lang);
  const phases = sortedPhases(plan);
  const sched = schedule({ ...plan, startDate: plan.startDate });
  const total = planTotal(plan);
  const duration = totalDurationDays(plan);
  const issued = (plan.updatedAt ?? plan.createdAt).slice(0, 10);
  const ref = plan.patient.reference || `PT-${plan.createdAt.slice(2, 10).replace(/-/g, "")}-${plan.id.slice(0, 4).toUpperCase()}`;
  const patientLabel = [plan.patient.name, plan.patient.age != null ? `${plan.patient.age} ${lang === "fr" ? "ans" : "y/o"}` : null].filter(Boolean).join(", ");
  const contact = [practice.phone, practice.email].filter(Boolean).join(" · ");

  return (
    <Document title={`${t.pdf.title} ${patientLabel || ref}`} author={practice.dentist || practice.name || "Dictaplan"} creator="Dictaplan" language={lang}>
      <Page size="A4" style={s.page} wrap>
        {/* running header on pages 2+ */}
        <View
          fixed
          style={{ position: "absolute", top: 10 * MM, left: 20 * MM, right: 20 * MM, flexDirection: "row", justifyContent: "space-between" }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingBottom: 3 }}>
                <Text style={{ fontSize: 7, color: C.ink2 }}>{practice.name || t.pdf.title}</Text>
                <Text style={{ fontSize: 7, color: C.ink2 }}>
                  {t.pdf.title} · {patientLabel || ref}
                </Text>
              </View>
            ) : null
          }
        />

        {/* 10 · footer */}
        <View fixed style={{ position: "absolute", top: 841.89 - 10 * MM - 14, left: 20 * MM, right: 20 * MM, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 4 }}>
          <Text style={{ fontSize: 7, color: C.ink3 }}>{[practice.name, practice.address, contact].filter(Boolean).join(" · ")}</Text>
          <Text style={[s.mono, { fontSize: 7, color: C.ink3 }]} render={({ pageNumber, totalPages }) => t.pdf.page(pageNumber, totalPages)} />
        </View>

        {/* 1 · header */}
        <View style={[s.row, { justifyContent: "space-between", paddingBottom: 10 }, s.hair]}>
          <View style={[s.row, { gap: 10, alignItems: "center", maxWidth: "60%" }]}>
            {practice.logo ? <Image src={practice.logo} style={{ width: 34, height: 34, objectFit: "contain" }} /> : null}
            <View>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>{practice.name || "Cabinet dentaire"}</Text>
              {practice.address ? <Text style={{ color: C.ink2, fontSize: 8 }}>{practice.address}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {practice.dentist ? <Text style={{ fontSize: 9, fontWeight: 500 }}>{practice.dentist}</Text> : null}
            {practice.rpps ? (
              <Text style={[s.mono, { fontSize: 7.5, color: C.ink2 }]}>
                {t.pdf.rpps} {practice.rpps}
              </Text>
            ) : null}
            {contact ? <Text style={{ fontSize: 7.5, color: C.ink2 }}>{contact}</Text> : null}
          </View>
        </View>

        {/* 2 · title block */}
        <View style={{ marginTop: 16, marginBottom: 12 }}>
          <Text style={[s.serif, { fontSize: 34, lineHeight: 1.2, letterSpacing: -0.4 }]}>{t.pdf.title}</Text>
          <View style={[s.row, { marginTop: 10, gap: 22 }]}>
            <Meta label={t.pdf.patient} value={patientLabel || "—"} />
            <Meta label={t.pdf.date} value={fmtDate(issued, t, lang)} />
            <Meta label={t.pdf.ref} value={ref} mono />
          </View>
        </View>

        {/* 3 · overview strip */}
        <View style={[s.row, { borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.rule, paddingVertical: 9, marginBottom: 14 }]}>
          <Big value={String(phases.length)} label={t.pdf.phases} />
          <Big value={formatDuration(duration, lang)} label={t.pdf.duration} border />
          <Big value={money(total.total)} label={t.pdf.total} border accent />
        </View>

        {/* 4 · chart + 6 · timeline side by side */}
        <View style={[s.row, { gap: 18, marginBottom: 18 }]} wrap={false}>
          <View style={{ width: "46%" }}>
            <Text style={[s.eyebrow, { marginBottom: 6 }]}>{t.pdf.chart}</Text>
            <PdfChart plan={plan} />
          </View>
          <View style={{ width: "54%" }}>
            <Text style={[s.eyebrow, { marginBottom: 6 }]}>{t.pdf.timeline}</Text>
            <PdfTimeline plan={plan} t={t} />
          </View>
        </View>

        {/* 5 · phases */}
        {phases.map((ph) => {
          const tot = phaseTotals(ph);
          const sc = sched.find((x) => x.phaseId === ph.id)!;
          const color = phaseColor(ph.order);
          const when = [offsetLabel(sc.offsetDays, lang), sc.startDate ? fmtDate(sc.startDate, t, lang) : null, ph.estimatedSessions ? `${ph.estimatedSessions} ${lang === "fr" ? "séance(s)" : "session(s)"}` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <View key={ph.id} style={{ marginBottom: 14 }}>
              <View minPresenceAhead={60} wrap={false} style={[s.row, { alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }]}>
                <View style={[s.row, { alignItems: "center", gap: 6 }]}>
                  <View style={{ width: 3, height: 14, backgroundColor: color, borderRadius: 1 }} />
                  <Text style={[s.serif, { fontSize: 16, lineHeight: 1.3 }]}>{ph.title}</Text>
                </View>
                <Text style={{ fontSize: 7.5, color }}>{when}</Text>
              </View>
              {/* column header: repeated on each page the table spans */}
              <View fixed style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: C.ink3, paddingVertical: 3, backgroundColor: C.paper }]} wrap={false}>
                <Text style={[s.th, { width: COLS.label }]}>{t.pdf.procedure}</Text>
                <Text style={[s.th, { width: COLS.teeth }]}>{t.pdf.teeth}</Text>
                <Text style={[s.th, { width: COLS.qty, textAlign: "right" }]}>{t.pdf.qty}</Text>
                <Text style={[s.th, { width: COLS.unit, textAlign: "right" }]}>{t.pdf.unit}</Text>
                <Text style={[s.th, { width: COLS.sub, textAlign: "right" }]}>{t.pdf.subtotal}</Text>
              </View>
              {ph.procedures.map((p) => (
                <View key={p.id} wrap={false} style={[s.row, s.hair, { paddingVertical: 4 }]}>
                  <View style={{ width: COLS.label, paddingRight: 6 }}>
                    <Text>{p.label}</Text>
                    {p.code || p.notes ? (
                      <Text style={{ fontSize: 6.8, color: C.ink3 }}>{[p.code, p.notes].filter(Boolean).join(" · ")}</Text>
                    ) : null}
                  </View>
                  <Text style={[s.mono, { width: COLS.teeth, fontSize: 8 }]}>{p.teeth.length ? p.teeth.join(", ") : t.pdf.whole}</Text>
                  <Text style={[s.mono, { width: COLS.qty, textAlign: "right", fontSize: 8 }]}>{p.quantity}</Text>
                  <Text style={[s.mono, { width: COLS.unit, textAlign: "right", fontSize: 8 }]}>{money(p.unitPrice)}</Text>
                  <Text style={[s.mono, { width: COLS.sub, textAlign: "right", fontSize: 8 }]}>{money(procedureSubtotal(p))}</Text>
                </View>
              ))}
              <View wrap={false} style={[s.row, { justifyContent: "flex-end", paddingTop: 4, gap: 10 }]}>
                <Text style={{ fontSize: 7.5, color: C.ink2 }}>{t.pdf.phaseTotal}</Text>
                <Text style={[s.mono, { fontSize: 9, fontWeight: 500, width: COLS.sub, textAlign: "right" }]}>{money(tot.total)}</Text>
              </View>
              {ph.notes ? <Text style={{ fontSize: 7.5, color: C.ink2, fontStyle: "italic", marginTop: 2 }}>{ph.notes}</Text> : null}
            </View>
          );
        })}

        {/* 7 · totals */}
        <View wrap={false} style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 8 }}>
          <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-end" }]}>
            <Text style={[s.serif, { fontSize: 16, lineHeight: 1.3 }]}>{t.pdf.grandTotal}</Text>
            <Text style={[s.mono, { fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: C.accent }]}>{money(total.total)}</Text>
          </View>
          <View style={[s.row, { justifyContent: "space-between", marginTop: 6 }]}>
            <Text style={{ fontSize: 8, color: C.ink2 }}>{t.pdf.secu}</Text>
            <Text style={[s.mono, { fontSize: 8.5 }]}>{plan.insuranceShare != null ? money(plan.insuranceShare) : "_______________"}</Text>
          </View>
          <View style={[s.row, { justifyContent: "space-between", marginTop: 3 }]}>
            <Text style={{ fontSize: 8, color: C.ink2 }}>{t.pdf.rac}</Text>
            <Text style={[s.mono, { fontSize: 8.5 }]}>{plan.insuranceShare != null ? money(Math.max(0, total.total - plan.insuranceShare)) : "_______________"}</Text>
          </View>
        </View>

        {/* 8 · notes & conditions */}
        <View wrap={false} style={{ marginTop: 14 }}>
          <Text style={[s.eyebrow, { marginBottom: 4 }]}>{t.pdf.notes}</Text>
          {plan.generalNotes ? <Text style={{ marginBottom: 4 }}>{plan.generalNotes}</Text> : null}
          <Text style={{ fontSize: 7.5, color: C.ink2 }}>
            {t.pdf.validity(practice.validityMonths || 3)}
          </Text>
        </View>

        {/* 9 · signatures */}
        <View wrap={false} style={[s.row, { marginTop: 18, gap: 30 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { marginBottom: 6 }]}>{t.pdf.dentist}</Text>
            {practice.signature ? <Image src={practice.signature} style={{ height: 34, width: 110, objectFit: "contain", objectPosition: "left" }} /> : <View style={{ height: 34 }} />}
            <View style={{ borderTopWidth: 0.5, borderTopColor: C.ink3, paddingTop: 3 }}>
              <Text style={{ fontSize: 7.5, color: C.ink2 }}>{practice.dentist || " "}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { marginBottom: 6 }]}>{t.pdf.agreement}</Text>
            <View style={{ height: 34 }} />
            <View style={{ borderTopWidth: 0.5, borderTopColor: C.ink3, paddingTop: 3, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 7, color: C.ink2, maxWidth: "70%" }}>{t.pdf.patientSign}</Text>
              <Text style={{ fontSize: 7, color: C.ink2 }}>{t.pdf.dateLine} ____/____/______</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={[{ fontSize: 10, marginTop: 1 }, mono ? s.mono : {}]}>{value}</Text>
    </View>
  );
}

function Big({ value, label, border, accent }: { value: string; label: string; border?: boolean; accent?: boolean }) {
  return (
    <View style={{ flex: 1, paddingLeft: border ? 14 : 0, borderLeftWidth: border ? 0.5 : 0, borderLeftColor: C.rule }}>
      <Text style={[s.mono, { fontSize: 20, lineHeight: 1.25, letterSpacing: -0.6, color: accent ? C.accent : C.ink }]}>{value}</Text>
      <Text style={[s.eyebrow, { marginTop: 3, lineHeight: 1.3 }]}>{label}</Text>
    </View>
  );
}

function PdfChart({ plan }: { plan: TreatmentPlan }) {
  const treated = teethByPhase(plan);
  const order = new Map(plan.phases.map((p) => [p.id, p.order]));
  const layout = chartLayout([...treated.keys()].some(isDeciduous));
  const pad = 3;
  const W = 205;
  const H = (W * (layout.height + pad * 2)) / (layout.width + pad * 2);
  return (
    <Svg width={W} height={H} viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}>
      <Line x1={layout.midX} x2={layout.midX} y1={-2} y2={layout.height + 2} stroke={C.rule} strokeWidth={0.3} />
      <Line x1={-2} x2={layout.width + 2} y1={layout.midY} y2={layout.midY} stroke={C.rule} strokeWidth={0.3} />
      {layout.teeth.map((tt) => {
        const ph = treated.get(tt.fdi);
        const o = ph?.length ? (order.get(ph[0]) ?? 0) : -1;
        const color = o >= 0 ? phaseColor(o) : C.ink3;
        return (
          <G key={tt.fdi}>
            <Path d={tt.crown} fill={o >= 0 ? phaseTint(o) : "#FFFFFF"} stroke={color} strokeWidth={o >= 0 ? 0.55 : 0.3} />
            {o >= 0 ? <Path d={tt.crown} fill={color} fillOpacity={0.35} /> : null}
            <Path d={tt.roots} fill="none" stroke={color} strokeWidth={o >= 0 ? 0.5 : 0.28} />
            <Text x={tt.cx - (String(tt.fdi).length * 1.65) / 2 - 0.2} y={tt.labelY} style={{ fontSize: 2.8, fontFamily: "GeistMono" }} fill={o >= 0 ? color : C.ink3}>
              {String(tt.fdi)}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
}

function PdfTimeline({ plan, t }: { plan: TreatmentPlan; t: Dict }) {
  const phases = sortedPhases(plan);
  const spans = phaseSpans(plan);
  const total = Math.max(28, ...spans.map((x) => x.end));
  const weeks = Math.ceil(total / 7);
  const months = weeks > 16;
  const pct = (d: number) => `${(d / (weeks * 7)) * 100}%`;
  const ticks = Array.from({ length: weeks + 1 }, (_, w) => w);
  return (
    <View>
      <View style={{ height: 16, borderBottomWidth: 0.7, borderBottomColor: C.ink, position: "relative" }}>
        {ticks.map((w) => {
          const major = months ? w % 4 === 0 : weeks <= 12 || w % 2 === 0;
          return (
            <View key={w} style={{ position: "absolute", left: pct(w * 7), bottom: 0 }}>
              <View style={{ width: 0.5, height: major ? 5 : 3, backgroundColor: C.ink }} />
              {major ? (
                <Text style={[s.mono, { position: "absolute", bottom: 6, left: -6, width: 12, textAlign: "center", fontSize: 5.5, color: C.ink3 }]}>
                  {months ? `${t.pdf.month}${w / 4}` : `${t.pdf.week}${w}`}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 6 }}>
        {phases.map((ph) => {
          const sp = spans.find((x) => x.phaseId === ph.id)!;
          const right = sp.end / (weeks * 7) > 0.62;
          return (
            <View key={ph.id} style={{ height: 13, position: "relative" }}>
              <View style={{ position: "absolute", top: 4, left: pct(sp.start), width: pct(Math.max(1, sp.end - sp.start)), height: 4, backgroundColor: phaseColor(ph.order), borderRadius: 1 }} />
              <Text
                style={{
                  position: "absolute",
                  top: 1.5,
                  fontSize: 6.5,
                  color: C.ink2,
                  ...(right ? { right: `${100 - (sp.start / (weeks * 7)) * 100}%`, paddingRight: 4, textAlign: "right" } : { left: pct(sp.end), paddingLeft: 4 }),
                }}
              >
                {ph.title}
              </Text>
            </View>
          );
        })}
      </View>
      {plan.startDate ? (
        <Text style={{ fontSize: 6.5, color: C.ink3, marginTop: 4 }}>
          {fmtDate(plan.startDate, t, plan.language)} – {fmtDate(addDays(plan.startDate, totalDurationDays(plan)), t, plan.language)}
        </Text>
      ) : null}
    </View>
  );
}
