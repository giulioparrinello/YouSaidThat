import { describe, it, expect } from "vitest";
import { drandRoundAt, tlockEncrypt, tlockDecrypt } from "../client/src/lib/crypto";

// End-to-end timelock test against the real drand network (api.drand.sh).
// Encrypts toward a round that is already published, so decryption succeeds
// immediately. This is the moat flow the report flagged as untested.

describe("drand timelock end-to-end", () => {
  it("encrypts and decrypts via a past drand round", async () => {
    const plaintext = `tlock e2e ${Date.now()}`;
    // 30 seconds in the past: the round signature is already published
    const past = Date.now() - 30_000;

    const { ciphertext, round } = await tlockEncrypt(plaintext, past);
    expect(ciphertext).toContain("AGE ENCRYPTED FILE");
    expect(round).toBeGreaterThan(0);

    const decrypted = await tlockDecrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  }, 60_000);

  it("produces a ciphertext that cannot be decrypted before the round", async () => {
    const plaintext = "sealed until tomorrow";
    const future = Date.now() + 24 * 60 * 60 * 1000;

    const { ciphertext } = await tlockEncrypt(plaintext, future);
    expect(ciphertext).toContain("AGE ENCRYPTED FILE");

    // The beacon for a future round does not exist yet: decryption must fail
    await expect(tlockDecrypt(ciphertext)).rejects.toThrow();
  }, 60_000);

  it("maps target times to increasing round numbers", () => {
    const now = Date.now();
    const r1 = drandRoundAt(now);
    const r2 = drandRoundAt(now + 60_000);
    expect(r2).toBeGreaterThan(r1);
  });
});
