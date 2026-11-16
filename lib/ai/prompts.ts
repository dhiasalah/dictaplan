import type { Lang } from "./schema";
import type { PriceItem } from "@/lib/seed/price-list.fr";

/**
 * Whisper "prompt": text that conditions the decoder on the domain vocabulary
 * and spelling. Written as natural dictation (Whisper treats it as preceding
 * transcript), kept well under the 224-token limit.
 */
export const WHISPER_PROMPT: Record<Lang, string> = {
  fr:
    "Plan de traitement dentaire. Patiente, 45 ans. Phase 1, assainissement : détartrage, surfaçage radiculaire, " +
    "extraction de la 48, traitement canalaire sur la 36, composite deux faces sur la 25. " +
    "Phase 2 dans 3 semaines : inlay-core, couronne céramo-métallique, couronne zircone, onlay céramique, bridge. " +
    "Phase 3 : implant en 46, greffe osseuse, sinus lift, pilier implantaire, facettes, gouttière occlusale, blanchiment.",
  en:
    "Dental treatment plan. Patient, 45 years old. Phase 1, hygiene: scaling and polishing, root planing, " +
    "extraction of tooth 48, root canal treatment on 36, two-surface composite on 25. " +
    "Phase 2 in 3 weeks: post and core, porcelain-fused-to-metal crown, zirconia crown, ceramic onlay, bridge. " +
    "Phase 3: implant at 46, bone graft, sinus lift, implant abutment, veneers, occlusal splint, whitening.",
};

function priceListBlock(list: PriceItem[], lang: Lang): string {
  return list
    .map((p) => {
      const label = lang === "en" && p.labelEn ? p.labelEn : p.label;
      return `- ${p.id} | ${p.code ?? ""} | ${label} | ${p.price} | ${p.perTooth ? "per tooth" : "flat"}`;
    })
    .join("\n");
}

const OUTPUT_SHAPE = `{
  "patient": { "name": string|null, "age": number|null, "reference": string|null },
  "startDate": "YYYY-MM-DD"|null,
  "phases": [
    {
      "id": "ph1",
      "title": string,                     // e.g. "Phase 1 · Assainissement"
      "delayFromPreviousDays": number|null,// days between the START of the previous phase and the START of this one; 0 for the first phase
      "estimatedSessions": number|null,
      "notes": string|null,
      "procedures": [
        {
          "id": "pr1",
          "label": string,                 // use the price-list label when matched
          "code": string|null,             // CCAM code from the price list, else null
          "teeth": number[],               // FDI numbers; [] for whole-mouth procedures
          "quantity": number,              // number of teeth for per-tooth items, else 1
          "unitPrice": number|null,
          "priceSource": "list"|"dictated"|"missing",
          "notes": string|null
        }
      ]
    }
  ],
  "questions": [
    {
      "id": "q1",
      "question": string,
      "options": [ { "label": string, "patch": JsonPatchOp[] } ],   // 2 to 4 options
      "allowCustom": true
    }
  ],
  "generalNotes": string|null
}`;

