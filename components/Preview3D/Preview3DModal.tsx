"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import BookModel from "./BookModel";
import type { FoldingPattern } from "@/lib/types";

interface Preview3DModalProps {
  pattern: FoldingPattern;
  coverImageUrl: string | null;
  onClose: () => void;
}

/** Fullscreen modal hosting the interactive 3D book preview. */
export default function Preview3DModal({ pattern, coverImageUrl, onClose }: Preview3DModalProps) {
  const pageHeightCm = pattern.config.pageHeightCm;
  const radius = pageHeightCm * 1.4;
  const target: [number, number, number] = [0, 0, 0];
  const groundY = -pageHeightCm * 0.58;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(29,36,51,0.92)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-[var(--paper)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/mekapele-logo.png"
            alt="Lilou Books"
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
          סגירה ✕
        </button>
      </div>

      {/* 3D canvas */}
      <div className="relative flex-1">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [radius * 0.15, radius * 0.25, radius * 1.7], fov: 40 }}
        >
          <color attach="background" args={["#2a3142"]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[radius, radius * 1.5, radius]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-radius, radius * 0.5, -radius]} intensity={0.35} />

          <Suspense fallback={null}>
            <BookModel pattern={pattern} coverImageUrl={coverImageUrl} />
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

        <p className="pointer-events-none absolute bottom-3 right-3 text-xs text-[var(--paper)] opacity-70">
          גררו לסיבוב · גלגלת/צביטה לזום
        </p>
      </div>
    </div>
  );
}
