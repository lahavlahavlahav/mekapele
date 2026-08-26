"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { buildLeafShape, buildFlatLeafShape, orientLeaf } from "@/lib/book3d/leafGeometry";
import type { FoldingPattern, ReadingDirection } from "@/lib/types";

interface BookModelProps {
  pattern: FoldingPattern;
  coverImageUrl: string | null;
  /** Dihedral angle between front and back covers, in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
  /** Solid color for both covers when no cover image is set. */
  coverColor: string;
}

// Original fixed design used MAX_ANGLE=1.35 rad (~77deg) leaf half-spread and
// COVER_GUTTER=0.12 rad extra for the covers past the last leaf - together
// implying covers at a fixed ~168.5deg dihedral. LEAF_FRACTION preserves that
// same leaf/cover proportion while the actual dihedral becomes user-controlled.
const LEAF_FRACTION = 1.35 / (1.35 + 0.12);
const DEG2RAD = Math.PI / 180;
/** How far the endpaper sits between the outer leaf and the cover: 0 = at the leaf edge, 1 = flush with the cover. */
const ENDPAPER_GUTTER_FRACTION = 0.05;

// Pure white pages read as a clearly different material from the cover
// regardless of whatever color the cover is set to - the two must never blend together.
const PAGE_COLOR = "#ffffff";
/** Default cover color (gray, both cover panels) when the caller doesn't pass one - user-choosable via BookModel's coverColor prop. Must read as clearly darker than the white pages, not a near-white that blends into them. */
export const DEFAULT_COVER_COLOR = "#808080";
/** The base plinth is its own distinct wood-brown, not tied to the cover color. */
const STAND_COLOR = "#5c3317";
/**
 * The spine core's own fixed gray, independent of whatever coverColor the
 * user picks - it's almost entirely surrounded by pale pages rather than the
 * dark background the side covers sit against, so an identical gray value
 * can visually read lighter there by contrast alone. A dedicated, distinctly
 * gray tone keeps it unambiguous regardless of that effect or the chosen
 * cover color.
 */
const SPINE_COLOR = "#6b6b6b";

/**
 * Every real leaf gets its own angle, spread across the full fan
 * (-leafMaxAngle..leafMaxAngle). Leaf 0 (page 1) must land on the same
 * physical side the 2D algorithm already put it on: negative angle = left,
 * positive = right (see orientLeaf's depthDir.x sign). LTR keeps leaf 0 on
 * the left (natural order); RTL mirrors it to the right, matching
 * orderColumnsByDirection in lib/algorithm.ts so the 3D preview and the
 * generated pattern always agree on which side the book "starts."
 */
function useLeafAngles(leafCount: number, leafMaxAngle: number, direction: ReadingDirection) {
  return useMemo(() => {
    const angles: number[] = [];
    for (let i = 0; i < leafCount; i++) {
      const t = leafCount <= 1 ? 0.5 : i / (leafCount - 1);
      const signedT = direction === "RTL" ? 1 - t : t;
      angles.push(-leafMaxAngle + signedT * (2 * leafMaxAngle));
    }
    return angles;
  }, [leafCount, leafMaxAngle, direction]);
}

/**
 * Procedurally paints a small canvas with fine, irregular near-white vertical
 * streaks - card-stock fiber grain - so leaf faces read as paper rather than
 * flat plastic. Generated once (useMemo) and tiled down each leaf's height.
 */
function usePaperTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const h = 5 + Math.random() * 22;
      const shade = 195 + Math.floor(Math.random() * 35);
      ctx.strokeStyle = `rgba(${shade}, ${shade - 4}, ${shade - 14}, ${0.25 + Math.random() * 0.35})`;
      ctx.lineWidth = 0.5 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    // Canvas pixels are already sRGB - without this, three.js's color
    // management (r152+) treats them as linear and washes the grain out to
    // near-invisible.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 6);
    return texture;
  }, []);
}

