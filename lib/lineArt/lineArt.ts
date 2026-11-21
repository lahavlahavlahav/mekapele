// =============================================================================
// PHOTO → LINE ART (pure functions, no DOM)
// -----------------------------------------------------------------------------
// Turns a background-removed photo into bold black "brush" line art in the
// style of Vector Q-type apps: strands that follow the flow of hair, clean
// faces with only the features drawn, dark clothes rendered as white with
// fold lines, and deep shadows filled solid.
//
// Three ink sources are OR-ed together:
//  1. Flow-based DoG (Kang et al. "Coherent Line Drawing"): a difference of
//     Gaussians taken ACROSS each edge, then smoothed ALONG the edge tangent
//     field. Gives long, coherent strokes instead of speckle.
//  2. Local contrast (pixel darker than its neighbourhood), also smoothed
//     along the flow - this is what makes hair read as strands and draws
//     fold lines on dark fabric while leaving the flat fabric white.
//  3. Large dark masses relative to a wide neighbourhood → solid shadows.
// Then a light blur + re-threshold rounds the edges, and specks are dropped.
//
// Everything works on Float32 planes at a fixed working resolution so the
// cost is predictable on phones (~1-2 s at 900px).
// =============================================================================

export interface LineArtParams {
  /** 0 = fewer lines, 1 = more lines. Default 0.5. */
  detail: number;
}

/** Map the single user-facing slider onto the internal thresholds. */
function thresholds(detail: number) {
  const t = Math.min(1, Math.max(0, detail));
  return {
    eps: -0.001 + 0.004 * t, // FDoG threshold (higher = more lines)
    k1: 0.1 - 0.04 * t, // local-contrast threshold (lower = more lines)
    darkK: 0.25 - 0.06 * t, // shadow-mass threshold
  };
}

// --- basic image ops --------------------------------------------------------

function gaussKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(3 * sigma));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    s += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

/** Separable Gaussian with clamped borders. Large sigmas use 3 box passes. */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma > 6) return boxBlur3(src, w, h, sigma);
  const k = gaussKernel(sigma);
  const r = (k.length - 1) / 2;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        let xx = x + i;
        if (xx < 0) xx = 0;
        else if (xx >= w) xx = w - 1;
        acc += src[row + xx] * k[i + r];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        let yy = y + i;
        if (yy < 0) yy = 0;
        else if (yy >= h) yy = h - 1;
        acc += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** Three box blurs ≈ Gaussian (O(1) per pixel regardless of sigma). */
function boxBlur3(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  // Box sizes for 3 passes (Kovesi / Ivan Kutskir).
  const n = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  let a = Float32Array.from(src);
  let b = new Float32Array(w * h);
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wu) - 1) / 2;
    boxH(a, b, w, h, r);
    boxV(b, a, w, h, r);
  }
  return a;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * inv;
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += src[row + add] - src[row + sub];
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * inv;
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += src[add * w + x] - src[sub * w + x];
    }
  }
}

/** Bilinear sample with clamped borders. */
function sample(img: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 < w - 1 ? x0 + 1 : x0;
  const y1 = y0 < h - 1 ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const a = img[y0 * w + x0];
  const b = img[y0 * w + x1];
  const c = img[y1 * w + x0];
  const d = img[y1 * w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// --- edge flow --------------------------------------------------------------

/** Gradient direction field (unit nx, ny) from the smoothed structure tensor. */
function gradientField(g: Float32Array, w: number, h: number) {
  const gf = gaussianBlur(g, w, h, 1.0);
  const E = new Float32Array(w * h);
  const F = new Float32Array(w * h);
  const G = new Float32Array(w * h);
  const at = (x: number, y: number) =>
    gf[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      const i = y * w + x;
      E[i] = gx * gx;
      F[i] = gx * gy;
      G[i] = gy * gy;
    }
  }
  const Es = gaussianBlur(E, w, h, 3);
  const Fs = gaussianBlur(F, w, h, 3);
  const Gs = gaussianBlur(G, w, h, 3);
  const nx = new Float32Array(w * h);
  const ny = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const phi = 0.5 * Math.atan2(2 * Fs[i], Es[i] - Gs[i]);
    nx[i] = Math.cos(phi);
    ny[i] = Math.sin(phi);
  }
  return { nx, ny };
}

/** Average `img` along the tangent curves (both directions), Gaussian-weighted. */
function flowSmooth(
  img: Float32Array, nx: Float32Array, ny: Float32Array,
  w: number, h: number, sigma: number,
): Float32Array {
  const S = Math.ceil(2.5 * sigma);
  const wk = new Float32Array(S + 1);
  let wsum = 1;
  for (let k = 1; k <= S; k++) {
    wk[k] = Math.exp(-(k * k) / (2 * sigma * sigma));
    wsum += 2 * wk[k];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let acc = img[i];
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        let px = x;
        let py = y;
        let tx = -ny[i] * sgn;
        let ty = nx[i] * sgn;
        for (let k = 1; k <= S; k++) {
          px += tx;
          py += ty;
          const ntx = -sample(ny, w, h, px, py);
          const nty = sample(nx, w, h, px, py);
          // Keep marching the same way (the field is a line field, ±).
          if (ntx * tx + nty * ty < 0) {
            tx = -ntx;
            ty = -nty;
          } else {
            tx = ntx;
            ty = nty;
          }
          const len = Math.hypot(tx, ty) || 1;
          tx /= len;
          ty /= len;
          acc += wk[k] * sample(img, w, h, px, py);
        }
      }
      out[i] = acc / wsum;
    }
  }
  return out;
}

