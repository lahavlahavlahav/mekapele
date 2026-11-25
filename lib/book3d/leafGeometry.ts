// =============================================================================
// 3D BOOK GEOMETRY  (pure, no React/Three side effects at module scope)
// -----------------------------------------------------------------------------
// Turns one leaf's fold marks (lib/algorithm.ts output) into a physically
// sensible page outline (see buildLeafShape for how each technique folds).
// Fanning many of these around a shared spine axis at increasing angles
// reproduces the relief of real book-folding art.
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
  fullDepth: number; // the page's full depth (spine to fore-edge)
  /** MMF: corner folds running from each mark to the spine. CUT_AND_FOLD: full page, design bands folded inward. PAINT leaves aren't folded at all - use buildFlatLeafShape + buildPaintShapes instead. */
  mode?: FoldingMode;
  /** CUT_AND_FOLD only: how deep (cm) the design bands are cut and folded in. Defaults to CUT_FOLD_RECESS_CM. */
  recessCm?: number;
}

/**
 * Cut & Fold: how deep (cm) each design band is cut and folded inward. Real
 * cuts are ~1-1.5cm; the folded-in tab leaves the design as a recessed groove
 * in an otherwise full fore-edge (the "Hope" reference look).
 */
export const CUT_FOLD_RECESS_CM = 1.4;

/** Upper bound for a user-chosen cut depth, as a fraction of the page depth (keeps the fore-edge from vanishing). */
export const MAX_RECESS_FRACTION = 0.5;

/** [start, end] pairs in "distance from top of page, cm" order, start < end. */
function pairUp(marksCm: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    pairs.push([marksCm[i], marksCm[i + 1]]);
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

/** Marked bands converted to "distance from bottom" (world-up) [low, high], sorted bottom-up, overlaps dropped. */
function bandsFromBottom(page: PageMeasurement, pageHeightCm: number): [number, number][] {
  const raw = pairUp(page.marksCm)
    .map(([topCm, bottomCm]): [number, number] => [
      Math.max(0, pageHeightCm - bottomCm),
      Math.min(pageHeightCm, pageHeightCm - topCm),
    ])
    .sort((a, b) => a[0] - b[0]);
  const bands: [number, number][] = [];
  let cursor = -Infinity;
  for (const [low, high] of raw) {
    const l = Math.max(low, cursor);
    if (high > l) {
      bands.push([l, high]);
      cursor = high;
    }
  }
  return bands;
}

/**
 * Build the 2D outline of one leaf in (depth, spinePosition) space:
 * spinePosition runs 0 (bottom of page) to pageHeightCm (top); depth runs 0
 * (at the spine) outward.
 *
 * MMF (measure-mark-fold): the top corner is folded down at 45deg starting at
 * the top mark, and the bottom corner up at 45deg from the bottom mark - so
 * the page's silhouette is a full-depth fore-edge between the marks, 45deg
 * chamfers, and the page's own top/bottom edge (the hexagonal relief of real
 * MMF art). Between stacked bands (multiline
 * MMF) the paper is folded in as a 45deg V. A blank leaf is folded in from
 * both corners into a shallow point.
 *
 * CUT_AND_FOLD: the page stays at full depth; every design band is cut and
 * its tab folded inward, leaving a recessed notch of CUT_FOLD_RECESS_CM.
 */
export function buildLeafShape(page: PageMeasurement, params: LeafShapeParams): THREE.Shape {
  const { pageHeightCm: H, fullDepth: D, mode = "MMF", recessCm } = params;
  const shape = new THREE.Shape();
  const bands = page.isBlank ? [] : bandsFromBottom(page, H);

  if (mode === "CUT_AND_FOLD") {
    const recess = recessCm != null
      ? Math.min(Math.max(recessCm, 0.1), D * MAX_RECESS_FRACTION)
      : Math.min(CUT_FOLD_RECESS_CM, D * 0.2);
    shape.moveTo(0, 0);
    shape.lineTo(D, 0);
    for (const [low, high] of bands) {
      shape.lineTo(D, low);
      shape.lineTo(D - recess, low);
      shape.lineTo(D - recess, high);
      shape.lineTo(D, high);
    }
    shape.lineTo(D, H);
    shape.lineTo(0, H);
    shape.closePath();
    return shape;
  }

  // MMF: 45deg corner folds. Below the first band the crease runs from the
  // mark down-and-in at 45deg, meeting the bottom edge at depth D - low (or
  // the spine, if the mark is higher than the page is deep); same mirrored
  // above the last band. Between stacked bands the paper folds in as a V.
  if (bands.length === 0) {
    shape.moveTo(0, 0);
    shape.lineTo(D * 0.3, H / 2);
    shape.lineTo(0, H);
    shape.closePath();
    return shape;
  }
  const firstLow = bands[0][0];
  if (firstLow >= D) {
    shape.moveTo(0, 0);
    shape.lineTo(0, firstLow - D);
  } else {
    shape.moveTo(0, 0);
    shape.lineTo(D - firstLow, 0);
  }
  bands.forEach(([low, high], i) => {
    if (i > 0) {
      const prevHigh = bands[i - 1][1];
      const gap = low - prevHigh;
      if (gap > 0) shape.lineTo(D - Math.min(gap / 2, D), prevHigh + gap / 2);
    }
    shape.lineTo(D, low);
    shape.lineTo(D, high);
  });
  const above = H - bands[bands.length - 1][1];
  if (above >= D) {
    shape.lineTo(0, H - above + D);
  } else {
    shape.lineTo(D - above, H);
  }
  shape.lineTo(0, H);
  shape.closePath();
  return shape;
}

/**
 * PAINT mode: one rectangle per marked band, hugging the leaf's outer edge
 * (depth fullDepth - stripDepth .. fullDepth). Extruded slightly thicker than
 * the leaf itself, it reads as paint covering the fore-edge and wrapping a
 * little onto both faces - the leaf underneath stays a full, unfolded page.
 * Empty for a blank leaf.
 */
export function buildPaintShapes(
  page: PageMeasurement,
  pageHeightCm: number,
  fullDepth: number,
  stripDepth: number
): THREE.Shape[] {
  if (page.isBlank) return [];
  return pairUp(page.marksCm).map(([topCm, bottomCm]) => {
    const low = Math.max(0, pageHeightCm - bottomCm);
    const high = Math.min(pageHeightCm, pageHeightCm - topCm);
    const shape = new THREE.Shape();
    shape.moveTo(fullDepth - stripDepth, low);
    shape.lineTo(fullDepth, low);
    shape.lineTo(fullDepth, high);
    shape.lineTo(fullDepth - stripDepth, high);
    shape.closePath();
    return shape;
  });
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
