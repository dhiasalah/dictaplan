import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { PlanDocument, registerPdfFonts } from "./PlanDocument";
import { DURAND_PLAN } from "@/lib/fixtures/durand";
import { fr } from "@/lib/i18n/fr";
import { EMPTY_PRACTICE } from "@/lib/practice";
import type { TreatmentPlan } from "@/lib/ai/schema";

registerPdfFonts(path.join(import.meta.dirname, "../../public"));

const practice = { ...EMPTY_PRACTICE, name: "Cabinet du Parc", dentist: "Dr Martin", address: "12 rue de la Paix, 75002 Paris", rpps: "10101010101" };

function pages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

function bigPlan(nPhases: number, procsPerPhase: number): TreatmentPlan {
  return {
    ...DURAND_PLAN,
    questions: [],
    phases: Array.from({ length: nPhases }, (_, i) => ({
      id: `ph${i}`,
      title: `Phase ${i + 1} · Étape ${i + 1}`,
      order: i,
      delayFromPreviousDays: i === 0 ? 0 : 21,
      procedures: Array.from({ length: procsPerPhase }, (_, j) => ({
        id: `p${i}_${j}`,
        label: j % 2 ? "Couronne céramo-métallique" : "Composite 2 faces",
        teeth: [11 + (j % 8)],
        quantity: 1,
        unitPrice: 45.38 + j,
        priceSource: "list" as const,
      })),
    })),
  };
}

const out = process.env.PDF_OUT;

describe("PlanDocument", () => {
  it("renders a 1-phase plan on one page", async () => {
    const plan = { ...DURAND_PLAN, phases: [DURAND_PLAN.phases[0]] };
    const buf = await renderToBuffer(<PlanDocument plan={plan} practice={practice} t={fr} />);
    if (out) fs.writeFileSync(path.join(out, "plan-1-phase.pdf"), buf);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pages(buf)).toBe(1);
  });

  it("renders a 6-phase plan with long tables across pages", async () => {
    const buf = await renderToBuffer(<PlanDocument plan={bigPlan(6, 9)} practice={practice} t={fr} />);
    if (out) fs.writeFileSync(path.join(out, "plan-6-phases.pdf"), buf);
    expect(pages(buf)).toBeGreaterThan(1);
  });
});