/** 1-D DoG sampled across the edge (along the gradient). */
function dogAcross(g: Float32Array, nx: Float32Array, ny: Float32Array, w: number, h: number, sc: number, rho: number) {
  const ss = 1.6 * sc;
  const T = Math.ceil(3 * ss);
  const wt = new Float32Array(2 * T + 1);
  for (let t = -T; t <= T; t++) {
    wt[t + T] =
      Math.exp(-(t * t) / (2 * sc * sc)) / (sc * Math.sqrt(2 * Math.PI)) -
      (rho * Math.exp(-(t * t) / (2 * ss * ss))) / (ss * Math.sqrt(2 * Math.PI));
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let acc = 0;
      for (let t = -T; t <= T; t++) acc += wt[t + T] * sample(g, w, h, x + t * nx[i], y + t * ny[i]);
      out[i] = acc;
    }
  }
  return out;
}

/** g minus its local mean, where the mean only counts subject pixels. */
function localDiff(g: Float32Array, m: Float32Array, w: number, h: number, sigma: number) {
  const gm = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gm[i] = g[i] * m[i];
  const num = gaussianBlur(gm, w, h, sigma);
  const den = gaussianBlur(m, w, h, sigma);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = g[i] - num[i] / (den[i] + 1e-4);
  return out;
}

// --- cleanup ----------------------------------------------------------------

/** Remove connected components of value `val` smaller than minArea (set to 1-val). */
function dropSmall(ink: Uint8Array, w: number, h: number, val: 0 | 1, minArea: number, eight: boolean) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || ink[s] !== val) continue;
    let sp = 0;
    let n = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      comp[n++] = p;
      const px = p % w;
      const py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          const q = qy * w + qx;
          if (seen[q] || ink[q] !== val) continue;
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
    }
    if (n < minArea) for (let i = 0; i < n; i++) ink[comp[i]] = (1 - val) as 0 | 1;
  }
}

// --- main -------------------------------------------------------------------

/** The expensive, slider-independent part. Compute once per photo. */
export interface LineArtPlanes {
  w: number;
  h: number;
  mask: Uint8Array;
  fdog: Float32Array;
  contrast: Float32Array;
  dark: Float32Array;
}

/**
 * @param gray  luminance 0..1, already composited onto white (w*h)
 * @param mask  subject mask 0..1 (w*h); pass all-ones when there is none
 */
export function computeLineArtPlanes(gray: Float32Array, mask: Float32Array, w: number, h: number): LineArtPlanes {
  const L = Math.max(w, h);
  const m = new Float32Array(w * h);
  const mb = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    m[i] = mask[i] > 0.5 ? 1 : 0;
    mb[i] = m[i];
  }
  const { nx, ny } = gradientField(gray, w, h);
  const gb = gaussianBlur(gray, w, h, 1.0);
  const fdog = flowSmooth(dogAcross(gb, nx, ny, w, h, 1.0, 0.99), nx, ny, w, h, 3);
  const contrast = flowSmooth(localDiff(gb, m, w, h, 0.008 * L), nx, ny, w, h, 4);
  return {
    w,
    h,
    mask: mb,
    fdog,
    contrast,
    dark: localDiff(gb, m, w, h, 0.05 * L),
  };
}

/** Cheap: thresholds + cleanup for a given slider value. Returns ink (1 = black). */
export function renderLineArt(p: LineArtPlanes, params: LineArtParams = { detail: 0.5 }): Uint8Array {
  const { w, h } = p;
  const { eps, k1, darkK } = thresholds(params.detail);
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const on = p.fdog[i] < eps || (p.mask[i] > 0 && (p.contrast[i] < -k1 || p.dark[i] < -darkK));
    raw[i] = on ? 1 : 0;
  }
  const soft = gaussianBlur(raw, w, h, 0.7);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = soft[i] > 0.5 ? 1 : 0;
  const minArea = 0.00003 * w * h;
  dropSmall(ink, w, h, 1, minArea, true); // specks of ink
  dropSmall(ink, w, h, 0, minArea * 0.5, false); // pinholes inside ink
  return ink;
}

export function photoToLineArt(
  gray: Float32Array, mask: Float32Array, w: number, h: number,
  params: LineArtParams = { detail: 0.5 },
): Uint8Array {
  return renderLineArt(computeLineArtPlanes(gray, mask, w, h), params);
}

/** Heuristic: does this look like a photo (vs a ready black/white silhouette)? */
export function looksLikePhoto(rgba: Uint8ClampedArray): boolean {
  let mid = 0;
  let colorful = 0;
  let n = 0;
  for (let i = 0; i < rgba.length; i += 16) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (l > 40 && l < 215) mid++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colorful++;
    n++;
  }
  if (!n) return false;
  return mid / n > 0.25 || colorful / n > 0.15;
}