/**
 * Composites the site's own logo (public/assets/mekapele-logo.png), centered,
 * onto a solid coverColor background - a branded back cover, the way a real
 * book stamps its publisher's mark on the back. Sized to the cover's own
 * (depth x pageHeight) aspect so the logo doesn't stretch. Async (image load),
 * so this starts out null and the caller should fall back to a plain color
 * material until it resolves.
 */
function useCoverLogoTexture(coverColor: string, aspect: number): THREE.CanvasTexture | null {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (typeof document === "undefined" || !Number.isFinite(aspect) || aspect <= 0) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = Math.max(1, Math.round(512 * aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = coverColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const logoAspect = img.width / img.height;
      const maxW = canvas.width * 0.5;
      const maxH = canvas.height * 0.3;
      let w = maxW;
      let h = w / logoAspect;
      if (h > maxH) {
        h = maxH;
        w = h * logoAspect;
      }
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    };
    img.src = "/assets/mekapele-logo.png";
    return () => {
      cancelled = true;
    };
  }, [coverColor, aspect]);

  return texture;
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
  const paperTexture = usePaperTexture();
  return (
    <>
      {geometries.map((geom, i) => (
        <Leaf key={i} geometry={geom} angle={angles[i]} pageHeightCm={pageHeightCm} color={color} texture={paperTexture} />
      ))}
    </>
  );
}

