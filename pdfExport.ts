/**
 * pdfExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a branded "Workshop Guide" PDF using jsPDF.
 *
 * Layout per page:
 *   • Header: logo (left) + title + generation date (right)
 *   • Divider line
 *   • Table: עמוד | שיטה | מ (ס"מ) | עד (ס"מ) | גובה | ✓
 *   • Footer: page N / total
 *
 * The PDF uses jspdf-autotable for the measurement table.
 * Logo is fetched as a data-URL from /mekapele-logo.png at runtime.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FoldRow } from "@/lib/dualViewStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_AMBER = [245, 158, 11] as const;   // amber-400
const BRAND_DARK  = [28, 25, 23] as const;     // stone-950
const BODY_GRAY   = [120, 113, 108] as const;  // stone-500
const LIGHT_GRAY  = [41, 37, 36] as const;     // stone-800 (as table row bg in dark)
const ROW_EVEN    = [250, 250, 249] as const;  // stone-50
const ROW_ODD     = [255, 255, 255] as const;

const LOGO_PATH = "/mekapele-logo.png";
const ROWS_PER_PAGE = 40;

// ── Logo loader ───────────────────────────────────────────────────────────────

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Header painter ────────────────────────────────────────────────────────────

function paintHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  generatedAt: string,
  pageW: number
) {
  const marginX = 15;
  const headerH = 22;

  // Background strip
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, headerH, "F");

  // Logo (if available)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, 4, 40, 14);
    } catch {
      // fallback: text logo
      doc.setFontSize(11).setTextColor(245, 158, 11).setFont("helvetica", "bold");
      doc.text("Mekapele", marginX, 14);
    }
  } else {
    doc.setFontSize(11).setTextColor(245, 158, 11).setFont("helvetica", "bold");
    doc.text("Mekapele", marginX, 14);
  }

  // Title (centre)
  doc.setFontSize(9).setTextColor(200, 200, 200).setFont("helvetica", "normal");
  doc.text("מדריך קיפולי ספרים — Workshop Guide", pageW / 2, 10, { align: "center" });

  // Date (right)
  doc.setFontSize(7).setTextColor(...BODY_GRAY as [number, number, number]);
  doc.text(generatedAt, pageW - marginX, 10, { align: "right" });

  // Amber rule
  doc.setDrawColor(...BRAND_AMBER);
  doc.setLineWidth(0.6);
  doc.line(0, headerH, pageW, headerH);
}

// ── Footer painter ────────────────────────────────────────────────────────────

function paintFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  pageW: number,
  pageH: number
) {
  const y = pageH - 8;
  doc.setFontSize(7).setTextColor(...BODY_GRAY as [number, number, number]).setFont("helvetica", "normal");
  doc.text(`עמוד ${pageNum} מתוך ${totalPages}`, pageW / 2, y, { align: "center" });
  doc.text("mekapele.com", 15, y);
}

// ── Main export function ──────────────────────────────────────────────────────

export async function generateWorkshopPDF(
  rows: FoldRow[],
  completedPages: number[]
): Promise<void> {
  if (!rows.length) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleDateString("he-IL", {
    year: "numeric", month: "long", day: "numeric",
  });

  const completedSet = new Set(completedPages);
  const logoDataUrl = await loadLogoDataUrl();

  // Build table rows
  const tableBody = rows.map((r) => [
    String(r.page),
    r.method,
    r.startCm.toFixed(1),
    r.endCm.toFixed(1),
    (r.endCm - r.startCm).toFixed(1),
    completedSet.has(r.page) ? "✓" : "",
  ]);

  // Use autoTable — it handles pagination internally
  autoTable(doc, {
    head: [["עמוד", "שיטה", "מ (ס\"מ)", "עד (ס\"מ)", "גובה", "✓"]],
    body: tableBody,
    startY: 26,
    margin: { top: 26, left: 15, right: 15, bottom: 16 },
    tableLineColor: [60, 54, 52],
    tableLineWidth: 0.1,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      halign: "center",
      textColor: [30, 27, 26],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: BRAND_AMBER,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: ROW_EVEN,
    },
    bodyStyles: {
      fillColor: ROW_ODD,
    },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 18 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24 },
      5: { cellWidth: 16, textColor: [22, 163, 74], fontStyle: "bold" }, // green ✓
    },
    // Paint header + footer on every page
    didDrawPage: (data) => {
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      paintHeader(doc, logoDataUrl, generatedAt, pageW);
      // Footer — total pages not known until after rendering; use placeholder
      // and replace in a post-render pass (see below).
      paintFooter(doc, currentPage, 0, pageW, pageH);
    },
  });

  // ── Post-render: fill in total page count ────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Whiteout the footer area then redraw with correct total
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageH - 14, pageW, 14, "F");
    paintFooter(doc, p, totalPages, pageW, pageH);
  }

  // Open the system print dialog with the PDF
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => {
      win.print();
      // Revoke after a short delay to allow the print dialog to open
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  } else {
    // Fallback: direct download
    const a = document.createElement("a");
    a.href = url;
    a.download = `mekapele-workshop-${Date.now()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}
