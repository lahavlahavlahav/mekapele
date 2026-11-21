// =============================================================================
// Body-part segmentation for the smart fill
// -----------------------------------------------------------------------------
// MediaPipe "selfie multiclass" (Apache-2.0) labels every pixel of a photo of
// people as hair / body skin / face skin / clothes / accessories. The fill
// tool uses it so a tap on the hair fills exactly the hair - not the eyes
// (face skin) or the shirt (clothes). Loaded from the CDN only when the fill
// tool is first used; runs in the browser.
// =============================================================================

const MP_VERSION = "0.10.35";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite";

/** Category ids of the model. */
export const PART = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, others: 5 } as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
let segmenterPromise: Promise<any> | null = null;

function getSegmenter(): Promise<any> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const url = `${MP_BASE}/vision_bundle.mjs`;
      const mod: any = await import(/* webpackIgnore: true */ url);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      return mod.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

/** Per-pixel part id for a canvas, at the canvas's own size. */
export async function segmentParts(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const seg = await getSegmenter();
  const res = seg.segment(canvas);
  const m = res.categoryMask;
  const src: Uint8Array = m.getAsUint8Array();
  const mw: number = m.width;
  const mh: number = m.height;
  const W = canvas.width;
  const H = canvas.height;
  const out = new Uint8Array(W * H);
  if (mw === W && mh === H) out.set(src);
  else
    for (let y = 0; y < H; y++) {
      const sy = Math.min(mh - 1, Math.floor((y * mh) / H));
      for (let x = 0; x < W; x++) out[y * W + x] = src[sy * mw + Math.min(mw - 1, Math.floor((x * mw) / W))];
    }
  res.close?.();
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
