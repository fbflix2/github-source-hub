/**
 * File upload security validation utilities.
 * Validates MIME type via magic bytes and restricts dangerous extensions.
 */

const IMAGE_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] },
  { mime: "image/bmp", bytes: [0x42, 0x4d] },
];

const DOCUMENT_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // docx is zip
];

const BLOCKED_EXTENSIONS = new Set([
  "svg", "html", "htm", "xml", "xhtml",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "php", "asp", "aspx", "jsp", "py", "rb", "sh", "bat", "cmd", "ps1",
  "exe", "dll", "scr", "com", "msi", "jar",
  "swf", "action", "cgi",
]);

const SAFE_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

const SAFE_SUPPORT_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp",
  "mp4", "mov", "avi", "mkv",
  "pdf", "txt", "doc", "docx",
]);

function getExtension(filename: string): string {
  return (filename.split(".").pop() || "").toLowerCase();
}

async function readMagicBytes(file: File, count = 8): Promise<number[]> {
  const slice = file.slice(0, count);
  const buffer = await slice.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

function matchesSignature(bytes: number[], sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b);
}

async function detectMimeFromBytes(file: File): Promise<string | null> {
  const bytes = await readMagicBytes(file);
  const allSigs = [...IMAGE_SIGNATURES, ...DOCUMENT_SIGNATURES];
  for (const sig of allSigs) {
    if (matchesSignature(bytes, sig.bytes)) return sig.mime;
  }
  return null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an image file for avatar/profile photo uploads.
 * Only allows PNG, JPG, WEBP, GIF, BMP. Blocks SVG and scripts.
 */
export async function validateImageFile(
  file: File,
  maxSizeMB = 2
): Promise<ValidationResult> {
  const ext = getExtension(file.name);

  // Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Extensão .${ext} não é permitida por segurança.` };
  }

  // Only allow safe image extensions
  if (!SAFE_IMAGE_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Apenas imagens PNG, JPG, WEBP, GIF são permitidas.` };
  }

  // Size check
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Arquivo deve ter no máximo ${maxSizeMB}MB.` };
  }

  // Validate real MIME via magic bytes
  const realMime = await detectMimeFromBytes(file);
  if (!realMime || !realMime.startsWith("image/")) {
    return { valid: false, error: "O arquivo não parece ser uma imagem válida." };
  }

  return { valid: true };
}

/**
 * Validate a file for support ticket attachments.
 * Allows images, videos, PDFs, and text docs. Blocks scripts and SVG.
 */
export async function validateSupportFile(
  file: File,
  maxSizeMB = 20
): Promise<ValidationResult> {
  const ext = getExtension(file.name);

  // Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Extensão .${ext} não é permitida por segurança.` };
  }

  // Only allow safe support extensions
  if (!SAFE_SUPPORT_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Tipo de arquivo .${ext} não é permitido. Use imagens, vídeos, PDF ou TXT.` };
  }

  // Size check
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Arquivo deve ter no máximo ${maxSizeMB}MB.` };
  }

  // For images, validate magic bytes
  if (SAFE_IMAGE_EXTENSIONS.has(ext)) {
    const realMime = await detectMimeFromBytes(file);
    if (!realMime || !realMime.startsWith("image/")) {
      return { valid: false, error: "O arquivo não parece ser uma imagem válida." };
    }
  }

  // For PDFs, validate magic bytes
  if (ext === "pdf") {
    const realMime = await detectMimeFromBytes(file);
    if (realMime !== "application/pdf") {
      return { valid: false, error: "O arquivo não parece ser um PDF válido." };
    }
  }

  return { valid: true };
}
