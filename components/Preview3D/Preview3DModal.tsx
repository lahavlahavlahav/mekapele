"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import BookModel, { DEFAULT_COVER_COLOR } from "./BookModel";
import { CUT_FOLD_RECESS_CM, MAX_RECESS_FRACTION } from "@/lib/book3d/leafGeometry";
import type { FoldingPattern } from "@/lib/types";

interface Preview3DModalProps {
  pattern: FoldingPattern;
  coverImageUrl: string | null;
  onClose: () => void;
}

/** The preview always opens at 90deg, for every technique (owner's choice). */
const DEFAULT_OPEN_ANGLE = 90;

/** Fullscreen modal hosting the interactive 3D book preview. */
export default function Preview3DModal({ pattern, coverImageUrl, onClose }: Preview3DModalProps) {
  // Always opens at 90deg; the slider still goes from 0 (closed) to 180 (flat open).
  const [openAngleDeg, setOpenAngleDeg] = useState(DEFAULT_OPEN_ANGLE);
  // Only visible when no cover image is set - an uploaded cover always wins.
  const [coverColor, setCoverColor] = useState(DEFAULT_COVER_COLOR);
  const pageHeightCm = pattern.config.pageHeightCm;
  // Cut & Fold: let the user play with how deep the cuts go (preview only - the
  // pattern's marks don't depend on it). Page depth matches BookModel's fullDepth.
  const isCutFold = pattern.config.mode === "CUT_AND_FOLD";
  const maxCutDepth = Math.max(1, Math.floor(pageHeightCm * 0.62 * MAX_RECESS_FRACTION * 10) / 10);
  const [cutDepthCm, setCutDepthCm] = useState(Math.min(CUT_FOLD_RECESS_CM, maxCutDepth));
  const radius = pageHeightCm * 1.4;
  const target: [number, number, number] = [0, 0, 0];
  const groundY = -pageHeightCm * 0.58;

  // Escape as a second way out, in addition to the close button below -
  // this is a fullscreen fixed-position overlay, so the browser's own back/
  // close affordances don't apply to it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(29,36,51,0.92)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-[var(--paper)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/mekapele-logo.png"
            alt="מקפלא - מחולל תבניות לפיסול ספרים"
            className="h-7 w-auto opacity-90"
            style={{ filter: "invert(1)" }}
          />
          <span className="text-sm font-semibold hidden sm:inline">תצוגה מקדימה בתלת-ממד</span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--coral)", color: "#fff" }}
        >
          → חזרה
        </button>
      </div>

      {/* 3D canvas */}
      <div className="relative flex-1">
        <Canvas
          shadows
          dpr={[1, 2]}
          // 0.77x radius (a previous tightening) opened right on top of the
          // book, confusing on first load since the whole object didn't fit
          // without the user manually zooming out. ~1.6x (wider fans now) is a middle ground:
          // close enough that the page-fan still reads as the subject, but
          // the whole book (covers + base) is visible by default.
          camera={{ position: [radius * 0.1, radius * 0.12, radius * 1.6], fov: 40 }}
        >
          <color attach="background" args={["#2a3142"]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[radius, radius * 1.5, radius]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-radius}
            shadow-camera-right={radius}
            shadow-camera-top={radius}
            shadow-camera-bottom={-radius}
            shadow-camera-far={radius * 6}
          />
          <directionalLight position={[-radius, radius * 0.5, -radius]} intensity={0.35} />
          {/* Soft front fill: folded relief faces partly downward, which the
              key light above leaves too dark without it. */}
          <directionalLight position={[-radius * 0.4, -radius * 0.2, radius * 2]} intensity={0.3} />

          <Suspense fallback={null}>
            <BookModel
              pattern={pattern}
              coverImageUrl={coverImageUrl}
              openAngleDeg={openAngleDeg}
              coverColor={coverColor}
              cutDepthCm={isCutFold ? cutDepthCm : undefined}
            />
          </Suspense>

          <ContactShadows
            position={[0, groundY, 0]}
            opacity={0.35}
            scale={radius * 1.6}
            blur={2.5}
            far={pageHeightCm * 0.6}
          />

          <OrbitControls
            enablePan={false}
            target={target}
            minDistance={radius * 0.6}
            maxDistance={radius * 2.5}
            minPolarAngle={Math.PI * 0.15}
            maxPolarAngle={Math.PI * 0.85}
          />
        </Canvas>

        {/* Watermark */}
        <div className="pointer-events-none absolute bottom-3 left-3 opacity-85">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/mekapele-logo.png"
            alt=""
            className="h-6 w-auto sm:h-8"
            style={{ filter: "invert(1)" }}
          />
        </div>

        <p className={`pointer-events-none absolute ${isCutFold ? "bottom-[7.5rem]" : "bottom-16"} right-3 text-xs text-[var(--paper)] opacity-70`}>
          גררו לסיבוב · גלגלת/צביטה לזום
        </p>

        {/* Cover color picker - irrelevant once a real cover image is set, so hidden then. */}
        {!coverImageUrl && (
          <label
            className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
            style={{ background: "rgba(29,36,51,0.7)" }}
          >
            <span className="text-xs text-[var(--paper)] whitespace-nowrap">צבע הכריכה</span>
            <input
              type="color"
              value={coverColor}
              onChange={(e) => setCoverColor(e.target.value)}
              className="h-6 w-9 rounded border-0 bg-transparent cursor-pointer"
            />
          </label>
        )}

        {/* Cut & Fold depth control - preview only, shown just for that technique. */}
        {isCutFold && (
          <div
            className="absolute bottom-[4.25rem] left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{ background: "rgba(29,36,51,0.7)" }}
          >
            <span className="text-xs text-[var(--paper)] whitespace-nowrap">עומק הגזירה</span>
            <input
              type="range"
              min={0.5}
              max={maxCutDepth}
              step={0.1}
              value={cutDepthCm}
              onChange={(e) => setCutDepthCm(Number(e.target.value))}
              className="w-32 sm:w-40"
              aria-label="עומק הגזירה בסנטימטרים"
            />
            <span className="text-xs text-[var(--paper)] tabular w-14 text-left">{cutDepthCm.toFixed(1)} ס״מ</span>
          </div>
        )}

        {/* Opening-angle control: 0deg (closed) .. 180deg (flat open), default 90deg. */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ background: "rgba(29,36,51,0.7)" }}
        >
          <span className="text-xs text-[var(--paper)] whitespace-nowrap">זווית פתיחה</span>
          <input
            type="range"
            min={0}
            max={180}
            step={1}
            value={openAngleDeg}
            onChange={(e) => setOpenAngleDeg(Number(e.target.value))}
            className="w-32 sm:w-40"
          />
          <span className="text-xs text-[var(--paper)] tabular w-10 text-left">{openAngleDeg}°</span>
        </div>
      </div>
    </div>
  );
}
