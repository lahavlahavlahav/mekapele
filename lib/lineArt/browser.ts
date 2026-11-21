// =============================================================================
// PHOTO → LINE ART: browser glue
// -----------------------------------------------------------------------------
// - decodePhoto: any image the phone/browser gives us, incl. iPhone HEIC
//   (converted with heic2any, loaded only when needed).
// - removeBackground: U²-Net-p (4.7 MB, Apache-2.0) run in the browser with
//   onnxruntime-web. The photo never leaves the device.
// - preparePhoto: crops to the subject, scales to the working size and hands
//   back luminance + mask planes for lib/lineArt/lineArt.ts.
// =============================================================================

const ORT_VERSION = "1.31.1";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
// The model is stored in 5 parts (the GitHub push path has a per-request
// size limit); the browser fetches and joins them.
const MODEL_PARTS = [0, 1, 2, 3, 4].map((i) => `/models/u2netp.onnx.part${i}`);
const MODEL_SIZE = 320;
/** Long edge of the working image the line-art algorithm runs on. */
export const WORK_EDGE = 900;
/** Cap on the decoded photo so huge phone photos don't eat memory. */
const MAX_DECODE_EDGE = 2400;

// --- decoding ---------------------------------------------------------------

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function loadImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

/** Decode any uploaded image into a canvas (EXIF rotation is applied by the browser). */
export async function decodePhoto(file: File): Promise<HTMLCanvasElement> {
  let img: HTMLImageElement;
  try {
    img = await loadImg(file);
  } catch {
    if (!isHeic(file)) throw new Error("לא הצלחנו לקרוא את התמונה. נסו קובץ JPG או PNG.");
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    img = await loadImg(Array.isArray(out) ? out[0] : out);
  }
  const s = Math.min(1, MAX_DECODE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Sampled pixels of a canvas, for the "is this a photo?" heuristic. */
export function canvasPixels(c: HTMLCanvasElement, maxEdge = 200): Uint8ClampedArray {
  const s = Math.min(1, maxEdge / Math.max(c.width, c.height));
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(c.width * s));
  t.height = Math.max(1, Math.round(c.height * s));
  const ctx = t.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(c, 0, 0, t.width, t.height);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}

// --- onnxruntime-web (loaded from the CDN on first use) ---------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ort = any;
let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<any> | null = null;

function loadOrt(): Promise<Ort> {
  if (ortPromise) return ortPromise;
  ortPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.ort) return resolve(w.ort);
    const s = document.createElement("script");
    s.src = `${ORT_BASE}ort.wasm.min.js`;
    s.async = true;
    s.onload = () => {
      const ort = w.ort;
      ort.env.wasm.wasmPaths = ORT_BASE;
      // Multi-threading needs cross-origin isolation, which the site doesn't
      // have; one thread is plenty for a 320×320 model.
      ort.env.wasm.numThreads = 1;
      resolve(ort);
    };
    s.onerror = () => {
      ortPromise = null;
      reject(new Error("טעינת מנוע הסרת הרקע נכשלה. בדקו את החיבור ונסו שוב."));
    };
    document.head.appendChild(s);
  });
  return ortPromise;
}

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = loadOrt()
      .then(async (ort) => {
        const parts = await Promise.all(
          MODEL_PARTS.map(async (u) => {
            const r = await fetch(u);
            if (!r.ok) throw new Error("טעינת מודל הסרת הרקע נכשלה. נסו שוב.");
            return new Uint8Array(await r.arrayBuffer());
          }),
        );
        const model = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let off = 0;
        for (const p of parts) {
          model.set(p, off);
          off += p.length;
        }
        return ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
      })
      .catch((e) => {
        sessionPromise = null;
        throw e;
      });
  }
  return sessionPromise;
}

/** Start downloading the runtime + model early (e.g. when the modal opens). */
export function warmUpBackgroundRemoval() {
  getSession().catch(() => {});
}

/**
 * Subject mask (0..1) at MODEL_SIZE×MODEL_SIZE.
 * Pre/post-processing matches rembg's u2netp session.
 */
