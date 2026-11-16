# Dictaplan: Voice-to-Treatment-Plan for Dentists

> Requirements for Claude Code. Build an MVP that **works end-to-end, fast, and costs nothing to run**.

---

## 0. TL;DR for Claude Code

The dentist speaks a treatment plan out loud. The app transcribes it. An LLM turns the transcript into a structured plan with **phases, procedures, teeth, intervals and prices**. The app then asks a few **clarifying questions as one-click options**. The dentist reviews the plan and downloads a polished **PDF treatment plan** to give to the patient.

**Constraints:**
- 100% free stack: free tiers or in-browser models only. No paid APIs, no credit card.
- Ship a working MVP first. Polish second.
- The design must look **crafted and editorial**, not like a template. See §7.
- French-first UI with an EN toggle. Dentists in France are the primary users.

---

## 1. User flow (the whole product)

```
[1 Record] → [2 Transcript] → [3 Plan draft] → [4 Clarify (clicks)] → [5 Review & edit] → [6 PDF]
```

1. **Record:** the dentist presses one big button (or holds Space) and dictates.
   *Example: "Patient Mme Durand, 45 ans. Phase 1 assainissement: détartrage, extraction de la 48, traitement canalaire sur la 36. Phase 2 dans 3 semaines: couronne céramique sur la 36. Phase 3: implant en 46, pose 3 mois après extraction."*
2. **Transcript:** the text streams in live and can be edited inline. A "Generate plan" button sits below it.
3. **Plan draft:** the LLM returns structured JSON (schema in §5), rendered as phase cards in a timeline.
4. **Clarify:** the LLM returns **at most 5** questions. Each one has 2 to 4 option chips plus a "Other…" free-text option. Examples:
   - "Crown material for 36?" → `Zircone` · `Céramo-métallique` · `Céramique pure`
   - "Interval between extraction 46 and implant?" → `3 mois` · `4 mois` · `6 mois`
   - "Include bone graft?" → `Oui` · `Non`
   Each click patches the plan right away with no new LLM call when possible. Show **at most 5 questions**, and allow "Skip all".
5. **Review & edit:** everything stays editable: phases (drag to reorder), procedures, teeth, prices, intervals, notes. An interactive **FDI tooth chart** highlights the teeth involved, and clicking a tooth filters its procedures.
6. **PDF:** generated client-side, then previewed and downloaded. Optional "Regenerate with modifications" by voice ("ajoute un blanchiment en phase 3").

**Target time:** under 30 s from the end of dictation to the first plan draft.

---

## 2. Free tech stack (decided, don't change without reason)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One repo, API routes for LLM proxy, free deploy on Vercel |
| Styling | **Tailwind CSS v4** + CSS variables design tokens | Fast, but tokens enforce a custom look (§7) |
| UI primitives | **Radix UI** primitives (unstyled), styled by us | Accessibility without shadcn's default look |
| Animation | **Motion** (framer-motion) | Subtle, purposeful transitions |
| Speech-to-text, primary | **Groq API, `whisper-large-v3-turbo`** (free tier) | Very fast, excellent French, free with API key |
| Speech-to-text, fallback | **Web Speech API** (browser-native, Chrome/Edge) | Zero setup, live interim text |
| Speech-to-text, offline option | **Transformers.js + Whisper (small/base) in a Web Worker** | Fully private, audio never leaves the device |
| LLM | **Groq API, `llama-3.3-70b-versatile`** (free tier), JSON mode | Fast, free, good at structured output |
| LLM fallback | **Google Gemini 2.x Flash** (free tier via AI Studio key) | Second free provider if Groq rate-limits |
| Validation | **Zod** | Validate every LLM response against the schema |
| State | **Zustand** + persist to **IndexedDB** (via `idb-keyval`) | No backend DB needed |
| PDF | **@react-pdf/renderer** (client-side) | Pixel-precise, custom fonts, free |
| Deploy | **Vercel Hobby** (free) | |

**Before you start, verify** current free-tier model names and limits on Groq and Google AI Studio, because they change. Keep the model IDs in one config file.

