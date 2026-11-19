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
import { DEFAULT_PAINT_COLOR, type FoldingPattern, type PageMeasurement } from "@/lib/types";
import { foldMapRows, pairUp } from "@/lib/foldMap";
import { SITE_URL } from "@/lib/site";
import { silhouetteRects } from "@/lib/silhouette";

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

/** Rubik (OFL, Google Fonts) - covers Hebrew, digits and Latin. */
const FONT = "Rubik";

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  } catch {
    return null;
  }
}

/**
 * jsPDF draws glyphs strictly left to right, and its default bidi pass
 * mangles logical Hebrew. So every Hebrew string is reordered to visual
 * order here, and the doc's text() is told to leave it untouched.
 */
type Bidi = { doBidiReorder: (s: string) => string };
const BidiEngine = (jsPDF as unknown as { __bidiEngine__: new (o: object) => Bidi }).__bidiEngine__;
const toVisual = new BidiEngine({
  isInputVisual: false,
  isOutputVisual: true,
  isInputRtl: true,
  isOutputRtl: false,
  isSymmetricSwapping: true,
});
const HEBREW = /[\u0590-\u05FF]/;
const vis = (s: string) => (HEBREW.test(s) ? toVisual.doBidiReorder(s) : s);

function disableBuiltInBidi(doc: jsPDF) {
  const text = doc.text.bind(doc) as (...a: unknown[]) => jsPDF;
  (doc as unknown as { text: (...a: unknown[]) => jsPDF }).text = (t, x, y, o, ...rest) =>
    text(t, x, y, { ...((o as object) ?? {}), isInputVisual: true, isOutputVisual: true }, ...rest);
}

