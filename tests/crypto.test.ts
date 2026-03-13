import { describe, it, expect } from "vitest";
import {
  hashText,
  hashBinary,
  generateKeyPair,
  encryptContent,
  decryptContent,
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
