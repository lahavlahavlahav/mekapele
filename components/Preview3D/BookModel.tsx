"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { buildLeafShape, buildFlatLeafShape, orientLeaf } from "@/lib/book3d/leafGeometry";
import type { FoldingPattern } from "@/lib/types";

interface BookModelProps {
  pattern: FoldingPattern;
  coverImageUrl: string | null;
  /** Dihedral angle between front and back covers, in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
}

// Original fixed design used MAX_ANGLE=1.35 rad (~77deg) leaf half-spread and
// COVER_GUTTER=0.12 rad extra for the covers past the last leaf - together
// implying covers at a fixed ~168.5deg dihedral. LEAF_FRACTION preserves that
// same leaf/cover proportion while the actual dihedral becomes user-controlled.
const LEAF_FRACTION = 1.35 / (1.35 + 0.12);
const DEG2RAD = Math.PI / 180;
/** How far the endpaper sits between the outer leaf and the cover: 0 = at the leaf edge, 1 = flush with the cover. */
const ENDPAPER_GUTTER_FRACTION = 0.35;

const PAGE_COLOR = "#efe4c8";
const COVER_COLOR = "#1d2433";
const ENDPAPER_COLOR = "#d8c19a";
const STAND_COLOR = "#5c3a21";

/** Every real leaf gets its own angle, spread across the full fan (-leafMaxAngle..leafMaxAngle). */
function useLeafAngles(leafCount: number, leafMaxAngle: number) {
  return useMemo(() => {
    const angles: number[] = [];
    for (let i = 0; i < leafCount; i++) {
      const t = leafCount <= 1 ? 0.5 : i / (leafCount - 1);
      angles.push(-leafMaxAngle + t * (2 * leafMaxAngle));
    }
    return angles;
  }, [leafCount, leafMaxAngle]);
}

function LeafFan({
  geometries,
  angles,
  pageHeightCm,
  color,
}: {
  geometries: THREE.ExtrudeGeometry[];
  angles: number[];
  pageHeightCm: number;
  color: string;
}) {
  return (
    <>
      {geometries.map((geom, i) => (
        <Leaf key={i} geometry={geom} angle={angles[i]} pageHeightCm={pageHeightCm} color={color} />
      ))}
    </>
  );
}

function Leaf({
  geometry,
  angle,
  pageHeightCm,
  color,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  color: string;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Pure wrapper around orientLeaf: returns a quaternion + spine-centering position for a given fan angle. */
function orient(angle: number, pageHeightCm: number): { quaternion: THREE.Quaternion; position: THREE.Vector3 } {
  const dummy = new THREE.Object3D();
  orientLeaf(dummy, angle, pageHeightCm);
  return { quaternion: dummy.quaternion.clone(), position: dummy.position.clone() };
}

export default function BookModel({ pattern, coverImageUrl, openAngleDeg }: BookModelProps) {
  const { config, pages } = pattern;
  const leafCount = pages.length;
  const pageHeightCm = config.pageHeightCm;
  const fullDepth = pageHeightCm * 0.62;
  const foldedDepth = fullDepth * 0.16;
  const thickness = Math.max(0.03, (pageHeightCm * 0.4) / leafCount);

  const openAngleRad = THREE.MathUtils.clamp(openAngleDeg, 0, 180) * DEG2RAD;
  const coverHalfAngle = openAngleRad / 2;
  const leafMaxAngle = coverHalfAngle * LEAF_FRACTION;

  const angles = useLeafAngles(leafCount, leafMaxAngle);

  const foldedGeometries = useMemo(
    () =>
      pages.map((page) => {
        const shape = buildLeafShape(page, { pageHeightCm, foldedDepth, fullDepth });
        return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      }),
    [pages, pageHeightCm, foldedDepth, fullDepth, thickness]
  );

  const coverAngleBack = -coverHalfAngle;
  const coverAngleFront = coverHalfAngle;
  const coverThickness = thickness * 4;

  const coverGeometry = useMemo(() => {
    const shape = buildFlatLeafShape(pageHeightCm, fullDepth);
    return new THREE.ExtrudeGeometry(shape, { depth: coverThickness, bevelEnabled: false });
  }, [pageHeightCm, fullDepth, coverThickness]);

  const endpaperGeometry = useMemo(() => {
    const shape = buildFlatLeafShape(pageHeightCm, fullDepth);
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  }, [pageHeightCm, fullDepth, thickness]);

  const endpaperHalfAngle =
    coverHalfAngle - (coverHalfAngle - leafMaxAngle) * ENDPAPER_GUTTER_FRACTION;
  const endpaperAngleBack = -endpaperHalfAngle;
  const endpaperAngleFront = endpaperHalfAngle;

  // Blank (or partly-blank) leaves recede close to the spine at the heights
  // they have no mark, opening a wedge-shaped gap between neighboring leaves
  // fanned at different angles - wide enough, at typical opening angles, to
  // show raw canvas background straight through. A spine core fills that
  // gap with something that reads as the book's actual binding, the way a
  // real fanned book shows its spine through the gaps between splayed pages.
  // Sized proportionally to sin(coverHalfAngle): the wedge gap between two
  // leaves at a given depth grows with their angular separation, and must
  // shrink to ~0 as the book approaches fully closed (angle 0), where leaves
  // are nearly parallel and there is no real gap to fill - a fixed radius
  // stayed oversized at small angles and stuck out past the closed book.
  const spineRadius = Math.max(0.015, fullDepth * 0.5 * Math.sin(coverHalfAngle));

  // Footprint of the fanned block on the table (X = sideways spread, Z = forward reach).
  // Floored so the stand doesn't visually vanish as the book approaches fully closed.
  const standWidth = Math.max(
    pageHeightCm * 0.18,
    fullDepth * Math.sin(coverHalfAngle) * 2.1
  );
  const standDepth = fullDepth * 1.25;
  const standHeight = pageHeightCm * 0.05;

  return (
    <group>
      {/* Spine core: sits exactly on the fan's shared axis, so it's always
          hidden behind any leaf that actually reaches out, and only shows
          through the gap where a run of blank leaves stays folded flat. */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[spineRadius, spineRadius, pageHeightCm, 16]} />
        <meshStandardMaterial color={COVER_COLOR} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Every leaf is real, data-driven relief - spread across the full fan, nothing decorative. */}
      <LeafFan geometries={foldedGeometries} angles={angles} pageHeightCm={pageHeightCm} color={PAGE_COLOR} />

      {/* Endpapers hug the inner face of each cover for a more finished, realistic look. */}
      <Endpaper geometry={endpaperGeometry} angle={endpaperAngleBack} pageHeightCm={pageHeightCm} color={ENDPAPER_COLOR} />
      <Endpaper geometry={endpaperGeometry} angle={endpaperAngleFront} pageHeightCm={pageHeightCm} color={ENDPAPER_COLOR} />

      {/* Covers cap the fan on both ends. */}
      <BackCover geometry={coverGeometry} angle={coverAngleBack} pageHeightCm={pageHeightCm} />
      <CoverWithArt
        geometry={coverGeometry}
        angle={coverAngleFront}
        pageHeightCm={pageHeightCm}
        imageUrl={coverImageUrl}
      />

      {/* Flat wooden base plinth under the standing, fanned-open book. */}
      <mesh position={[0, -pageHeightCm / 2 - standHeight / 2, standDepth * 0.15]} castShadow receiveShadow>
        <boxGeometry args={[standWidth, standHeight, standDepth]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Endpaper({
  geometry,
  angle,
  pageHeightCm,
  color,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  color: string;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.7} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BackCover({
  geometry,
  angle,
  pageHeightCm,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={COVER_COLOR} roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

function CoverWithArt({
  geometry,
  angle,
  pageHeightCm,
  imageUrl,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  imageUrl: string | null;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      {imageUrl ? (
        <CoverMaterial imageUrl={imageUrl} />
      ) : (
        <meshStandardMaterial color={COVER_COLOR} roughness={0.5} metalness={0.1} />
      )}
    </mesh>
  );
}

function CoverMaterial({ imageUrl }: { imageUrl: string }) {
  const texture = useTexture(imageUrl);
  return <meshStandardMaterial map={texture} roughness={0.6} metalness={0} />;
}
