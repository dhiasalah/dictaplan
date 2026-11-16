import { TreatmentPlanSchema, type JsonPatchOp, type TreatmentPlan } from "@/lib/ai/schema";

/**
 * Apply JSON-Patch-like ops to a plan, immutably.
 *
 * Path segments that address an array element may be either a numeric index
 * or the element's `id` (e.g. `/phases/ph2/procedures/pr3/label`). Id-based
 * paths keep working after the dentist reorders phases, so the LLM is told to
 * use them. `-` appends to an array (add only).
 *
 * The whole patch is atomic: if any op fails, or the result no longer matches
 * the schema, the original plan is returned with `ok: false`.
 */
export type PatchResult = { ok: true; plan: TreatmentPlan } | { ok: false; plan: TreatmentPlan; error: string };

const FORBIDDEN_ROOTS = new Set(["id", "createdAt", "transcript", "questions", "language"]);

function decode(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function parsePath(path: string): string[] {
  if (path === "" || path === "/") return [];
  if (!path.startsWith("/")) throw new Error(`Path must start with "/": ${path}`);
  return path.slice(1).split("/").map(decode);
}

function resolveIndex(arr: unknown[], seg: string, forAdd: boolean): number {
  if (seg === "-") {
    if (!forAdd) throw new Error(`"-" only valid for add`);
    return arr.length;
  }
  if (/^\d+$/.test(seg)) {
    const i = Number(seg);
    if (i > arr.length || (!forAdd && i >= arr.length)) throw new Error(`Index out of range: ${seg}`);
    return i;
  }
  const i = arr.findIndex((x) => x && typeof x === "object" && (x as { id?: unknown }).id === seg);
  if (i < 0) throw new Error(`No element with id "${seg}"`);
  return i;
}

/** Fields where `null` is meaningful; everywhere else null means "absent". */
const NULLABLE_KEYS = new Set(["unitPrice", "delayFromPreviousDays"]);

/** LLMs write `"code": null` for optional fields; drop those so values match the schema. */
function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === null && !NULLABLE_KEYS.has(k)) continue;
      out[k] = stripNulls(x);
    }
    return out;
  }
  return v;
}

function applyOne(root: Record<string, unknown>, rawOp: JsonPatchOp): void {
  let op = rawOp;
  const segs = parsePath(op.path);
  if (op.op !== "remove") {
    const lastKey = segs[segs.length - 1];
    if (op.value === null && !NULLABLE_KEYS.has(lastKey)) op = { op: "remove", path: op.path };
    else op = { ...op, value: stripNulls(op.value) };
  }
  if (op.op === "remove" && rawOp.op !== "remove") {
    // replace-with-null on an optional field: remove only if present
    try {
      applyOne(root, op);
    } catch {}
    return;
  }
  if (segs.length === 0) throw new Error("Cannot patch the root");
  if (FORBIDDEN_ROOTS.has(segs[0])) throw new Error(`Path not patchable: ${op.path}`);

  let parent: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (Array.isArray(parent)) {
      parent = parent[resolveIndex(parent, seg, false)];
    } else if (parent && typeof parent === "object") {
      const obj = parent as Record<string, unknown>;
      if (!(seg in obj) || obj[seg] == null) {
        // create intermediate objects for add/replace on optional nested fields (e.g. /patient/age)
        if (op.op === "remove") throw new Error(`Missing path: ${op.path}`);
        obj[seg] = {};
      }
      parent = obj[seg];
    } else {
      throw new Error(`Cannot traverse ${op.path}`);
    }
  }

  const last = segs[segs.length - 1];
  if (Array.isArray(parent)) {
    if (op.op === "add") {
      parent.splice(resolveIndex(parent, last, true), 0, structuredClone(op.value));
    } else if (op.op === "replace") {
      parent[resolveIndex(parent, last, false)] = structuredClone(op.value);
    } else {
      parent.splice(resolveIndex(parent, last, false), 1);
    }
  } else if (parent && typeof parent === "object") {
    const obj = parent as Record<string, unknown>;
    if (op.op === "remove") {
      if (!(last in obj)) throw new Error(`Missing path: ${op.path}`);
      delete obj[last];
    } else {
      obj[last] = structuredClone(op.value);
    }
  } else {
    throw new Error(`Cannot patch ${op.path}`);
  }
}

export function applyPlanPatch(plan: TreatmentPlan, ops: JsonPatchOp[]): PatchResult {
  const draft = structuredClone(plan) as unknown as Record<string, unknown>;
  try {
    for (const op of ops) applyOne(draft, op);
  } catch (e) {
    return { ok: false, plan, error: (e as Error).message };
  }
  // keep phase order consistent with array position if phases were added/removed
  const phases = (draft.phases as TreatmentPlan["phases"]) ?? [];
  const sorted = [...phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((p, i) => (p.order = i));
  draft.phases = sorted;

  const parsed = TreatmentPlanSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, plan, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, plan: parsed.data };
}

/** Answer a clarifying question by option index: applies its patch and marks the question answered. */
export function answerQuestion(plan: TreatmentPlan, questionId: string, optionIndex: number): PatchResult {
  const q = plan.questions.find((x) => x.id === questionId);
  if (!q) return { ok: false, plan, error: "Unknown question" };
  const opt = q.options[optionIndex];
  if (!opt) return { ok: false, plan, error: "Unknown option" };
  const res = applyPlanPatch(plan, opt.patch);
  if (!res.ok) return res;
  return {
    ok: true,
    plan: {
      ...res.plan,
      questions: res.plan.questions.map((x) => (x.id === questionId ? { ...x, answered: opt.label } : x)),
    },
  };
}

export function markAnswered(plan: TreatmentPlan, questionId: string, answer: string): TreatmentPlan {
  return { ...plan, questions: plan.questions.map((x) => (x.id === questionId ? { ...x, answered: answer } : x)) };
}