const RULES = (lang: Lang) => `RULES
1. Output JSON ONLY, exactly in the shape below. No markdown, no commentary.
2. Write every human-readable string (titles, labels, questions, options, notes) in ${lang === "fr" ? "FRENCH" : "ENGLISH"}.
3. Teeth use FDI numbering: permanent 11–18, 21–28, 31–38, 41–48; deciduous 51–55, 61–65, 71–75, 81–85.
   Convert spoken forms: "la trente-six" / "36" / "thirty-six" → 36; "first lower left molar" → 36; "dent de sagesse en bas à droite" → 48.
   A procedure on several teeth lists all of them in "teeth". Never put an invalid number in "teeth".
4. Phases: keep the order dictated. If no phases are dictated, infer the standard sequence
   (${lang === "fr" ? "urgence/assainissement → soins conservateurs → prothèse/implantologie → maintenance" : "emergency/hygiene → restorative → prosthetics/implants → maintenance"}) and include only the ones needed.
   Title format: "Phase N · <Name>".
5. Intervals: "dans 3 semaines" → 21, "3 mois" → 90, "6 mois" → 180, "1 an" → 365. delayFromPreviousDays is measured from the START of the previous phase.
   If the dictation anchors an interval on an earlier event (e.g. "3 mois après l'extraction" which happened in phase 1), compute the delay relative to the previous phase start so the total offset is right.
   If no interval is given for a later phase, use null.
6. Prices: match each procedure to the closest PRICE LIST item and copy its label, code and price, priceSource "list".
   If the dentist dictates a price, use it with priceSource "dictated". If nothing matches, unitPrice null and priceSource "missing",
   and ask a question about it (options can be plausible prices).
   For "per tooth" items, quantity = number of teeth and unitPrice is the per-tooth price.
7. NEVER invent clinical facts. Do not add procedures that were not dictated (except when the dictation clearly implies a standard one, e.g. a crown after a root canal is NOT implied). Anything ambiguous becomes a question.
8. Questions: at most 5, most important first. Each has 2–4 short options (1–4 words) and "allowCustom": true.
   Think like a careful assistant preparing a quote: look for decisions a quote needs that the dictation leaves open. Typical ones:
   - prosthesis material not fully specified ("couronne céramique" → zircone / céramo-métallique / céramique pure (disilicate));
   - an implant with no abutment / implant crown dictated → offer to add them (in the same or a later phase);
   - a bone graft or sinus lift the situation may need (implant placement after extraction);
   - inconsistencies (e.g. "3 mois après extraction" for a tooth whose extraction was not dictated) or unclear tooth numbers;
   - unclear interval, missing price.
   Most real dictations leave at least one such point open. Do NOT ask about what was stated clearly, and never ask more than 5.
9. Each option carries a "patch": JSON Patch ops (op "add" | "replace" | "remove") applied to the plan so the app can update it without calling you again.
   Paths address array items BY ID, not by index: "/phases/ph2/procedures/pr4/label".
   Append with "-": {"op":"add","path":"/phases/ph3/procedures/-","value":{ full procedure object with a new unique id }}.
   Patch every field that changes (e.g. material change → label, code, unitPrice, priceSource "list"). A "No"/"Non" option may have an empty patch [].
10. ids: phases "ph1","ph2",…; procedures "pr1","pr2",… unique across the whole plan; questions "q1",….
11. patient: only what was dictated. Never guess an age or name. startDate only if a date was dictated.`;

export function planSystemPrompt(opts: { lang: Lang; priceList: PriceItem[]; today: string }): string {
  const { lang, priceList, today } = opts;
  return `You are a meticulous dental assistant. You turn a dentist's spoken dictation into a structured treatment plan (plan de traitement).
Today's date: ${today}. Currency: EUR.

${RULES(lang)}

PRICE LIST (id | CCAM code | label | price € | unit)
${priceListBlock(priceList, lang)}

OUTPUT SHAPE
${OUTPUT_SHAPE}`;
}

export function planUserPrompt(transcript: string): string {
  return `DICTATION (speech-to-text, may contain recognition errors; interpret dental terms sensibly):
"""
${transcript.trim()}
"""`;
}

/** For edits ("ajoute un blanchiment en phase 3") or free-text answers to questions. */
export function refineUserPrompt(currentPlanJson: string, instruction: string): string {
  return `CURRENT PLAN (JSON, keep all ids that still exist):
${currentPlanJson}

MODIFICATION REQUESTED BY THE DENTIST:
"""
${instruction.trim()}
"""

Return the COMPLETE updated plan in the output shape. Change only what the modification requires; keep every other field identical.
Only include new questions if the modification itself is ambiguous (otherwise "questions": []).`;
}

export function repairPrompt(error: string): string {
  return `Your previous answer was not valid for the required shape. Validation errors:
${error}
Fix it and return the full corrected JSON only.`;
}
