// Shared helpers for the fold-map layout (PDF export + on-screen chart).

import type { PageMeasurement, ReadingDirection } from "@/lib/types";

/** [start, end] pairs (order-independent) from a leaf's flat marksCm array. */
export function pairUp(marksCm: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    pairs.push([Math.min(marksCm[i], marksCm[i + 1]), Math.max(marksCm[i], marksCm[i + 1])]);
  }
  return pairs;
}

/**
 * Rows of the fold map, top to bottom. The map is a picture of the image, so
 * it must look the same whichever way the book reads - rows always follow the
 * image's columns left→right. `pages` is in folding order, which for RTL
 * starts at the image's rightmost column, so RTL is reversed here; only the
 * page-number labels (and the numeric table) differ between directions.
 */
export function foldMapRows(pages: PageMeasurement[], direction: ReadingDirection): PageMeasurement[] {
  return direction === "RTL" ? [...pages].reverse() : pages;
}
