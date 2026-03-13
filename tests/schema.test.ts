import { describe, it, expect } from "vitest";
import {
  registerPredictionSchema,
  claimPredictionSchema,
  waitlistSchema,
  revealPredictionSchema,
} from "../shared/schema";

// ─── registerPredictionSchema ───────────────────────────────────────────────────

describe("registerPredictionSchema", () => {
  const validBase = {
    hash: "a".repeat(64),
    mode: "proof_of_existence" as const,
    target_year: new Date().getFullYear(),
    is_public: false,
  };

  it("accepts valid minimal input", () => {
    const result = registerPredictionSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all optional fields", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      keywords: ["AI", "tech"],
      email: "user@example.com",
      content: "My prediction text",
      drand_round: 12345,
      target_datetime: "2030-01-01T00:00:00+00:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hash (too short)", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      hash: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid hash (uppercase)", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      hash: "A".repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      mode: "invalid_mode",
    });
    expect(result.success).toBe(false);
  });

  it("rejects target_year in the past", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      target_year: 2020,
    });
    expect(result.success).toBe(false);
  });

  it("rejects target_year too far in the future", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      target_year: new Date().getFullYear() + 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 keywords", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      keywords: ["a", "b", "c", "d"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects keywords with special chars", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      keywords: ["valid", "invalid<script>"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects content exceeding max length", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      content: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts content at max length", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      content: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects content_encrypted exceeding max length", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      content_encrypted: "x".repeat(50001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative drand_round", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      drand_round: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer drand_round", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      drand_round: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts sealed_prediction mode", () => {
    const result = registerPredictionSchema.safeParse({
      ...validBase,
      mode: "sealed_prediction",
    });
    expect(result.success).toBe(true);
  });
});

// ─── claimPredictionSchema ──────────────────────────────────────────────────────

describe("claimPredictionSchema", () => {
  const validClaim = {
    hash: "c".repeat(64),
    public_key: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----",
    signature: "base64signature==",
    display_name: "Giulio P.",
  };

  it("accepts valid claim", () => {
    const result = claimPredictionSchema.safeParse(validClaim);
    expect(result.success).toBe(true);
  });

  it("rejects empty display_name", () => {
    const result = claimPredictionSchema.safeParse({
      ...validClaim,
      display_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects display_name over 100 chars", () => {
    const result = claimPredictionSchema.safeParse({
      ...validClaim,
      display_name: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects public_key over 5000 chars", () => {
    const result = claimPredictionSchema.safeParse({
      ...validClaim,
      public_key: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects signature over 2000 chars", () => {
    const result = claimPredictionSchema.safeParse({
      ...validClaim,
      signature: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ─── waitlistSchema ─────────────────────────────────────────────────────────────

describe("waitlistSchema", () => {
  it("accepts valid email", () => {
    const result = waitlistSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = waitlistSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = waitlistSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

// ─── revealPredictionSchema ─────────────────────────────────────────────────────

describe("revealPredictionSchema", () => {
  it("accepts with is_public only", () => {
    const result = revealPredictionSchema.safeParse({ is_public: true });
    expect(result.success).toBe(true);
  });

  it("accepts with content and is_public", () => {
    const result = revealPredictionSchema.safeParse({
      content: "My prediction came true!",
      is_public: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing is_public", () => {
    const result = revealPredictionSchema.safeParse({
      content: "text",
    });
    expect(result.success).toBe(false);
  });

  it("rejects content over max length", () => {
    const result = revealPredictionSchema.safeParse({
      content: "x".repeat(10001),
      is_public: false,
    });
    expect(result.success).toBe(false);
  });
});
