// =============================================================================
// Manual edits on the line-art: eraser, black pen, and fill.
// -----------------------------------------------------------------------------
// Edits are stored in ORIGINAL photo pixels, so they survive re-cropping
// (background on/off) and re-thresholding (the detail slider): the drawing is
// always ink → edits replayed in order.
// =============================================================================

export interface BrushPoint {
  x: number;
  y: number;
  r: number;
}

export type EditOp =
  | { kind: "erase"; points: BrushPoint[] }
  | { kind: "pen"; points: BrushPoint[] }
  | { kind: "fill"; x: number; y: number; tol: number };

/** Maps photo px ↔ working px for the current crop, plus its colours. */
export interface Frame {
  w: number;
  h: number;
  x0: number;
  y0: number;
  scale: number;
  /** Slightly blurred RGB of the crop, 3 bytes per px (for the fill). */
  rgb: Uint8ClampedArray;
}

/** Paint a filled circle (working px) with value v. */
export function stamp(img: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, v: 0 | 1) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) img[y * w + x] = v;
    }
  }
}

/**
 * "Magic wand" fill: everything connected to (sx, sy) whose colour in the
 * ORIGINAL photo is close to the tapped colour becomes solid black - e.g. a
 * tap on the hair blackens the whole hair, its outline set by where the
 * photo's colour changes (skin, shirt), not by the drawn strands inside it.
 * Small islands inside (highlights) are absorbed and the edge is smoothed.
 * `rgb` is the slightly blurred crop (3 bytes per px); `tol` is a colour
 * distance (0-255 scale). Never leaves the subject when `mask` is given.
 */
export function wandFill(
  img: Uint8Array, w: number, h: number, sx: number, sy: number,
  rgb: Uint8ClampedArray, tol: number, mask: Uint8Array | null,
) {
  sx = Math.round(sx);
  sy = Math.round(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  if (mask && !mask[sy * w + sx]) return;
  // Seed colour = average of a small patch, so one odd pixel doesn't decide.
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = sx + dx, y = sy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = (y * w + x) * 3;
      r += rgb[k]; g += rgb[k + 1]; b += rgb[k + 2]; n++;
    }
  r /= n; g /= n; b /= n;
  const tol2 = tol * tol;
  const ok = (i: number) => {
    if (mask && !mask[i]) return false;
    const k = i * 3;
    const dr = rgb[k] - r, dg = rgb[k + 1] - g, db = rgb[k + 2] - b;
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const region = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const seed = sy * w + sx;
  region[seed] = 1;
  stack[sp++] = seed;
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0 && !region[p - 1] && ok(p - 1)) { region[p - 1] = 1; stack[sp++] = p - 1; }
    if (x < w - 1 && !region[p + 1] && ok(p + 1)) { region[p + 1] = 1; stack[sp++] = p + 1; }
    if (y > 0 && !region[p - w] && ok(p - w)) { region[p - w] = 1; stack[sp++] = p - w; }
    if (y < h - 1 && !region[p + w] && ok(p + w)) { region[p + w] = 1; stack[sp++] = p + w; }
  }
  // Absorb small enclosed islands (highlights between strands).
  const maxHole = 0.004 * w * h;
  const seen = new Uint8Array(w * h);
  const comp = new Int32Array(w * h);
  for (let s0 = 0; s0 < w * h; s0++) {
    if (region[s0] || seen[s0]) continue;
    let cn = 0;
    let touchesEdge = false;
    sp = 0;
    stack[sp++] = s0;
    seen[s0] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      comp[cn++] = p;
      const x = p % w;
      const y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || (mask && !mask[p])) touchesEdge = true;
      if (x > 0 && !region[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && !region[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && !region[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && !region[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (!touchesEdge && cn <= maxHole) for (let k = 0; k < cn; k++) region[comp[k]] = 1;
  }
  // Smooth the edge (majority in a 5×5 window) so it reads as a clean shape.
  const R = 2;
  const ii = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += region[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
      const y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      const sum = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      const i = y * w + x;
      if (sum * 2 > (x1 - x0) * (y1 - y0) && (!mask || mask[i])) img[i] = 1;
    }
}

/** Apply one op to a working-res drawing (in place). */
export function applyOp(img: Uint8Array, f: Frame, op: EditOp, mask: Uint8Array | null) {
  if (op.kind === "fill") {
    wandFill(img, f.w, f.h, (op.x - f.x0) * f.scale, (op.y - f.y0) * f.scale, f.rgb, op.tol, mask);
    return;
  }
  const v = op.kind === "pen" ? 1 : 0;
  for (const d of op.points) stamp(img, f.w, f.h, (d.x - f.x0) * f.scale, (d.y - f.y0) * f.scale, d.r * f.scale, v);
}

/** ink + all ops, replayed in order → final drawing (1 = black). */
export function composeDrawing(ink: Uint8Array, f: Frame, ops: EditOp[], mask: Uint8Array | null): Uint8Array {
  const img = ink.slice();
  for (const op of ops) applyOp(img, f, op, mask);
  return img;
}