/** Embed Rubik so Hebrew renders. Returns false (Helvetica fallback) on failure. */
async function registerHebrewFont(doc: jsPDF): Promise<boolean> {
  const [regular, bold] = await Promise.all([
    fetchBase64("/fonts/Rubik-Regular.ttf"),
    fetchBase64("/fonts/Rubik-Bold.ttf"),
  ]);
  if (!regular) return false;
  doc.addFileToVFS("Rubik-Regular.ttf", regular);
  doc.addFont("Rubik-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("Rubik-Bold.ttf", bold ?? regular);
  doc.addFont("Rubik-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
  disableBuiltInBidi(doc);
  return true;
}

const HE = {
  brand: "מקפלא",
  credit: "© להב ברק פיסול בספרים",
  page: "עמוד",
  top: "סימון עליון",
  bottom: "סימון תחתון",
  mark: (n: number) => `סימון ${n}`,
  mmf: "סימון וקיפול",
  mmfMulti: (n: number) => `סימון וקיפול - ${n} קווים`,
  cut: "גזירה וקיפול",
  paint: "צביעה",
  rtl: "עברית (ימין לשמאל)",
  ltr: "אנגלית (שמאל לימין)",
  mapNote: "התחל כאן (ליד הדף העליון)",
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
  // Single-line MMF always carries exactly one [top, bottom] pair per leaf,
  // so it gets the fixed Top/Bottom column layout below. Multiline MMF (2-3
  // fold bands per leaf) and Cut & Fold both need a variable Mn-per-leaf
  // grid instead, same as Cut & Fold's - a couple dozen mark pairs can land
  // on one busy leaf, each its own M1/M2/M3... column, so the column count
  // has to be known before the doc is constructed to pick a page big enough
  // that every column stays wide enough for a whole number on one line.
  const isSingleLineMMF = config.mode === "MMF" && (config.mmfLines ?? 1) <= 1;
  const maxMarks = pages.reduce((m, p) => Math.max(m, p.marksCm.length), 0);
  const numDataCols = isSingleLineMMF ? 3 : 1 + maxMarks;

  let format: "a4" | "a3" = "a4";
  let orientation: "portrait" | "landscape" = "portrait";
  if (layout === "table") {
    if (numDataCols > 22) {
      format = "a3";
      orientation = "landscape";
    } else if (numDataCols > 8) {
      orientation = "landscape";
    }
  }

  const doc = new jsPDF({ unit: "mm", format, orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const hebrew = await registerHebrewFont(doc);
  const logo = await loadLogo();
  const logoH = 14; // mm
  const logoW = logo ? (logo.w / logo.h) * logoH : 0;

  // Small background-free silhouette of the design, top-right, so a printed
  // pattern can be matched to its image at a glance.
  const silhouette = silhouetteRects(pattern, 60, 14);

  // Header drawn on every page.
  const drawHeader = () => {
    if (silhouette.length) {
      const w = Math.max(...silhouette.map((r) => r.x + r.w));
      const x0 = pageW - 14 - w;
      doc.setFillColor(0, 0, 0);
      for (const r of silhouette) doc.rect(x0 + r.x, 8 + r.y, r.w, r.h, "F");
    }
    if (logo) {
      doc.addImage(logo.dataUrl, "PNG", 14, 8, logoW, logoH);
      // Clickable logo → homepage.
      doc.link(14, 8, logoW, logoH, { url: SITE_URL });
    }
    doc.setFontSize(9);
    doc.setTextColor(120);
    const lines = config.mmfLines ?? 1;
    const paint = config.paintColor || DEFAULT_PAINT_COLOR;
    const info = hebrew
      ? [
          `עמודים ${config.firstPage}-${config.lastPage}`,
          `${pages.length} דפים`,
          `גובה עמוד ${config.pageHeightCm} ס״מ (מרווח ${config.verticalSpacingCm} ס״מ)`,
          config.mode === "MMF"
            ? lines > 1 ? HE.mmfMulti(lines) : HE.mmf
            : config.mode === "PAINT" ? HE.paint : HE.cut,
          config.direction === "RTL" ? HE.rtl : HE.ltr,
        ].join("  |  ")
      : `pages ${config.firstPage}-${config.lastPage} | ${pages.length} leaves | ${config.pageHeightCm}cm (spacing ${config.verticalSpacingCm}cm) | ${
          config.mode === "MMF" ? (lines > 1 ? `Multiline MMF (${lines} lines)` : "MMF")
          : config.mode === "PAINT" ? `Paint (${paint})` : "Cut & Fold"
        } | ${config.direction}`;
    doc.text(vis(info), pageW - 14, 28, { align: "right" });
    doc.setTextColor(0);
  };

  if (layout === "map") {
    drawFoldMap(
      doc,
      foldMapRows(pages, config.direction),
      config.pageHeightCm,
      pageW,
      pageH,
      drawHeader,
      config.mode === "PAINT" ? config.paintColor || DEFAULT_PAINT_COLOR : null,
      hebrew ? vis(HE.mapNote) : "Top of page at right (bold line = top edge)"
    );
  } else {
    const head = isSingleLineMMF
      ? [[HE.page, HE.top, HE.bottom]]
      : [[HE.page, ...Array.from({ length: maxMarks }, (_, i) => HE.mark(i + 1))]];
    if (!hebrew) {
      head[0] = isSingleLineMMF
        ? ["Page", "Top (cm)", "Bottom (cm)"]
        : ["Page", ...Array.from({ length: maxMarks }, (_, i) => `M${i + 1}`)];
    }

    const body = pages.map((p) => {
      if (p.isBlank) {
        return [String(p.page), ...Array(numDataCols - 1).fill("—")];
      }
      if (isSingleLineMMF) {
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

    // Every column must stay wide enough for the widest number ("40.0", 4
    // chars) plus padding on both sides, or autotable wraps it mid-digit.
    // Solving colWidth = charW*chars + 2*pad for fontSize (Helvetica's
    // average digit width is ~0.196mm per pt) gives the size that just
    // fits - picking the larger page format above keeps this from having
    // to shrink below a legible size even at 30+ columns.
    const usableWidth = pageW - 28;
    const colWidth = usableWidth / numDataCols;
    const fontSize = Math.max(5, Math.min(9, Math.floor((colWidth - 2) / 0.98)));

    // Hebrew reads right to left: "עמוד" is the rightmost column.
    const rtl = (rows: string[][]) =>
      hebrew ? rows.map((r) => [...r].reverse().map(vis)) : rows;

    autoTable(doc, {
      head: rtl(head),
      body: rtl(body),
      startY: 34,
      margin: { top: 33, left: 14, right: 14 },
      styles: { font: hebrew ? FONT : "helvetica", fontSize, cellPadding: fontSize < 9 ? 0.8 : 1.5, halign: "center" },
      headStyles: { fillColor: [29, 36, 51], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 241, 231] },
      didDrawPage: drawHeader,
    });
  }

  // Small credit line at the bottom-right of every page.
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont(hebrew ? FONT : "helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(hebrew ? vis(HE.credit) : "© Lahav Barak Book Sculpture", pageW - 14, pageH - 6, { align: "right" });
    doc.setTextColor(0);
  }

  const safe = name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "pattern";
  doc.save(`mekapele-${safe}.pdf`);
}

/**
 * Draws one ruled row per leaf directly with jsPDF vector primitives (no
 * autotable) - a filled bar per marked band, positioned along the page-height
 * axis with 0cm at the right edge ("top of page at right"). A bold vertical
 * rule marks that 0cm edge down the whole map so the top of the page is
 * unmistakable. Paginates manually since this isn't a table autotable can
 * chunk for us.
 */
function drawFoldMap(
  doc: jsPDF,
  pages: PageMeasurement[],
  pageHeightCm: number,
  pageW: number,
  pageH: number,
  drawHeader: () => void,
  /** PAINT patterns draw their bars in the paint color; null = default ink. */
  barColor: string | null,
  note: string
): void {
  const marginLeft = 14;
  const marginRight = 14;
  const labelGutter = 14;
  const chartWidth = pageW - marginLeft - marginRight - labelGutter;
  const top = 37;
  const bottom = pageH - 14;
  const rowHeight = 5;
  const barHeight = 2.2;
  const rowsPerPage = Math.max(1, Math.floor((bottom - top) / rowHeight));

  const cmToX = (cm: number) => marginLeft + chartWidth - (cm / pageHeightCm) * chartWidth;
  const topEdgeX = cmToX(0);

  for (let start = 0; start < pages.length; start += rowsPerPage) {
    const chunk = pages.slice(start, start + rowsPerPage);
    if (start > 0) doc.addPage();
    drawHeader();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(note, pageW - marginRight, top - 4, { align: "right" });
    doc.setTextColor(0);

    chunk.forEach((p, row) => {
      const y = top + row * rowHeight;
      doc.setDrawColor(217, 205, 182);
      doc.setLineWidth(0.1);
      doc.line(marginLeft, y, marginLeft + chartWidth, y);

      if (barColor) doc.setFillColor(barColor);
      else doc.setFillColor(29, 36, 51);
      pairUp(p.marksCm).forEach(([lo, hi]) => {
        const x1 = cmToX(hi);
        const x2 = cmToX(lo);
        doc.rect(x1, y - barHeight / 2, Math.max(0.3, x2 - x1), barHeight, "F");
      });

      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(String(p.page), marginLeft + chartWidth + labelGutter - 2, y + 1.2, { align: "right" });
    });

    // Top-of-page edge, spanning every row on this sheet.
    doc.setDrawColor(0);
    doc.setLineWidth(0.9);
    doc.line(topEdgeX, top - rowHeight / 2, topEdgeX, top + (chunk.length - 1) * rowHeight + rowHeight / 2);
  }
}
