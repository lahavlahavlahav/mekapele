/**
 * BookPreview3D.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a virtual folded book using React-Three-Fiber.
 *
 * Visual model:
 *   • The book spine is a thin rectangular solid on the left.
 *   • Each page (leaf) is a thin BoxGeometry. Pages that carry a fold mark
 *     are rotated slightly and offset so their outer edges form the silhouette
 *     of the folded shape.
 *   • The fold silhouette is derived from the FoldRow data: for each page we
 *     compute the "depth" the fold pushes the page edge back by mapping the
 *     mark's vertical midpoint to a radial offset.
 *
 * Controls: OrbitControls (rotate, zoom, pan).
 *
 * Dependencies (add to package.json):
 *   "@react-three/fiber": "^9"
 *   "@react-three/drei": "^10"
 *   "three": "^0.175"
 *
 * Why no SSR?  Three.js accesses the DOM and WebGL at import time; the
 * component is guarded with a dynamic import (no SSR) in MainControl.tsx.
 */

"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useDualViewStore, FoldRow } from "@/lib/dualViewStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_H = 3;        // book height in 3-D units
const PAGE_DEPTH = 0.02; // page thickness
const SPINE_W = 0.15;    // spine width
const MAX_PAGES = 300;   // cap for performance

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * From all fold rows for one page, derive the fractional vertical centre of
 * the mark (0 = top, 1 = bottom). Used to compute a perceptual "depth push".
 */
function markCentre(rowsForPage: FoldRow[], pageHeightCm: number): number {
  if (!rowsForPage.length) return 0.5;
  const avg =
    rowsForPage.reduce((s, r) => s + (r.startCm + r.endCm) / 2, 0) /
    rowsForPage.length;
  return Math.min(Math.max(avg / pageHeightCm, 0), 1);
}

// ── FoldedPage ────────────────────────────────────────────────────────────────

interface FoldedPageProps {
  index: number;          // 0-based
  totalPages: number;
  depthOffset: number;    // 0..1 — how far the edge is pushed "in"
  completed: boolean;
  pageH: number;
}

function FoldedPage({
  index,
  totalPages,
  depthOffset,
  completed,
  pageH,
}: FoldedPageProps) {
  const ref = useRef<THREE.Mesh>(null);

  // Spread pages like a fan: slight rotation around Y
  const spreadAngle = (index / Math.max(totalPages - 1, 1)) * Math.PI * 0.45;
  const pageWidth = 1.6; // width of a single page leaf

  // The "folded edge" creates a silhouette by rotating + pushing the tip in.
  // Rotation around the spine axis (Y) spreads pages; the depthOffset shifts
  // the page tip along Z to simulate folding depth.
  const tipZ = -depthOffset * 0.6; // max 0.6 units of depth push

  const color = completed
    ? new THREE.Color("#f59e0b") // amber-400 — done pages
    : new THREE.Color("#e7e5e4"); // stone-200 — pending

  return (
    <group rotation={[0, -spreadAngle, 0]} position={[SPINE_W / 2, 0, 0]}>
      {/* The page leaf — anchored at the spine edge (left), tip goes right */}
      <mesh
        ref={ref}
        position={[pageWidth / 2, 0, tipZ * (index / totalPages)]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[pageWidth, pageH, PAGE_DEPTH]} />
        <meshStandardMaterial
          color={color}
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Spine ─────────────────────────────────────────────────────────────────────

function Spine({ height }: { height: number }) {
  return (
    <mesh position={[0, 0, 0]} castShadow>
      <boxGeometry args={[SPINE_W, height, 0.6]} />
      <meshStandardMaterial color="#292524" roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

// ── SlowRotate — ambient auto-rotation hint ───────────────────────────────────

function SlowRotate({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.15;
  });
  return <group ref={ref}>{children}</group>;
}

// ── BookScene ─────────────────────────────────────────────────────────────────

function BookScene() {
  const rows = useDualViewStore((s) => s.rows);
  const completedPages = useDualViewStore((s) => s.completedPages);
  const pageHeightCm = useDualViewStore((s) => s.pageHeightCm);

  // Group rows by page number, cap total pages for perf.
  const pageMap = useMemo(() => {
    const m = new Map<number, FoldRow[]>();
    for (const r of rows) {
      if (!m.has(r.page)) m.set(r.page, []);
      m.get(r.page)!.push(r);
    }
    return m;
  }, [rows]);

  const pages = useMemo(
    () => [...pageMap.keys()].sort((a, b) => a - b).slice(0, MAX_PAGES),
    [pageMap]
  );

  const total = pages.length || 1;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-4, 2, -2]} intensity={0.4} color="#fef3c7" />

      <SlowRotate>
        <group position={[-SPINE_W / 2, 0, 0]}>
          <Spine height={PAGE_H} />
          {pages.map((page, i) => {
            const rowsForPage = pageMap.get(page) ?? [];
            const centre = markCentre(rowsForPage, pageHeightCm);
            // Map mark position to depth: marks near the top/bottom create more depth.
            const depthOffset = 0.5 + Math.abs(centre - 0.5);
            return (
              <FoldedPage
                key={page}
                index={i}
                totalPages={total}
                depthOffset={depthOffset}
                completed={completedPages.has(page)}
                pageH={PAGE_H}
              />
            );
          })}
        </group>
      </SlowRotate>

      <Environment preset="studio" />
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyBook() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 3]} intensity={1} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, PAGE_H, 0.6]} />
        <meshStandardMaterial color="#292524" roughness={0.6} />
      </mesh>
      <mesh position={[0.9, 0, -0.05]}>
        <boxGeometry args={[1.6, PAGE_H, 0.02]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.85} />
      </mesh>
      <Environment preset="studio" />
    </>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 text-xs text-stone-400 select-none pointer-events-none">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
        סמן כהושלם
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-stone-200" />
        ממתין לקיפול
      </span>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export default function BookPreview3D() {
  const rows = useDualViewStore((s) => s.rows);
  const hasData = rows.length > 0;

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden bg-stone-950">
      {/* Header */}
      <div className="absolute top-4 right-0 left-0 text-center z-10 pointer-events-none">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
          תצוגה מקדימה תלת-ממדית
        </p>
        {hasData && (
          <p className="text-stone-600 text-[11px] mt-0.5">
            {rows.length} סימנים • גרור לסיבוב • גלגל לזום
          </p>
        )}
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 1.5, 6], fov: 40 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "transparent" }}
      >
        {hasData ? <BookScene /> : <EmptyBook />}
        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
        />
      </Canvas>

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-stone-600 text-sm text-center px-8">
            העלה תמונה וצור תבנית כדי לראות את הספר
          </p>
        </div>
      )}

      <Legend />
    </div>
  );
}
