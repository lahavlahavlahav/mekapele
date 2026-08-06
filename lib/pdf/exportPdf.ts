// =============================================================================
// PDF EXPORT  (jsPDF + autotable)
// -----------------------------------------------------------------------------
// Builds a print-ready PDF of folding measurements with the Mekapele logo
// embedded at the top of EVERY page. Runs in the browser (client-side).
//
// Logo: loaded from "/mekapele-logo.png" (public root) and drawn in the page
// header via autotable's didDrawPage hook so it repeats on every page.
// =============================================================================

"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FoldingPattern, PageMeasurement } from "@/lib/types";

/** Load the logo once as a data URL so jsPDF can embed it. */
async function loadLogo(): Promise<{
  dataUrl: string;
  w: number;
  h: number;
} | null> {
  try {
    const res = await fetch("/mekapele-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    // Read intrinsic size to preserve aspect ratio.
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 600, h: 232 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

const HE = {
  title: "תבנית קיפול ספר",
  page: "עמוד",
  top: "עליון (ס״מ)",
  bottom: "תחתון (ס״מ)",
  noFold: "— אין קיפול —",
  mmf: "סימון וקיפול",
  cut: "גזירה וקיפול",
  pages: "עמודים",
  leaves: "עלים",
  height: "גובה עמוד",
};

/**
 * Generate and download a measurements PDF.
 * NOTE: jsPDF's core fonts don't shape Hebrew/RTL text. We keep the header
 * labels minimal and rely on numeric data (direction-independent) for the
 * table body. For full Hebrew glyphs, embed a Unicode font (see note below).
 *
 * `layout`: "table" is the original measurement grid; "map" is a visual
 * fold-map (one ruled row per leaf, a filled bar per marked band) matching
 * the reference export a competitor tool produces - same underlying data,
 * just a profile a folder can scan at a glance instead of reading numbers.
 */
export async function exportPatternPdf(
  pattern: FoldingPattern,
  name: string,
  layout: "table" | "map" = "table"
): Promise<void> {
  const { config, pages } = pattern;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const logo = await loadLogo();
  const logoH = 14; // mm
  const logoW = logo ? (logo.w / logo.h) * logoH : 0;

  // Header drawn on every page.
  const drawHeader = () => {
    if (logo) {
      doc.addImage(logo.dataUrl, "PNG", 14, 8, logoW, logoH);
    }
    doc.setFontSize(14);
    doc.text("Mekapele", pageW - 14, 16, { align: "right" });
    doc.setFontSize(9);
    doc.setTextColor(120);
    const modeLabel = config.mode === "MMF" ? "MMF" : "Cut & Fold";
    doc.text(
      `pages ${config.firstPage}-${config.lastPage} | ${pages.length} leaves | ${config.pageHeightCm}cm (spacing ${config.verticalSpacingCm}cm) | ${modeLabel} | ${config.direction}`,
      pageW - 14,
      22,
      { align: "right" }
    );
    doc.setTextColor(0);
  };

  if (layout === "map") {
    drawFoldMap(doc, pages, config.pageHeightCm, pageW, pageH, drawHeader);
  } else {
    // Build rows. For MMF: Page | Top | Bottom. Cut&Fold: Page | marks...
    const maxMarks = pages.reduce((m, p) => Math.max(m, p.marksCm.length), 0);
    const head =
      config.mode === "MMF"
        ? [["Page", "Top (cm)", "Bottom (cm)"]]
        : [["Page", ...Array.from({ length: maxMarks }, (_, i) => `M${i + 1}`)]];

    const body = pages.map((p) => {
      if (p.isBlank) {
        return [String(p.page), "—", ...(config.mode === "MMF" ? ["—"] : [])];
      }
      if (config.mode === "MMF") {
        return [
          String(p.page),
          p.marksCm[0]?.toFixed(1) ?? "",
          p.marksCm[1]?.toFixed(1) ?? "",
        ];
      }
      return [
        String(p.page),
        ...Array.from({ length: maxMarks }, (_, i) =>
          p.marksCm[i] !== undefined ? p.marksCm[i].toFixed(1) : ""
        ),
      ];
    });

    autoTable(doc, {
      head,
      body,
      startY: 30,
      margin: { top: 28, left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [29, 36, 51], textColor: 255 },
      alternateRowStyles: { fillColor: [246, 241, 231] },
      didDrawPage: drawHeader,
    });
  }

  const safe = name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "pattern";
  doc.save(`mekapele-${safe}.pdf`);
}

/** [start, end] pairs (order-independent) from a leaf's flat marksCm array. */
function pairUp(marksCm: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    pairs.push([Math.min(marksCm[i], marksCm[i + 1]), Math.max(marksCm[i], marksCm[i + 1])]);
  }
  return pairs;
}

/**
 * Draws one ruled row per leaf directly with jsPDF vector primitives (no
 * autotable) - a filled bar per marked band, positioned along the page-height
 * axis with 0cm at the right edge ("top of page at right"). Paginates
 * manually since this isn't a table autotable can chunk for us.
 */
function drawFoldMap(
  doc: jsPDF,
  pages: PageMeasurement[],
  pageHeightCm: number,
  pageW: number,
  pageH: number,
  drawHeader: () => void
): void {
  const marginLeft = 14;
  const marginRight = 14;
  const labelGutter = 14;
  const chartWidth = pageW - marginLeft - marginRight - labelGutter;
  const top = 30;
  const bottom = pageH - 14;
  const rowHeight = 5;
  const barHeight = 2.2;
  const rowsPerPage = Math.max(1, Math.floor((bottom - top) / rowHeight));

  const cmToX = (cm: number) => marginLeft + chartWidth - (cm / pageHeightCm) * chartWidth;

  let row = 0;
  pages.forEach((p, i) => {
    if (row === 0) {
      if (i > 0) doc.addPage();
      drawHeader();
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Top of page at right", pageW - marginRight, top - 4, { align: "right" });
      doc.setTextColor(0);
    }

    const y = top + row * rowHeight;
    doc.setDrawColor(217, 205, 182);
    doc.setLineWidth(0.1);
    doc.line(marginLeft, y, marginLeft + chartWidth, y);

    doc.setFillColor(29, 36, 51);
    pairUp(p.marksCm).forEach(([lo, hi]) => {
      const x1 = cmToX(hi);
      const x2 = cmToX(lo);
      doc.rect(x1, y - barHeight / 2, Math.max(0.3, x2 - x1), barHeight, "F");
    });

    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(String(p.page), marginLeft + chartWidth + labelGutter - 2, y + 1.2, { align: "right" });

    row = row + 1 >= rowsPerPage ? 0 : row + 1;
  });
}
