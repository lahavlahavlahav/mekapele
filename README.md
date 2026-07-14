# Lilou Books — Book Folding Pattern Generator

Turns a binary/grayscale image into a fold-by-fold book-folding pattern.
Two output modes: **Print-Ready Export** (branded PDF/print table) and
**Interactive Digital Tracker** (mobile workshop companion).

## Stack
- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS v4**
- **Zustand** with LocalStorage persistence (no login; sessions resume exactly)
- **Client-side Canvas API** for exact, offline, server-free pixel processing

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # production
```

Replace `public/assets/mekapele-logo.png` with the real brand logo
(a placeholder is included at the path the PRD specifies).

## Architecture
- `lib/algorithm.ts` — **pure core**: width slicing, LTR/RTL page→slice
  mapping, MMF + Cut&Fold vertical scan, Min-Tab gap filtering, pixel→cm
  (rounded to 1 decimal). No DOM — fully unit-testable.
- `lib/imageProcessor.ts` — Canvas luminance extraction + thumbnail.
- `lib/store.ts` — Zustand store + `persist` middleware (LocalStorage).
- `components/ConfigPanel.tsx` — upload + parameters.
- `components/PrintExport.tsx` — Mode 1, branded measurement table.
- `components/tracker/*` — Mode 2: WorkshopTracker shell, FocusCard
  (large-type), ProgressBar (gamification), ImagePreview (slice-fill feedback).

## Algorithm notes
- Leaves = `floor((lastPage - firstPage) / 2) + 1`; image width split into
  that many equal columns, one column per leaf (no separate resolution
  search - each leaf reads its own native column 1:1).
- **LTR:** page 1 = left-most column. **RTL:** page 1 = right-most column.
- Each slice collapses to its darkest column so thin features survive.
- **MMF:** a column's single black run becomes its [top, bottom] mark pair.
  If a column has multiple disconnected runs, the leaf rotates through them
  (`segments[leafIndex % segments.length]`) instead of always showing the
  same one and dropping the rest - calibrated against reference output but
  a best-effort heuristic for that case (see ALGORITHM_NOTES.md).
- **Cut & Fold:** every black/white toggle as cut pairs; black runs thinner
  than Min Tab Size are dropped.
- The image renders at `verticalSpacingCm` tall (native aspect ratio, never
  stretched) and is centered within `pageHeightCm` - matching how reference
  book-folding tools ("Vertical Spacing" in Wunderfold) lay out the pattern:
  `scale = verticalSpacingCm / imageHeightPx`,
  `cm = (pageHeightCm - verticalSpacingCm) / 2 + pixelY * scale`,
  rounded to `precisionMm` (default 1mm / 0.1cm).
- **Crop sides** (`cropSides`, default on): trims empty white columns off the
  left/right edges before slicing into leaves, so no leaves are wasted on
  blank margins.
- **Auto threshold** (`autoThreshold`, default on): computes the black/white
  cutoff per image via Otsu's method instead of a fixed luminance value -
  handles scans that are lighter/darker than a clean black-on-white
  silhouette.
- **Precision** (`precisionMm`): rounding granularity for output
  measurements - Low (1mm) / Medium (0.5mm) / High (0.1mm).
