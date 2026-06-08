// ─── Native PDF encryption (Phase 2) ──────────────────────────────────────────
// Produces a real AES-256 password-protected PDF openable by any reader, using
// qpdf compiled to WASM (@neslinesli93/qpdf-wasm, Apache-2.0). The WASM is loaded
// lazily so it never weighs on pages that don't seal/unlock a PDF.
//
// The drand-sealed password travels INSIDE the PDF, appended as a cleartext
// marker after %%EOF — readable without the password, ignored by PDF readers.

interface QpdfFS {
  writeFile: (path: string, data: Uint8Array) => void;
  readFile: (path: string) => Uint8Array;
  unlink: (path: string) => void;
}
interface QpdfInstance {
  callMain: (args: string[]) => number;
  FS: QpdfFS;
}

let qpdfPromise: Promise<QpdfInstance> | null = null;

/** Load + initialise qpdf-wasm once, then reuse the instance. */
async function loadQpdf(): Promise<QpdfInstance> {
  if (!qpdfPromise) {
    qpdfPromise = (async () => {
      const mod: any = await import("@neslinesli93/qpdf-wasm");
      const createModule = mod.default ?? mod;
      // Vite resolves this to a hashed asset URL served next to the bundle.
      const wasmUrl = (await import("@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url")).default;
      return createModule({ locateFile: () => wasmUrl }) as Promise<QpdfInstance>;
    })();
  }
  return qpdfPromise;
}

/** A strong random password (256 bits, URL-safe base64, no padding). */
export function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Encrypt a PDF with AES-256 (qpdf). Returns the encrypted PDF bytes. */
export async function encryptPdf(
  pdf: ArrayBuffer | Uint8Array,
  userPassword: string,
  ownerPassword: string
): Promise<Uint8Array> {
  const qpdf = await loadQpdf();
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  qpdf.FS.writeFile("/in.pdf", bytes);
  try {
    // Flag form (not positional) so a password starting with "-" is never
    // mistaken for an option.
    const rc = qpdf.callMain([
      "--encrypt",
      "--user-password=" + userPassword,
      "--owner-password=" + ownerPassword,
      "--bits=256",
      "--",
      "/in.pdf",
      "/out.pdf",
    ]);
    if (rc !== 0) throw new Error(`qpdf encryption failed (code ${rc})`);
    // Copy out of MEMFS before unlinking.
    return new Uint8Array(qpdf.FS.readFile("/out.pdf"));
  } finally {
    try { qpdf.FS.unlink("/in.pdf"); } catch {}
    try { qpdf.FS.unlink("/out.pdf"); } catch {}
  }
}

/** Decrypt a password-protected PDF (qpdf). Returns the cleartext PDF bytes. */
export async function decryptPdf(
  pdf: ArrayBuffer | Uint8Array,
  password: string
): Promise<Uint8Array> {
  const qpdf = await loadQpdf();
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  qpdf.FS.writeFile("/enc.pdf", bytes);
  try {
    const rc = qpdf.callMain(["--password=" + password, "/enc.pdf", "--decrypt", "/dec.pdf"]);
    if (rc !== 0) throw new Error(`qpdf decryption failed (code ${rc})`);
    return new Uint8Array(qpdf.FS.readFile("/dec.pdf"));
  } finally {
    try { qpdf.FS.unlink("/enc.pdf"); } catch {}
    try { qpdf.FS.unlink("/dec.pdf"); } catch {}
  }
}

// ─── YST seal marker (embedded after %%EOF) ──────────────────────────────────

const SEAL_MARKER = "%%YST-SEAL1:";

/** Time-lock metadata embedded in a sealed PDF, readable without the password. */
export interface SealData {
  v: 1;
  alg: "qpdf-aes256";
  /** drand-sealed user password (armored tlock ciphertext). */
  tlock_ciphertext: string;
  drand_round: number;
  drand_chain_hash: string;
  /** SHA-256 of the ORIGINAL (cleartext) PDF, for post-unlock verification. */
  hash: string;
  prediction_id: string | null;
  target_datetime: string;
  file_name: string;
  tsa_token: string | null;
  created_at: string;
}

/** Read the byte offset declared by the file's last `startxref`, or null. */
function lastStartxrefOffset(bytes: Uint8Array): number | null {
  const win = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  const i = win.lastIndexOf("startxref");
  if (i === -1) return null;
  const m = win.slice(i).match(/startxref\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Append the YST seal after the encrypted PDF's bytes, then re-declare a
 * `startxref`/`%%EOF` so strict parsers (qpdf, Acrobat) can still locate the
 * cross-reference table despite the trailing seal. The seal line begins with
 * `%` so PDF readers treat it as a comment.
 */
export function appendSeal(encryptedPdf: Uint8Array, seal: SealData): Uint8Array {
  const json = JSON.stringify(seal);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const offset = lastStartxrefOffset(encryptedPdf);
  const trailer = offset !== null ? `startxref\n${offset}\n%%EOF\n` : "";
  const tail = new TextEncoder().encode(`\n${SEAL_MARKER}${b64}\n${trailer}`);
  const out = new Uint8Array(encryptedPdf.length + tail.length);
  out.set(encryptedPdf, 0);
  out.set(tail, encryptedPdf.length);
  return out;
}

/** Remove the YST seal (and anything after it), returning the original PDF bytes. */
export function stripSeal(bytes: Uint8Array): Uint8Array {
  const start = Math.max(0, bytes.length - 1_000_000);
  const win = new TextDecoder("latin1").decode(bytes.subarray(start));
  const rel = win.lastIndexOf("\n" + SEAL_MARKER);
  if (rel === -1) return bytes;
  return bytes.subarray(0, start + rel);
}

/** Extract the YST seal from a sealed PDF, or null if not present. */
export function extractSeal(bytes: Uint8Array): SealData | null {
  // The marker lives near the end; scan a generous tail window as latin1.
  const window = bytes.subarray(Math.max(0, bytes.length - 1_000_000));
  const text = new TextDecoder("latin1").decode(window);
  const idx = text.lastIndexOf(SEAL_MARKER);
  if (idx === -1) return null;
  const after = text.slice(idx + SEAL_MARKER.length);
  const match = after.match(/^([A-Za-z0-9+/=_-]+)/);
  if (!match) return null;
  try {
    const json = decodeURIComponent(escape(atob(match[1])));
    const parsed = JSON.parse(json);
    if (parsed && parsed.alg === "qpdf-aes256" && parsed.hash) return parsed as SealData;
    return null;
  } catch {
    return null;
  }
}

/** True if the bytes look like a PDF (start with %PDF). */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}
