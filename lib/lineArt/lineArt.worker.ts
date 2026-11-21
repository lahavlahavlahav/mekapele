// Runs the line-art algorithm off the main thread. Keeps the expensive
// planes for the current photo so slider moves only re-threshold.
import { computeLineArtPlanes, renderLineArt, type LineArtPlanes } from "./lineArt";

let planes: LineArtPlanes | null = null;

type Msg =
  | { type: "compute"; id: number; gray: Float32Array; mask: Float32Array; w: number; h: number; detail: number }
  | { type: "render"; id: number; detail: number };

self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data;
  try {
    if (msg.type === "compute") planes = computeLineArtPlanes(msg.gray, msg.mask, msg.w, msg.h);
    if (!planes) throw new Error("no photo");
    const ink = renderLineArt(planes, { detail: msg.detail });
    (self as unknown as Worker).postMessage({ id: msg.id, ink, w: planes.w, h: planes.h }, [ink.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
};