function Leaf({
  geometry,
  angle,
  pageHeightCm,
  color,
  texture,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  color: string;
  texture: THREE.CanvasTexture | null;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={color} map={texture} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Pure wrapper around orientLeaf: returns a quaternion + spine-centering position for a given fan angle. */
function orient(angle: number, pageHeightCm: number): { quaternion: THREE.Quaternion; position: THREE.Vector3 } {
  const dummy = new THREE.Object3D();
  orientLeaf(dummy, angle, pageHeightCm);
  return { quaternion: dummy.quaternion.clone(), position: dummy.position.clone() };
}

export default function BookModel({ pattern, coverImageUrl, openAngleDeg, coverColor }: BookModelProps) {
  const { config, pages } = pattern;
  const leafCount = pages.length;
  const pageHeightCm = config.pageHeightCm;
  const fullDepth = pageHeightCm * 0.62;
  // Was 0.16: folded-flat sections receded almost all the way to the spine,
  // so most of a page's height (everywhere it isn't actively marked) nearly
  // vanished into the spine core - the whole page needs to stay visually
  // present, with the marked band still reading as a clear further bulge.
  const foldedDepth = fullDepth * 0.34;
  const thickness = Math.max(0.03, (pageHeightCm * 0.4) / leafCount);

  const openAngleRad = THREE.MathUtils.clamp(openAngleDeg, 0, 180) * DEG2RAD;
  const coverHalfAngle = openAngleRad / 2;
  const leafMaxAngle = coverHalfAngle * LEAF_FRACTION;

  const angles = useLeafAngles(leafCount, leafMaxAngle, config.direction);

  const foldedGeometries = useMemo(
    () =>
      pages.map((page) => {
        const shape = buildLeafShape(page, { pageHeightCm, foldedDepth, fullDepth, mode: config.mode });
        return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      }),
    [pages, pageHeightCm, foldedDepth, fullDepth, thickness, config.mode]
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
  // Kept slim (real book spines are narrow relative to page depth) - just
  // enough to plug the wedge, not a thick drum.
  const spineRadius = Math.max(0.01, fullDepth * 0.22 * Math.sin(coverHalfAngle));

  // Footprint of the fanned block on the table (X = sideways spread, Z = forward reach).
  // Floored so the stand doesn't visually vanish as the book approaches fully closed.
  const standWidth = Math.max(
    pageHeightCm * 0.18,
    fullDepth * Math.sin(coverHalfAngle) * 2.1
  );
  const standDepth = fullDepth * 1.25;
  const standHeight = pageHeightCm * 0.05;

  // Back cover's shape is buildFlatLeafShape(pageHeightCm, fullDepth) - match
  // that aspect so the logo texture doesn't stretch on it.
  const logoTexture = useCoverLogoTexture(coverColor, pageHeightCm / fullDepth);

  return (
    <group>
      {/* Spine core: sits exactly on the fan's shared axis, so it's always
          hidden behind any leaf that actually reaches out, and only shows
          through the gap where a run of blank leaves stays folded flat. */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[spineRadius, spineRadius, pageHeightCm, 16]} />
        {/* Unlit on purpose: the whole cover must read as one flat, uniform
            color regardless of the scene's (asymmetric) lighting - a lit
            material always shades one side darker than the other. Its own
            fixed gray (not coverColor) - see SPINE_COLOR. */}
        <meshBasicMaterial color={SPINE_COLOR} />
      </mesh>

      {/* Every leaf is real, data-driven relief - spread across the full fan, nothing decorative. */}
      <LeafFan geometries={foldedGeometries} angles={angles} pageHeightCm={pageHeightCm} color={PAGE_COLOR} />

      {/* Endpapers hug the inner face of each cover - same color as the rest
          of the cover, so there is exactly one cover color throughout, no
          separate shade anywhere it could read as a mismatched seam. */}
      <Endpaper geometry={endpaperGeometry} angle={endpaperAngleBack} pageHeightCm={pageHeightCm} color={coverColor} />
      <Endpaper geometry={endpaperGeometry} angle={endpaperAngleFront} pageHeightCm={pageHeightCm} color={coverColor} />

      {/* Covers cap the fan on both ends. Back cover carries the brand logo. */}
      <BackCover
        geometry={coverGeometry}
        angle={coverAngleBack}
        pageHeightCm={pageHeightCm}
        color={coverColor}
        logoTexture={logoTexture}
      />
      <CoverWithArt
        geometry={coverGeometry}
        angle={coverAngleFront}
        pageHeightCm={pageHeightCm}
        imageUrl={coverImageUrl}
        color={coverColor}
      />

      {/* Flat wooden base plinth under the standing, fanned-open book - its
          own distinct dark brown, not tied to whatever the cover is set to. */}
      <mesh position={[0, -pageHeightCm / 2 - standHeight / 2, standDepth * 0.15]} castShadow receiveShadow>
        <boxGeometry args={[standWidth, standHeight, standDepth]} />
        <meshBasicMaterial color={STAND_COLOR} />
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
      {/* Unlit - see the spine's comment: this must stay the exact same flat
          color as the covers no matter which side the light favors. */}
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BackCover({
  geometry,
  angle,
  pageHeightCm,
  color,
  logoTexture,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  color: string;
  logoTexture: THREE.CanvasTexture | null;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      {/* Unlit - see the spine's comment. DoubleSide: viewed from behind the
          book (outside the back cover), the front-facing side is pointed
          away from the camera - without this the back face doesn't render
          as this same flat color. While the logo texture is still loading,
          falls back to the plain cover color (the texture's own canvas
          already paints that same color as its background once ready). */}
      <meshBasicMaterial
        color={logoTexture ? "#ffffff" : color}
        map={logoTexture}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CoverWithArt({
  geometry,
  angle,
  pageHeightCm,
  imageUrl,
  color,
}: {
  geometry: THREE.ExtrudeGeometry;
  angle: number;
  pageHeightCm: number;
  imageUrl: string | null;
  color: string;
}) {
  const { quaternion, position } = useMemo(() => orient(angle, pageHeightCm), [angle, pageHeightCm]);
  return (
    <mesh geometry={geometry} quaternion={quaternion} position={position} castShadow receiveShadow>
      {imageUrl ? (
        <CoverMaterial imageUrl={imageUrl} />
      ) : (
        // Unlit + DoubleSide - see BackCover's comment.
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

function CoverMaterial({ imageUrl }: { imageUrl: string }) {
  const texture = useTexture(imageUrl);
  return <meshStandardMaterial map={texture} roughness={0.6} metalness={0} />;
}
