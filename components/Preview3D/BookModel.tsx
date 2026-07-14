"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { buildLeafShape, buildFlatLeafShape, orientLeaf } from "@/lib/book3d/leafGeometry";
import type { FoldingPattern } from "@/lib/types";

interface BookModelProps {
  pattern: FoldingPattern;
  coverImageUrl: string | null;
}

const GUTTER = 0.06; // rad, small gap at the spine "valley" between the two halves
const MAX_ANGLE = 1.35; // rad (~77deg) - how far each half fans out
const COVER_GUTTER = 0.12; // extra angle for the covers past the last leaf

const PAGE_COLOR = "#efe4c8";
const COVER_COLOR = "#1d2433";
const STAND_COLOR = "#5c3a21";

function useLeafAngles(leafCount: number) {
  return useMemo(() => {
    const unfolded: number[] = [];
    const folded: number[] = [];
    for (let i = 0; i < leafCount; i++) {
      const t = leafCount <= 1 ? 0 : i / (leafCount - 1);
      unfolded.push(-GUTTER - t * (MAX_ANGLE - GUTTER));
      folded.push(GUTTER + t * (MAX_ANGLE - GUTTER));
    }
    return { unfolded, folded };
  }, [leafCount]);
}

/** One fanned half of the book: `count` leaves, each oriented at its own angle. */
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

export default function BookModel({ pattern, coverImageUrl }: BookModelProps) {
  const { config, pages } = pattern;
  const leafCount = pages.length;
  const pageHeightCm = config.pageHeightCm;
  const fullDepth = pageHeightCm * 0.62;
  const foldedDepth = fullDepth * 0.16;
  const thickness = Math.max(0.03, (pageHeightCm * 0.4) / leafCount);

  const { unfolded, folded } = useLeafAngles(leafCount);

  const foldedGeometries = useMemo(
    () =>
      pages.map((page) => {
        const shape = buildLeafShape(page, { pageHeightCm, foldedDepth, fullDepth });
        return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      }),
    [pages, pageHeightCm, foldedDepth, fullDepth, thickness]
  );

  const unfoldedGeometries = useMemo(() => {
    const shape = buildFlatLeafShape(pageHeightCm, fullDepth);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    return Array.from({ length: leafCount }, () => geom);
  }, [pageHeightCm, fullDepth, thickness, leafCount]);

  const coverAngleBack = -(MAX_ANGLE + COVER_GUTTER);
  const coverAngleFront = MAX_ANGLE + COVER_GUTTER;
  const coverThickness = thickness * 4;

  const coverGeometry = useMemo(() => {
    const shape = buildFlatLeafShape(pageHeightCm, fullDepth);
    return new THREE.ExtrudeGeometry(shape, { depth: coverThickness, bevelEnabled: false });
  }, [pageHeightCm, fullDepth, coverThickness]);

  return (
    <group>
      {/* Decorative unfolded half (open pages, no pattern data). */}
      <LeafFan geometries={unfoldedGeometries} angles={unfolded} pageHeightCm={pageHeightCm} color={PAGE_COLOR} />

      {/* The patterned half - this is the real data-driven relief. */}
      <LeafFan geometries={foldedGeometries} angles={folded} pageHeightCm={pageHeightCm} color={PAGE_COLOR} />

      {/* Covers */}
      <BackCover geometry={coverGeometry} angle={coverAngleBack} pageHeightCm={pageHeightCm} />
      <CoverWithArt
        geometry={coverGeometry}
        angle={coverAngleFront}
        pageHeightCm={pageHeightCm}
        imageUrl={coverImageUrl}
      />

      {/* Simple crossed wooden stand beneath the spine. */}
      <group position={[0, -fullDepth * 0.55, 0]}>
        <mesh rotation={[0, 0, Math.PI / 5]} castShadow receiveShadow>
          <boxGeometry args={[pageHeightCm * 1.05, fullDepth * 0.09, fullDepth * 0.14]} />
          <meshStandardMaterial color={STAND_COLOR} roughness={0.7} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 5]} castShadow receiveShadow>
          <boxGeometry args={[pageHeightCm * 1.05, fullDepth * 0.09, fullDepth * 0.14]} />
          <meshStandardMaterial color={STAND_COLOR} roughness={0.7} />
        </mesh>
      </group>
    </group>
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