**API keys:** stored server-side in `.env.local` (`GROQ_API_KEY`, `GEMINI_API_KEY`). The browser never sees them. All calls go through `/api/transcribe` and `/api/plan`.

**Provider abstraction:** `lib/ai/provider.ts` exposes `transcribe(audio)` and `generatePlan(transcript, context)`. If one provider errors or hits a 429, retry once, then fall back to the next one.

---

## 3. Features: MVP vs later

### MVP (must work end-to-end)
- [ ] Record audio (MediaRecorder, webm/opus), with a live waveform and timer
- [ ] Transcribe via Groq Whisper, with Web Speech API as fallback
- [ ] Editable transcript
- [ ] LLM → structured plan JSON (Zod-validated, with 1 automatic repair retry on invalid JSON)
- [ ] Clarifying questions with option chips → patch the plan
- [ ] Editable plan: phases, procedures, teeth (FDI), intervals, prices, notes
- [ ] Auto-calculated totals: per phase, overall, and an estimated timeline (dates from a start date + intervals)
- [ ] **Practice settings** (one-time onboarding): practice name, dentist name, address, RPPS number (optional), logo upload, signature image (optional), default currency €
- [ ] **Price list:** editable table of procedures with code (optional CCAM), label, and default price. The LLM maps dictated procedures onto it. Seed it with ~30 common dental procedures.
- [ ] PDF generation with preview and download
- [ ] Plan history saved locally (IndexedDB): list, reopen, duplicate, delete

### V2 (only once MVP is solid)
- [ ] Voice edits ("change the crown to zirconia")
- [ ] Offline in-browser Whisper mode toggle
- [ ] 2 or 3 alternative plans side by side (e.g., implant vs bridge) for patient choice
- [ ] Patient acceptance signature on screen
- [ ] PWA install

---

## 4. LLM behaviour

### 4.1 `generatePlan` system prompt (summary, write the full one in `lib/ai/prompts.ts`)
- Role: dental assistant who structures a dentist's dictation into a treatment plan.
- Input: transcript + practice price list + today's date + language.
- Output: **JSON only**, matching the schema in §5.
- Rules:
  - Use **FDI tooth numbering** (11–48, deciduous 51–85). Convert spoken forms ("la trente-six", "36", "first lower left molar") to FDI.
  - Group procedures into phases in the order dictated. If no phases are mentioned, infer standard phases: urgence/assainissement → soins conservateurs → prothèse/implantologie → maintenance.
  - Match each procedure to the closest price-list item and set `priceSource: "list"`. If there is no match, set `price: null`, `priceSource: "missing"` and create a question about it.
  - **Never invent clinical facts.** Anything ambiguous becomes a `question`.
  - Questions: at most 5, ordered by importance, each with 2–4 short `options` plus `allowCustom: true`. Each option carries a `patch` (JSON Patch ops against the plan) so the client can apply it without another LLM call.

### 4.2 Model settings
- `temperature: 0.2`, JSON mode / `response_format: json_object`.
- Validate with Zod. On failure, send the Zod error back to the model once ("fix this JSON"). If it still fails, show a friendly error with a "Retry" button, and keep the transcript.

---

## 5. Data model (Zod / TypeScript)

```ts
type ToothFDI = number; // 11–48, 51–85

interface Procedure {
  id: string;
  label: string;              // "Couronne céramique"
  code?: string;              // CCAM code if known
  teeth: ToothFDI[];          // [] for whole-mouth procedures (e.g., détartrage)
  quantity: number;
  unitPrice: number | null;
  priceSource: "list" | "dictated" | "manual" | "missing";
  notes?: string;
}

interface Phase {
  id: string;
  title: string;              // "Phase 1 · Assainissement"
  order: number;
  delayFromPreviousDays: number | null; // interval before this phase starts
  estimatedSessions?: number;
  procedures: Procedure[];
  notes?: string;
}

interface ClarifyQuestion {
  id: string;
  question: string;
  options: { label: string; patch: JsonPatchOp[] }[];
  allowCustom: boolean;
  answered?: string;
}

interface TreatmentPlan {
  id: string;
  createdAt: string;
  patient: { name?: string; age?: number; reference?: string };
  startDate?: string;
  phases: Phase[];
  questions: ClarifyQuestion[];
  generalNotes?: string;
  transcript: string;
  language: "fr" | "en";
  status: "draft" | "final";
}
```

