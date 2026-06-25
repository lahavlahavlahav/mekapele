"use client";
// =============================================================================
// components/BookPreview3D.tsx
// -----------------------------------------------------------------------------
// Interactive 3-D book preview built with React-Three-Fiber + Drei.
//
// DEPENDENCIES (add to package.json):
//   npm install three @react-three/fiber @react-three/drei
//   npm install -D @types/three
//
// What it renders:
//   • A closed book spine (grey box) + fanned page stack.
//   • For every FoldRow from the store, a thin wedge/page is displaced along
//     the Y-axis according to its fold measurements — building the silhouette.
//   • OrbitControls for rotate/zoom/pan. A subtle ambient + directional light.
//   • An info overlay showing total pages and completion %.
// =============================================================================

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from "three";
import { useViewStore } from "@/lib/viewStore";

// ── Constants ─────────────────────────────────────────────────────────────────
const BOOK_DEPTH = 0.08;        // thickness of each page leaf (world units)
const PAGE_HEIGHT = 4;           // book height (world units)
const PAGE_WIDTH = 2.8;          // book width (world units)
const SPINE_WIDTH = 0.3;         // spine extrusion

// Map a fold `from/to` measurement (cm, 0–pageHeightCm) to a local Y offset
// in world units, centred at 0.
function cmToLocal(cm: number, pageHeightCm: number): number {
  return (cm / pageHeightCm) * PAGE_HEIGHT - PAGE_HEIGHT / 2;
}

// ── Single folded page ────────────────────────────────────────────────────────
interface PageMeshProps {
  index: number;
  total: number;
  fromY: number;   // local Y of fold start
  toY: number;     // local Y of fold end
  completed: boolean;
}

function PageMesh({ index, total, fromY, toY, completed }: PageMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const foldHeight = Math.max(0.01, Math.abs(toY - fromY));
  const midY = (fromY + toY) / 2;

  // Fan the pages outward from the spine along the Z axis.
  const spread = (index / Math.max(total - 1, 1)) - 0.5;  // -0.5 → +0.5
  const zPos = spread * (total * BOOK_DEPTH * 1.1);

  // Subtle rotation to simulate fold angle — pages near edges tilt more.
  const tiltX = spread * 0.25;

  // Breathing animation for the active (not-yet-completed) page.
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (!completed) {
      meshRef.current.material.opacity =
        0.75 + 0.2 * Math.sin(clock.getElapsedTime() * 2 + index);
    } else {
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = 0.55;
    }
  });

  const color = completed ? "#6EE7B7" : "#FCD34D";   // emerald done / amber pending

  return (
    <mesh
      ref={meshRef}
      position={[0, midY, zPos]}
      rotation={[tiltX, 0, 0]}
    >
      <boxGeometry args={[PAGE_WIDTH, foldHeight, BOOK_DEPTH]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.75}
        roughness={0.6}
        metalness={0.05}
      />
    </mesh>
  );
}

// ── Spine box ─────────────────────────────────────────────────────────────────
function Spine({ pageCount }: { pageCount: number }) {
  const thickness = Math.max(0.5, pageCount * BOOK_DEPTH * 0.6);
  return (
    <mesh position={[-PAGE_WIDTH / 2 - SPINE_WIDTH / 2, 0, 0]}>
      <boxGeometry args={[SPINE_WIDTH, PAGE_HEIGHT + 0.05, thickness]} />
      <meshStandardMaterial color="#1e293b" roughness={0.85} />
    </mesh>
  );
}

// ── Book cover (front + back) ─────────────────────────────────────────────────
function Covers({ pageCount }: { pageCount: number }) {
  const halfThick = Math.max(0.25, pageCount * BOOK_DEPTH * 0.3);
  return (
    <>
      {/* front cover */}
      <mesh position={[0, 0, halfThick + BOOK_DEPTH]}>
        <boxGeometry args={[PAGE_WIDTH + 0.1, PAGE_HEIGHT + 0.1, 0.06]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      {/* back cover */}
      <mesh position={[0, 0, -halfThick - BOOK_DEPTH]}>
        <boxGeometry args={[PAGE_WIDTH + 0.1, PAGE_HEIGHT + 0.1, 0.06]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
    </>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
// Assumed page height in cm for the coordinate mapping.
const DEFAULT_PAGE_HEIGHT_CM = 24;

function BookScene() {
  const rows = useViewStore((s) => s.rows);
  const completed = useViewStore((s) => s.completed);

  const pages = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.map((r, i) => ({
      index: i,
      total: rows.length,
      fromY: cmToLocal(r.from, DEFAULT_PAGE_HEIGHT_CM),
      toY: cmToLocal(r.to, DEFAULT_PAGE_HEIGHT_CM),
      completed: !!completed[r.page],
    }));
  }, [rows, completed]);

  // Empty state — render a plain closed book silhouette.
  const isEmpty = pages.length === 0;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-4, -3, -2]} intensity={0.3} color="#6366f1" />

      {/* Environment for subtle reflections */}
      <Environment preset="city" />

      {/* Book geometry */}
      <group>
        <Spine pageCount={isEmpty ? 120 : rows.length} />
        <Covers pageCount={isEmpty ? 120 : rows.length} />

        {isEmpty ? (
          /* Placeholder page stack */
          Array.from({ length: 12 }).map((_, i) => (
            <mesh
              key={i}
              position={[0, 0, ((i / 11) - 0.5) * 1.2]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[PAGE_WIDTH, PAGE_HEIGHT, BOOK_DEPTH]} />
              <meshStandardMaterial color="#e2e8f0" opacity={0.4} transparent roughness={0.9} />
            </mesh>
          ))
        ) : (
          pages.map((p) => (
            <PageMesh key={p.index} {...p} />
          ))
        )}

        {/* "No pattern" label */}
        {isEmpty && (
          <Text
            position={[0, 0, 0.7]}
            fontSize={0.22}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            Generate a pattern first
          </Text>
        )}
      </group>

      <OrbitControls
        enablePan
        enableZoom
        minDistance={3}
        maxDistance={18}
        autoRotate={isEmpty}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

// ── HUD overlay ───────────────────────────────────────────────────────────────
function HUD() {
  const rows = useViewStore((s) => s.rows);
  const pct = useViewStore((s) => s.progressPct());

  if (rows.length === 0) return null;
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-4 text-xs text-slate-300 bg-slate-800/70 backdrop-blur px-5 py-2.5 rounded-full border border-slate-700 pointer-events-none select-none">
      <span><span className="text-amber-400 font-bold">{rows.length}</span> pages</span>
      <span className="text-slate-600">|</span>
      <span><span className="text-emerald-400 font-bold">{pct}%</span> folded</span>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 text-xs text-slate-400 bg-slate-800/70 backdrop-blur px-3 py-2.5 rounded-xl border border-slate-700 pointer-events-none select-none">
      <span className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 opacity-80" />
        Pending
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400 opacity-80" />
        Completed
      </span>
      <span className="mt-1 text-slate-500 text-[10px] leading-tight">
        Drag to rotate · Scroll to zoom
      </span>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function BookPreview3D() {
  return (
    <div className="relative w-full h-full min-h-[calc(100vh-56px)] bg-slate-900">
      <Canvas
        shadows
        camera={{ position: [0, 1, 9], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "transparent" }}
      >
        <BookScene />
      </Canvas>

      <HUD />
      <Legend />
    </div>
  );
}
