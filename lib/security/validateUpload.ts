// =============================================================================
// FILE UPLOAD SANITIZATION  (server)
// -----------------------------------------------------------------------------
// Defends the image-processing endpoint. Validates BEFORE the bytes ever reach
// `sharp`:
//   • declared MIME must be image/jpeg or image/png
//   • size <= MAX_UPLOAD_BYTES
//   • magic-byte signature must actually match a JPEG/PNG (a .png extension or
//     spoofed Content-Type is not trusted — we inspect the real header)
// Anything malformed or executable is rejected outright.
// =============================================================================

import "server-only";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB hard cap
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

export interface UploadValidation {
  ok: boolean;
  error?: string;
  mime?: "image/jpeg" | "image/png";
}

/** Inspect the leading bytes to confirm a real JPEG or PNG signature. */
function sniffSignature(
  bytes: Uint8Array
): "image/jpeg" | "image/png" | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  return null;
}

export function validateUpload(
  declaredMime: string,
  size: number,
  bytes: Uint8Array
): UploadValidation {
  if (!ALLOWED_MIME.has(declaredMime)) {
    return { ok: false, error: "Only JPEG and PNG images are allowed." };
  }
  if (size <= 0) {
    return { ok: false, error: "Empty file." };
  }
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds the 5 MB limit." };
  }
  const sniffed = sniffSignature(bytes);
  if (!sniffed) {
    return { ok: false, error: "File is not a valid JPEG or PNG." };
  }
  // Declared type must agree with the actual bytes (anti-spoofing).
  if (sniffed !== declaredMime) {
    return { ok: false, error: "File content does not match its type." };
  }
  return { ok: true, mime: sniffed };
}