Totals and dates are **always computed**, never stored or produced by the LLM.

---

## 6. PDF treatment plan (the deliverable; it must look premium)

**Format:** A4, client-side, embedded fonts (same as the UI, §7).

**Contents:**
1. **Header:** practice logo, name, address, dentist name, RPPS. Thin hairline rule.
2. **Title block:** "Plan de traitement" (serif, large), patient name, date, plan reference.
3. **Overview strip:** number of phases · estimated total duration · total amount. These are three large numerals with small labels.
4. **Tooth chart:** small FDI diagram with the treated teeth tinted by phase color.
5. **Phases:** one section per phase. Title, timing ("à partir de S+3"), then a table: procedure · teeth · qty · unit price · subtotal. Phase subtotal right-aligned.
6. **Timeline:** horizontal bar showing phases over weeks/months.
7. **Totals:** grand total, and optionally "dont part estimée Sécurité sociale / reste à charge" as manual fields (leave blank if not provided; never invent).
8. **Notes & conditions:** validity period of the quote (default 3 months, configurable), general notes.
9. **Signatures:** dentist (image or line) and "Bon pour accord" patient line + date.
10. **Footer:** page X / Y, practice contact.

**Design rules for the PDF:** generous margins (20 mm), no heavy table borders (hairlines only), tabular numerals for prices, one accent color, phase colors muted.

---

## 7. Design direction: elegant, calm, clinical-editorial (NOT vibe-coded)

### 7.1 Banned (these scream "AI-generated SaaS")
- Purple/blue gradients, gradient text, glassmorphism, glowing blobs
- Emoji in UI, sparkle ✨ icons for "AI"
- Default shadcn look, rounded-2xl cards with big shadows everywhere
- Inter as the only font, centered hero with a gradient CTA
- Dark mode with neon accents, "Powered by AI" badges

### 7.2 Aesthetic
Think **a high-end medical journal crossed with a Swiss design studio**: paper-like warmth, precise typography, hairline rules, lots of whitespace, very few colors, confident hierarchy. Calm enough to use in front of a patient.

### 7.3 Tokens
```css
--paper:      #F7F5F0;  /* warm off-white background */
--surface:    #FFFFFF;
--ink:        #16181D;  /* near-black text */
--ink-2:      #5B606B;  /* secondary text */
--rule:       #E4E0D8;  /* hairlines */
--accent:     #1F4D45;  /* deep porcelain green: primary actions */
--accent-soft:#E6EEEB;
--record:     #B4412F;  /* muted brick red: recording state only */
/* phase colors (muted): #1F4D45, #8A6A2F, #3E5A7A, #7A4B5C */
```
- **Typography:**
  - Display/headings: **"Instrument Serif"** or **"Newsreader"** (Google Fonts, free)
  - UI/body: **"Geist"** or **"IBM Plex Sans"**
  - Numbers/prices: **"Geist Mono"** or `font-variant-numeric: tabular-nums`
- **Radius:** 6px (inputs, chips), 10px (panels). No pills except option chips.
- **Borders over shadows:** 1px `--rule` borders. Shadows only on floating elements, and very soft.
- **Spacing:** 8-pt grid, generous. Max content width ~1100px.
- **Motion:** 150–250 ms ease-out. Transcript words fade in, phase cards stagger in, chips get a subtle press state. Respect `prefers-reduced-motion`.

### 7.4 Signature elements (what makes it memorable)
- **The record button:** a large circle with a thin ring that reacts to voice amplitude (a real-time ring, not a generic waveform). Idle: ink outline. Recording: brick red with a breathing ring.
- **Live transcript as typography:** the dictated text appears in the serif font, large, like a manuscript being written.
- **Interactive FDI tooth chart:** clean line-drawn teeth (SVG), treated teeth filled with phase colors. It is the visual anchor of the review screen.
- **Phase timeline:** a horizontal ruled timeline with weeks marked like a ruler.

