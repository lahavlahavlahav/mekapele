// =============================================================================
// 3D BOOK GEOMETRY  (pure, no React/Three side effects at module scope)
// -----------------------------------------------------------------------------
// Turns one leaf's fold marks (lib/algorithm.ts output) into a physically
// sensible page shape: a thin rectangle hinged along the spine that stays
// folded back close to the spine EXCEPT within the marked band(s), where it
// extends out to full page depth. Fanning many of these around a shared
// spine axis at increasing angles reproduces the relief-silhouette effect of
// real book-folding art (see ALGORITHM_NOTES.md reference image).
//
// Coordinate model (see orientLeaf for the full derivation):
//   - The spine is a fixed line segment of length `pageHeightCm` along
//     world Y (vertical), centered at the origin - the book stands upright,
//     matching how book-folding art is actually displayed (spine up, pages
//     fanning open sideways), rather than lying flat on its side.
//   - Each leaf is a flat shape drawn in local (depth, spinePosition) space,
//     extruded by a small thickness, then rotated so spinePosition maps onto
//     the shared world-Y spine and depth points outward at the leaf's own
//     fan angle (rotating in the world X-Z plane around that spine axis).
// =============================================================================

import * as THREE from "three";
import type { FoldingMode, PageMeasurement } from "@/lib/types";

export interface LeafShapeParams {
  pageHeightCm: number;
  foldedDepth: number; // how far a folded-under (blank) region extends from the spine
  fullDepth: number; // how far a region within a fold-mark band extends (full page depth)
  /** MMF gets a diagonal fold-crease bevel at each transition (see buildLeafShape); Cut & Fold keeps a sharp edge, since that one's genuinely cut. */
  mode?: FoldingMode;
}

// Cosmetic width (cm) of the diagonal crease drawn at each MMF fold
// transition - doesn't touch the actual mark position used for printing/
// instructions, purely softens the 3D silhouette so it reads as a bent
// paper crease instead of a machined right-angle notch (which is what a
// Cut & Fold edge should actually look like, not what MMF should).
const FOLD_BEVEL_CM = 0.3;

// How far (cm) the outer tip of an MMF band bulges past fullDepth at its
// midpoint - without this the tip is a flat straight line, which reads as an
// open/cut edge rather than paper that's folded over.
const FOLD_TIP_BULGE_CM = 0.25;

/** [start, end] pairs in "distance from top of page, cm" order, start < end. */
function pairUp(marksCm: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    pairs.push([marksCm[i], marksCm[i + 1]]);
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

/**
 * Build the 2D cross-section of one leaf: a "comb tooth" outline in
 * (depth, spinePosition) space. spinePosition runs 0 (bottom of page) to
 * pageHeightCm (top of page); depth runs 0 (at the spine) outward.
 */
export function buildLeafShape(
  page: PageMeasurement,
  params: LeafShapeParams
): THREE.Shape {
  const { pageHeightCm, foldedDepth, fullDepth, mode = "MMF" } = params;
  const useBevel = mode === "MMF";
  const shape = new THREE.Shape();

  if (page.isBlank || page.marksCm.length === 0) {
    // Fully folded flap: a plain thin rectangle hugging the spine.
    shape.moveTo(0, 0);
    shape.lineTo(foldedDepth, 0);
    shape.lineTo(foldedDepth, pageHeightCm);
    shape.lineTo(0, pageHeightCm);
    shape.closePath();
    return shape;
  }

  // Convert "distance from top" bands to "distance from bottom" (world-up) bands.
  const bands = pairUp(page.marksCm)
    .map(([topCm, bottomCm]): [number, number] => [
      Math.max(0, pageHeightCm - bottomCm),
      Math.min(pageHeightCm, pageHeightCm - topCm),
    ])
    .sort((a, b) => a[0] - b[0]);

  shape.moveTo(foldedDepth, 0);
  let cursor = 0;
  for (const [bandLow, bandHigh] of bands) {
    if (bandHigh <= cursor) continue; // ignore degenerate/overlapping bands
    const low = Math.max(bandLow, cursor);
    if (low >= bandHigh) continue;

    // A real MMF fold bends gradually, not through a machined right-angle
    // notch - clamp the diagonal's width so it can never eat into this
    // band's own height or the room left before/after neighboring bands
    // (which would otherwise self-intersect the outline).
    const bevelIn = useBevel ? Math.min(FOLD_BEVEL_CM, low - cursor, (bandHigh - low) / 2) : 0;
    const bevelOut = useBevel
      ? Math.min(FOLD_BEVEL_CM, (bandHigh - low) / 2, pageHeightCm - bandHigh)
      : 0;

    shape.lineTo(foldedDepth, low - bevelIn);
    shape.lineTo(fullDepth, low + bevelIn);
    if (useBevel) {
      // Round the tip itself into a gentle outward bulge instead of a flat
      // straight run - a real folded-over edge is never perfectly flat.
      const tipLow = low + bevelIn;
      const tipHigh = bandHigh - bevelOut;
      shape.quadraticCurveTo(fullDepth + FOLD_TIP_BULGE_CM, (tipLow + tipHigh) / 2, fullDepth, tipHigh);
    } else {
      shape.lineTo(fullDepth, bandHigh - bevelOut);
    }
    shape.lineTo(foldedDepth, bandHigh + bevelOut);
    cursor = bandHigh + bevelOut;
  }
  shape.lineTo(foldedDepth, pageHeightCm);
  shape.lineTo(0, pageHeightCm);
  shape.lineTo(0, 0);
  shape.closePath();
  return shape;
}

/** A plain full-depth rectangle - used for the front/back covers. */
export function buildFlatLeafShape(pageHeightCm: number, depth: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(depth, 0);
  shape.lineTo(depth, pageHeightCm);
  shape.lineTo(0, pageHeightCm);
  shape.closePath();
  return shape;
}

/**
 * Orient a leaf mesh (built from buildLeafShape/buildFlatLeafShape, extruded
 * along local Z for thickness) so that:
 *   - local Y (spine position, 0..pageHeightCm) maps onto world Y, centered -
 *     the book stands upright, spine vertical.
 *   - local X (depth, 0..fullDepth) maps onto a world direction that fans
 *     outward at `angle` (radians) from front-center, rotating in the world
 *     X-Z plane around the shared spine (world Y axis).
 *   - local Z (thickness) maps onto the tangent direction, so consecutive
 *     leaves at slightly different angles don't z-fight.
 */
export function orientLeaf(
  mesh: THREE.Object3D,
  angle: number,
  pageHeightCm: number
): void {
  const depthDir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const spineDir = new THREE.Vector3(0, 1, 0);
  // Must be depthDir x spineDir (not the reverse) so (depthDir, spineDir,
  // thicknessDir) is a right-handed, determinant +1 basis - makeBasis()
  // silently accepts a left-handed triple too, but setFromRotationMatrix
  // then extracts a bogus quaternion since a reflection isn't a rotation.
  const thicknessDir = new THREE.Vector3().crossVectors(depthDir, spineDir).normalize();
  const basis = new THREE.Matrix4().makeBasis(depthDir, spineDir, thicknessDir);
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.position.set(0, -pageHeightCm / 2, 0);
}
