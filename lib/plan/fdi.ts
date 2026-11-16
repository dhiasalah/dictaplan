/**
 * Geometry for a line-drawn FDI dental chart, shared by the interactive SVG
 * (components/tooth-chart) and the PDF (components/pdf). Pure, no React.
 *
 * Layout (viewer facing the patient):
 *   upper:  18 … 11 | 21 … 28      (roots point up)
 *   lower:  48 … 41 | 31 … 38      (roots point down)
 * Optional deciduous rows sit between them: 55…51 | 61…65 and 85…81 | 71…75.
 */

export interface ToothShape {
  fdi: number;
  x: number;
  w: number;
  upper: boolean;
  crown: string; // closed path
  roots: string; // open path(s)
  cx: number; // crown center
  cy: number;
  labelY: number;
}

const PERM_W: Record<number, number> = { 1: 8.6, 2: 7, 3: 7.8, 4: 7, 5: 6.8, 6: 10.2, 7: 9.6, 8: 9 };
const DEC_W: Record<number, number> = { 1: 6, 2: 5.4, 3: 6, 4: 7.4, 5: 8.6 };
const GAP = 1.4;
const MID = 4;

function crownPath(x: number, y: number, w: number, h: number, upper: boolean, molar: boolean): string {
  // rounded crown, a bit wider at the occlusal edge; molars get a shallow notch
  const r = Math.min(3, w / 3);
  const occl = upper ? y + h : y; // biting edge
  const cerv = upper ? y : y + h; // gum line
  const inset = 0.8;
  const dir = upper ? 1 : -1;
  const notch = molar ? ` L ${x + w / 2},${occl - dir * 1.1}` : "";
  return [
    `M ${x + inset},${cerv}`,
    `L ${x},${occl - dir * r}`,
    `Q ${x},${occl} ${x + r},${occl}`,
    notch,
    `L ${x + w - r},${occl}`,
    `Q ${x + w},${occl} ${x + w},${occl - dir * r}`,
    `L ${x + w - inset},${cerv}`,
    "Z",
  ].join(" ");
}

function rootPath(x0: number, x1: number, cerv: number, len: number, upper: boolean): string {
  const dir = upper ? -1 : 1;
  const xm = (x0 + x1) / 2;
  const apex = cerv + dir * len;
  return `M ${x0},${cerv} Q ${x0 + (xm - x0) * 0.3},${cerv + dir * len * 0.7} ${xm},${apex} Q ${x1 - (x1 - xm) * 0.3},${cerv + dir * len * 0.7} ${x1},${cerv}`;
}

function rootsFor(x: number, w: number, cerv: number, upper: boolean, n: number, len: number): string {
  const inset = 1.2;
  const a = x + inset;
  const b = x + w - inset;
  if (n === 1) return rootPath(a, b, cerv, len, upper);
  const mid = (a + b) / 2;
  return `${rootPath(a, mid - 0.3, cerv, len * 0.92, upper)} ${rootPath(mid + 0.3, b, cerv, len, upper)}`;
}

function rootCount(t: number, upper: boolean, deciduous: boolean): number {
  if (deciduous) return t >= 4 ? 2 : 1;
  if (t >= 6) return 2; // drawn as two (upper molars have 3, visually 2 from the buccal side)
  if (upper && t === 4) return 2;
  return 1;
}

function row(quadsLeft: number, quadsRight: number, deciduous: boolean, upper: boolean, top: number): { teeth: ToothShape[]; width: number } {
  const n = deciduous ? 5 : 8;
  const W = deciduous ? DEC_W : PERM_W;
  const crownH = deciduous ? 9 : 11;
  const rootL = deciduous ? 9 : 14;
  const teeth: ToothShape[] = [];
  let x = 0;
  const push = (q: number, t: number) => {
    const w = W[t];
    const fdi = q * 10 + t;
    const crownY = upper ? top + rootL : top;
    const cerv = upper ? crownY : crownY + crownH;
    const molar = deciduous ? t >= 4 : t >= 6;
    teeth.push({
      fdi,
      x,
      w,
      upper,
      crown: crownPath(x, crownY, w, crownH, upper, molar),
      roots: rootsFor(x, w, cerv, upper, rootCount(t, upper, deciduous), rootL),
      cx: x + w / 2,
      cy: crownY + crownH / 2,
      labelY: upper ? crownY + crownH + 5.2 : crownY - 2.4,
    });
    x += w + GAP;
  };
  for (let t = n; t >= 1; t--) push(quadsLeft, t);
  x += MID - GAP;
  for (let t = 1; t <= n; t++) push(quadsRight, t);
  return { teeth, width: x - GAP };
}

export interface ChartLayout {
  teeth: ToothShape[];
  width: number;
  height: number;
  midX: number;
  midY: number;
}

export function chartLayout(withDeciduous: boolean): ChartLayout {
  const rowsH = { permUpper: 25, dec: 18 + 8, gap: 16 };
  let y = 0;
  const parts: { teeth: ToothShape[]; width: number }[] = [];
  parts.push(row(1, 2, false, true, y));
  y += rowsH.permUpper + rowsH.gap;
  if (withDeciduous) {
    parts.push(row(5, 6, true, true, y));
    y += rowsH.dec;
    parts.push(row(8, 7, true, false, y));
    y += rowsH.dec - 4;
  }
  const midY = withDeciduous ? rowsH.permUpper + rowsH.gap + rowsH.dec - 2 : rowsH.permUpper + rowsH.gap / 2;
  parts.push(row(4, 3, false, false, y + 2));
  y += 2 + 25;
  const width = Math.max(...parts.map((p) => p.width));
  // center each row horizontally
  const teeth = parts.flatMap((p) => {
    const dx = (width - p.width) / 2;
    return p.teeth.map((t) => shift(t, dx));
  });
  return { teeth, width, height: y, midX: width / 2, midY };
}

function shift(t: ToothShape, dx: number): ToothShape {
  if (dx === 0) return t;
  const move = (d: string) =>
    d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, a, b) => `${+(+a + dx).toFixed(2)},${b}`);
  return { ...t, x: t.x + dx, cx: t.cx + dx, crown: move(t.crown), roots: move(t.roots) };
}

export function isDeciduous(n: number): boolean {
  return Math.floor(n / 10) >= 5;
}

export const PHASE_COLORS = ["#1F4D45", "#8A6A2F", "#3E5A7A", "#7A4B5C"];
export const PHASE_TINTS = ["#D5E2DE", "#EDE3CF", "#D8E0EA", "#EADBE0"];

export function phaseColor(order: number): string {
  return PHASE_COLORS[order % PHASE_COLORS.length];
}
export function phaseTint(order: number): string {
  return PHASE_TINTS[order % PHASE_TINTS.length];
}