### 7.5 Layout
- **Single focused workspace**, not a dashboard. Left: a narrow vertical stepper (Dicter · Préciser · Vérifier · Exporter). Center: the current step. Right (review step): live summary with totals and a mini PDF preview.
- Desktop-first (dentist at the chair or desk), fully usable on tablet (iPad in landscape). Mobile works but is secondary.
- Keyboard: `Space` hold-to-talk, `⌘/Ctrl+Enter` generate, `⌘/Ctrl+P` export PDF.

### 7.6 Empty, loading and error states
- Loading plan: skeleton phase cards with a quiet status line ("Structuration du plan…"). No spinners with AI sparkles.
- Errors: plain human language plus one action. The transcript is never lost.

---

## 8. Project structure

```
app/
  (workspace)/page.tsx          # main flow
  history/page.tsx
  settings/page.tsx             # practice info + price list
  api/transcribe/route.ts       # Groq Whisper proxy
  api/plan/route.ts             # LLM plan generation proxy
components/
  recorder/                     # RecordButton, AmplitudeRing, useRecorder
  transcript/
  plan/                         # PhaseCard, ProcedureRow, Timeline, Totals
  clarify/                      # QuestionCard, OptionChip
  tooth-chart/                  # FDIChart.tsx (SVG)
  pdf/                          # PlanDocument.tsx (@react-pdf)
  ui/                           # Button, Input, Chip… (Radix + tokens)
lib/
  ai/provider.ts, prompts.ts, schema.ts
  plan/compute.ts               # totals, dates (pure functions + tests)
  plan/patch.ts                 # apply JSON patch from options
  store.ts                      # Zustand + IndexedDB persist
  seed/price-list.fr.ts
  i18n/fr.ts, en.ts
```

---

## 9. Privacy & legal (keep it simple but honest)
- Patient data is **health data**. MVP rule: **store nothing server-side**. Plans live only in the browser (IndexedDB). API routes are stateless proxies and log no transcripts.
- Show a one-line notice in settings: audio/text is processed by third-party AI providers (Groq/Google) unless offline mode is on. Encourage using a patient reference instead of the full name.
- Note for later: commercial use in France would need HDS-certified hosting and a GDPR review. **Out of scope for the MVP**, but don't architect against it.
- The PDF is a draft generated with AI assistance and must be validated by the dentist. Do not show this on the PDF; show it in the UI before export ("Vérifiez le plan avant export").

---

## 10. Quality bar / acceptance criteria
- [ ] Dictating the example in §1 produces 3 phases, correct FDI teeth (48, 36, 46), correct intervals (3 weeks, 3 months), and prices from the list.
- [ ] At least one clarifying question appears for something ambiguous (e.g., crown material) and one click updates the plan.
- [ ] Totals and the timeline update instantly on any edit.
- [ ] The PDF renders correctly with 1 phase and with 6 phases (page breaks inside long tables handled, headers repeated).
- [ ] Works in Chrome, Edge and Safari (Safari: the Groq transcription path, since Web Speech is limited).
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95.
- [ ] Unit tests for `lib/plan/compute.ts`, `lib/plan/patch.ts` and the Zod schema (Vitest).
- [ ] No API key in client bundle.
- [ ] Runs locally with `pnpm dev` after filling `.env.local`. README explains how to get free Groq and Gemini keys.

---

## 11. Build order (ship in this sequence)
1. Scaffold Next.js + Tailwind tokens + fonts + base UI components (get the look right early).
2. Recorder → `/api/transcribe` → transcript screen.
3. Schema + prompt + `/api/plan` → render plan from JSON (test with fixture JSON first).
4. Plan editing + compute (totals, dates).
5. Clarifying questions + patch application.
6. PDF document + preview + download.
7. Settings (practice + price list) + history in IndexedDB.
8. Tooth chart + timeline polish, motion, i18n EN.
9. Tests, README, deploy to Vercel.

**After each step, run the app and verify it works before moving on.**
