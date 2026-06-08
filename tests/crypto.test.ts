import { describe, it, expect } from "vitest";
import {
  hashText,
  hashBinary,
  generateKeyPair,
  encryptContent,
  decryptContent,
  encryptBytes,
  decryptBytes,
  signHash,
  drandRoundAt,
} from "../client/src/lib/crypto";

// ─── SHA-256 ────────────────────────────────────────────────────────────────────

describe("hashText", () => {
  it("returns a 64-char lowercase hex string", async () => {
    const hash = await hashText("hello world");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the known SHA-256 for 'hello world'", async () => {
    const hash = await hashText("hello world");
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashText("foo");
    const b = await hashText("bar");
    expect(a).not.toBe(b);
  });

  it("is deterministic", async () => {
    const a = await hashText("deterministic");
    const b = await hashText("deterministic");
    expect(a).toBe(b);
  });

  it("handles empty string", async () => {
    const hash = await hashText("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // SHA-256 of "" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("handles unicode", async () => {
    const hash = await hashText("🔒 prediction");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});


describe("hashBinary", () => {
  it("hashes an ArrayBuffer", async () => {
    const buf = new TextEncoder().encode("binary data").buffer;
    const hash = await hashBinary(buf);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── RSA-PSS Key Pair ───────────────────────────────────────────────────────────

describe("generateKeyPair", () => {
  it("generates valid PEM keys", async () => {
    const { publicKeyPem, privateKeyPem } = await generateKeyPair();
    expect(publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(publicKeyPem).toContain("-----END PUBLIC KEY-----");
    expect(privateKeyPem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(privateKeyPem).toContain("-----END PRIVATE KEY-----");
  });

  it("generates unique key pairs each time", async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    expect(a.publicKeyPem).not.toBe(b.publicKeyPem);
  });
});

// ─── RSA-PSS Signing ────────────────────────────────────────────────────────────

describe("signHash", () => {
  it("produces a valid base64 signature", async () => {
    const { privateKeyPem } = await generateKeyPair();
    const hash = await hashText("test prediction");
    const sig = await signHash(hash, privateKeyPem);
    // Should be a non-empty base64 string
    expect(sig.length).toBeGreaterThan(0);
    expect(() => atob(sig)).not.toThrow();
  });

  it("produces different signatures for different hashes", async () => {
    const { privateKeyPem } = await generateKeyPair();
    const sig1 = await signHash(await hashText("aaa"), privateKeyPem);
    const sig2 = await signHash(await hashText("bbb"), privateKeyPem);
    expect(sig1).not.toBe(sig2);
  });
});

// ─── AES-256-GCM Encryption (v1) ───────────────────────────────────────────────

describe("encryptContent / decryptContent", () => {
  it("encrypts and decrypts back to original plaintext", async () => {
    const plaintext = "This is my sealed prediction for 2030!";
    const { encryptedContent, nonce, encryptionKey } =
      await encryptContent(plaintext);

    expect(encryptedContent).not.toBe(plaintext);
    expect(nonce.length).toBeGreaterThan(0);
    expect(encryptionKey.length).toBeGreaterThan(0);

    const decrypted = await decryptContent(
      encryptedContent,
      nonce,
      encryptionKey
    );
    expect(decrypted).toBe(plaintext);
  });

  it("handles empty string", async () => {
    const { encryptedContent, nonce, encryptionKey } =
      await encryptContent("");
    const decrypted = await decryptContent(
      encryptedContent,
      nonce,
      encryptionKey
    );
    expect(decrypted).toBe("");
  });

  it("handles unicode content", async () => {
    const plaintext = "Predizione 🇮🇹: il futuro è adesso!";
    const { encryptedContent, nonce, encryptionKey } =
      await encryptContent(plaintext);
    const decrypted = await decryptContent(
      encryptedContent,
      nonce,
      encryptionKey
    );
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext (random nonce)", async () => {
    const plaintext = "same input";
    const a = await encryptContent(plaintext);
    const b = await encryptContent(plaintext);
    expect(a.encryptedContent).not.toBe(b.encryptedContent);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("fails to decrypt with wrong key", async () => {
    const { encryptedContent, nonce } = await encryptContent("secret");
    const { encryptionKey: wrongKey } = await encryptContent("other");
    await expect(
      decryptContent(encryptedContent, nonce, wrongKey)
    ).rejects.toThrow();
  });
});

// ─── AES-256-GCM Binary Encryption (sealed documents / PDFs) ────────────────────

describe("encryptBytes / decryptBytes", () => {
  // Minimal valid-looking PDF header bytes + some binary payload.
  function makeBytes(): ArrayBuffer {
    const arr = new Uint8Array(2048);
    const header = new TextEncoder().encode("%PDF-1.7\n");
    arr.set(header, 0);
    for (let i = header.length; i < arr.length; i++) arr[i] = (i * 31 + 7) % 256;
    return arr.buffer;
  }

  it("encrypts and decrypts back to the identical bytes", async () => {
    const original = makeBytes();
    const { ciphertext, nonce, keyB64 } = await encryptBytes(original);

    expect(ciphertext.length).toBeGreaterThan(0);
    expect(nonce.length).toBeGreaterThan(0);
    expect(keyB64.length).toBeGreaterThan(0);

    const decrypted = await decryptBytes(ciphertext, nonce, keyB64);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original));
  });

  it("preserves the hash across the encrypt/decrypt round-trip", async () => {
    const original = makeBytes();
    const originalHash = await hashBinary(original);
    const { ciphertext, nonce, keyB64 } = await encryptBytes(original);
    const decrypted = await decryptBytes(ciphertext, nonce, keyB64);
    expect(await hashBinary(decrypted)).toBe(originalHash);
  });

  it("produces different ciphertext for the same bytes (random key + nonce)", async () => {
    const original = makeBytes();
    const a = await encryptBytes(original);
    const b = await encryptBytes(original);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.keyB64).not.toBe(b.keyB64);
  });

  it("fails to decrypt with the wrong key", async () => {
    const { ciphertext, nonce } = await encryptBytes(makeBytes());
    const { keyB64: wrongKey } = await encryptBytes(makeBytes());
    await expect(decryptBytes(ciphertext, nonce, wrongKey)).rejects.toThrow();
  });
});

// ─── Sealed-PDF marker (Phase 2: appendSeal / extractSeal) ──────────────────────

import { appendSeal, extractSeal, stripSeal, randomPassword, isPdfBytes } from "../client/src/lib/pdfCrypto";

describe("appendSeal / extractSeal", () => {
  const seal = {
    v: 1 as const,
    alg: "qpdf-aes256" as const,
    tlock_ciphertext: "age-encryption.org/v1\n-> tlock 12345 abc\nBASE64DATA==\n",
    drand_round: 12345,
    drand_chain_hash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    hash: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    prediction_id: "11111111-2222-3333-4444-555555555555",
    target_datetime: "2027-01-01T00:00:00.000Z",
    file_name: "contratto.pdf",
    tsa_token: "AAECAwQFBg==",
    created_at: "2026-06-05T12:00:00.000Z",
  };

  // Fake encrypted-PDF bytes (binary, with a %PDF header + an %%EOF).
  function fakePdf(): Uint8Array {
    const head = new TextEncoder().encode("%PDF-1.7\n");
    const body = new Uint8Array(1024);
    for (let i = 0; i < body.length; i++) body[i] = (i * 7 + 3) % 256;
    const eof = new TextEncoder().encode("\n%%EOF\n");
    const out = new Uint8Array(head.length + body.length + eof.length);
    out.set(head, 0);
    out.set(body, head.length);
    out.set(eof, head.length + body.length);
    return out;
  }

  it("round-trips the seal through append + extract", () => {
    const sealed = appendSeal(fakePdf(), seal);
    const got = extractSeal(sealed);
    expect(got).toEqual(seal);
  });

  it("keeps the PDF header intact (still looks like a PDF)", () => {
    const sealed = appendSeal(fakePdf(), seal);
    expect(isPdfBytes(sealed)).toBe(true);
  });

  it("returns null when there is no marker", () => {
    expect(extractSeal(fakePdf())).toBeNull();
  });

  it("extracts the last marker if appended twice", () => {
    const once = appendSeal(fakePdf(), seal);
    const twice = appendSeal(once, { ...seal, drand_round: 99999 });
    expect(extractSeal(twice)?.drand_round).toBe(99999);
  });

  it("handles unicode file names", () => {
    const s = { ...seal, file_name: "preventìvo €uro 🇮🇹.pdf" };
    const sealed = appendSeal(fakePdf(), s);
    expect(extractSeal(sealed)?.file_name).toBe("preventìvo €uro 🇮🇹.pdf");
  });

  it("re-declares a startxref trailer after the marker", () => {
    // fakePdf has no startxref → no trailer; build one that does.
    const withXref = new TextEncoder().encode("%PDF-1.7\n...\nstartxref\n9\n%%EOF\n");
    const sealed = appendSeal(withXref, seal);
    const text = new TextDecoder("latin1").decode(sealed);
    // The marker must be followed by a fresh startxref/%%EOF.
    expect(text.slice(text.lastIndexOf("%%YST-SEAL1:"))).toMatch(/startxref\s+9\s+%%EOF/);
  });

  it("stripSeal recovers the exact original bytes", () => {
    const original = fakePdf();
    const sealed = appendSeal(original, seal);
    const stripped = stripSeal(sealed);
    expect(new Uint8Array(stripped)).toEqual(new Uint8Array(original));
  });

  it("stripSeal is a no-op when there is no marker", () => {
    const original = fakePdf();
    expect(new Uint8Array(stripSeal(original))).toEqual(new Uint8Array(original));
  });

  it("extractSeal still works after the startxref trailer is appended", () => {
    const withXref = new TextEncoder().encode("%PDF-1.7\nx\nstartxref\n9\n%%EOF\n");
    const sealed = appendSeal(withXref, seal);
    expect(extractSeal(sealed)).toEqual(seal);
  });
});

describe("randomPassword", () => {
  it("is URL-safe and high-entropy", () => {
    const pw = randomPassword();
    expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pw.length).toBeGreaterThanOrEqual(40);
  });

  it("is different each time", () => {
    expect(randomPassword()).not.toBe(randomPassword());
  });
});

// ─── drand round calculation ────────────────────────────────────────────────────

describe("drandRoundAt", () => {
  const GENESIS_MS = 1692803367 * 1000;
  const PERIOD_MS = 3000;

  it("returns 1 for genesis time", () => {
    expect(drandRoundAt(GENESIS_MS)).toBe(1);
  });

  it("returns correct round for genesis + 3s", () => {
    expect(drandRoundAt(GENESIS_MS + PERIOD_MS)).toBe(2);
  });

  it("returns correct round for a time well in the future", () => {
    const targetMs = GENESIS_MS + 100 * PERIOD_MS;
    expect(drandRoundAt(targetMs)).toBe(101);
  });

  it("floors partial periods", () => {
    // 1.5 periods after genesis → floor = 1, + 1 = 2
    expect(drandRoundAt(GENESIS_MS + 1.5 * PERIOD_MS)).toBe(2);
  });

  it("throws for time before genesis", () => {
    expect(() => drandRoundAt(GENESIS_MS - 1)).toThrow("before drand genesis");
  });
});

// ─── Capsule loading ────────────────────────────────────────────────────────────
// loadCapsule uses FileReader (browser-only). Tests skipped in Node environment.
// TODO: add browser-based tests (e.g., with vitest --environment=happy-dom)