export async function removeBackground(photo: HTMLCanvasElement): Promise<Float32Array> {
  const [ort, session] = await Promise.all([loadOrt(), getSession()]);
  const S = MODEL_SIZE;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  let max = 1e-6;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * S * S);
  for (let p = 0; p < S * S; p++) {
    for (let ch = 0; ch < 3; ch++) input[ch * S * S + p] = (px[p * 4 + ch] / max - mean[ch]) / std[ch];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) };
  const out = await session.run(feeds);
  const pred = out[session.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < S * S; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const mask = new Float32Array(S * S);
  const span = hi - lo || 1;
  for (let i = 0; i < S * S; i++) mask[i] = (pred[i] - lo) / span;
  return mask;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- preparing the working planes ------------------------------------------

export interface PreparedPhoto {
  w: number;
  h: number;
  gray: Float32Array; // 0..1, composited onto white
  mask: Float32Array; // 0..1
  /** The cropped colour photo at working size, for the before/after toggle. */
  colorUrl: string;
}

/** Mask (MODEL_SIZE²) → canvas of the given size, smoothly upscaled. */
function maskToCanvas(mask: Float32Array, w: number, h: number): HTMLCanvasElement {
  const S = MODEL_SIZE;
  const small = document.createElement("canvas");
  small.width = S;
  small.height = S;
  const sctx = small.getContext("2d")!;
  const id = sctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = Math.round(mask[i] * 255);
    id.data[i * 4] = v;
    id.data[i * 4 + 1] = v;
    id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(id, 0, 0);
  const big = document.createElement("canvas");
  big.width = w;
  big.height = h;
  const bctx = big.getContext("2d", { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, w, h);
  return big;
}

/**
 * Crop the photo to the subject (with a small margin), scale to WORK_EDGE
 * and return the planes the line-art algorithm needs. With mask = null the
 * whole photo is used (background kept).
 */
export function preparePhoto(photo: HTMLCanvasElement, mask: Float32Array | null): PreparedPhoto {
  const PW = photo.width;
  const PH = photo.height;
  // Subject bounding box in photo coordinates.
  let x0 = 0, y0 = 0, x1 = PW, y1 = PH;
  if (mask) {
    const S = MODEL_SIZE;
    let mnx = S, mny = S, mxx = -1, mxy = -1;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (mask[y * S + x] > 0.5) {
          if (x < mnx) mnx = x;
          if (x > mxx) mxx = x;
          if (y < mny) mny = y;
          if (y > mxy) mxy = y;
        }
    if (mxx >= 0) {
      const mx = 0.03 * S;
      x0 = Math.max(0, Math.floor(((mnx - mx) / S) * PW));
      y0 = Math.max(0, Math.floor(((mny - mx) / S) * PH));
      x1 = Math.min(PW, Math.ceil(((mxx + 1 + mx) / S) * PW));
      y1 = Math.min(PH, Math.ceil(((mxy + 1 + mx) / S) * PH));
    }
  }
  const cw = x1 - x0;
  const ch = y1 - y0;
  const s = WORK_EDGE / Math.max(cw, ch);
  const w = Math.max(1, Math.round(cw * s));
  const h = Math.max(1, Math.round(ch * s));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, x0, y0, cw, ch, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const colorUrl = c.toDataURL("image/jpeg", 0.85);

  let alpha: Uint8ClampedArray | null = null;
  if (mask) {
    const full = maskToCanvas(mask, PW, PH);
    const mc = document.createElement("canvas");
    mc.width = w;
    mc.height = h;
    const mctx = mc.getContext("2d", { willReadFrequently: true })!;
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(full, x0, y0, cw, ch, 0, 0, w, h);
    alpha = mctx.getImageData(0, 0, w, h).data;
  }

  const gray = new Float32Array(w * h);
  const m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = alpha ? alpha[i * 4] / 255 : 1;
    const l = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    gray[i] = l * a + (1 - a);
    m[i] = a;
  }
  return { w, h, gray, mask: m, colorUrl };
}

/** Ink plane (1 = black) minus erased pixels → black/white canvas. */
export function inkToCanvas(ink: Uint8Array, erased: Uint8Array | null, w: number, h: number, target?: HTMLCanvasElement) {
  const c = target ?? document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = ink[i] && !(erased && erased[i]) ? 0 : 255;
    id.data[i * 4] = v;
    id.data[i * 4 + 1] = v;
    id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

export function canvasToPngFile(c: HTMLCanvasElement, name = "line-art.png"): Promise<File> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(new File([b], name, { type: "image/png" })) : reject(new Error("export"))), "image/png"),
  );
}
