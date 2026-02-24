// ─── YouSaidThat crypto utilities ─────────────────────────────────────────────
// All operations use the browser's native WebCrypto API.
// Nothing here ever leaves the client — no keys, no plaintext reach the server.

export interface CapsuleData {
  version: "1.0";
  mode: "proof_of_existence" | "sealed_prediction";
  /** Sub-mode for proof_of_existence: cleartext (public) or encrypted (private) */
  visibility: "cleartext" | "encrypted" | null;
  target_year: number;
  keywords: string[];
  /** SHA-256 of plaintext, 64 hex chars */
  hash: string;
  /** RSA-PSS 2048-bit public key, PEM. Null for proof_of_existence cleartext. */
  public_key: string | null;
  /** RSA-PSS 2048-bit private key, PEM — KEEP SAFE, never send to server. Null for proof_of_existence cleartext. */
  private_key: string | null;
  /** AES-256-GCM ciphertext, base64. Null for cleartext modes. */
  encrypted_content: string | null;
  /** AES-256-GCM nonce, 12 bytes, base64. Null for cleartext modes. */
  nonce: string | null;
  /** AES-256-GCM encryption key, 32 bytes, base64. Null for cleartext modes. */
  encryption_key: string | null;
  /** OTS proof blob, base64. Null until confirmed. */
  ots_proof: string | null;
  /** RFC 3161 TSA response token, base64. */
  tsa_token: string | null;
  created_at: string;
  /** UUID assigned by the backend after registration. */
  prediction_id: string | null;
  /** Arweave TX ID — available after permanent storage upload completes. */
  arweave_tx_id: string | null;
}

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 of a normalized email (lowercase + trimmed). Never send raw email to server. */
export async function hashEmail(email: string): Promise<string> {
  return hashText(email.trim().toLowerCase());
}

export async function hashBinary(buffer: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── RSA-PSS key pair (for signing / attestation claims) ─────────────────────

export async function generateKeyPair(): Promise<{
  publicKeyPem: string;
  privateKeyPem: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const pubDer = await crypto.subtle.exportKey("spki", pair.publicKey);
  const prvDer = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  return {
    publicKeyPem: derToPem(pubDer, "PUBLIC KEY"),
    privateKeyPem: derToPem(prvDer, "PRIVATE KEY"),
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
  };
}

// ─── AES-256-GCM encryption ───────────────────────────────────────────────────

export async function encryptContent(plaintext: string): Promise<{
  encryptedContent: string; // base64 ciphertext
  nonce: string;            // base64 12-byte nonce
  encryptionKey: string;    // base64 32-byte raw AES key (stored in capsule)
}> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const nonceBytes = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBytes },
    key,
    data
  );

  const keyRaw = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedContent: bufToB64(cipherBuf),
    nonce: bufToB64(nonceBytes),
    encryptionKey: bufToB64(keyRaw),
  };
}

export async function decryptContent(
  encryptedContentB64: string,
  nonceB64: string,
  encryptionKeyB64: string
): Promise<string> {
  const keyRaw = b64ToBuf(encryptionKeyB64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const nonce = b64ToBuf(nonceB64);
  const ciphertext = b64ToBuf(encryptedContentB64);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBuf);
}

// ─── RSA-PSS signing (for attestation claim) ─────────────────────────────────

export async function signHash(
  hash: string,
  privateKeyPem: string
): Promise<string> {
  const der = pemToDer(privateKeyPem);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = new TextEncoder().encode(hash);
  const sig = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    privateKey,
    data
  );

  return bufToB64(sig);
}

// ─── Capsule file I/O ─────────────────────────────────────────────────────────

export function downloadCapsule(capsule: CapsuleData, filename?: string): void {
  const json = JSON.stringify(capsule, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `yousaidthat-${capsule.target_year}-${capsule.hash.slice(0, 8)}.capsule`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function loadCapsule(file: File): Promise<CapsuleData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        if (!raw.hash || !raw.target_year) {
          reject(new Error("Invalid capsule: missing required fields"));
          return;
        }
        // Migrate legacy capsules that used 'type' instead of 'mode'
        if (!raw.mode && raw.type) {
          raw.mode = raw.type === "full_phrase" ? "sealed_prediction" : "proof_of_existence";
        }
        if (!raw.mode) {
          reject(new Error("Invalid capsule: missing mode field"));
          return;
        }
        resolve(raw as CapsuleData);
      } catch {
        reject(new Error("Invalid capsule: not valid JSON"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function derToPem(der: ArrayBuffer, type: string): string {
  const b64 = bufToB64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  return b64ToBuf(b64);
}
