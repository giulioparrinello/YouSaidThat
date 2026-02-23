import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

// ─── predictions ──────────────────────────────────────────────────────────────
// Never stores plaintext content. Only hash + metadata.
export const predictions = pgTable("predictions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hash: text("hash").notNull().unique(),           // SHA-256, 64 hex chars
  mode: text("mode").notNull(),                     // 'proof_of_existence' | 'sealed_prediction'
  target_year: integer("target_year").notNull(),
  keywords: text("keywords").array(),               // up to 3 optional keywords
  ots_status: text("ots_status").notNull().default("pending"), // pending | confirmed | failed
  ots_proof: text("ots_proof"),                     // base64-encoded OTS proof blob
  tsa_token: text("tsa_token"),                     // base64-encoded RFC 3161 token
  bitcoin_block: integer("bitcoin_block"),
  timestamp_utc: timestamp("timestamp_utc", { withTimezone: true }).defaultNow(),
  is_public: boolean("is_public").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── attestations ─────────────────────────────────────────────────────────────
// Public identity claims after target year is reached.
export const attestations = pgTable("attestations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prediction_id: uuid("prediction_id")
    .notNull()
    .references(() => predictions.id),
  display_name: text("display_name").notNull(),
  public_key: text("public_key").notNull(),         // PEM RSA-PSS public key
  signature: text("signature").notNull(),           // base64 RSA-PSS signature of hash
  attestation_url: text("attestation_url"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── email_queue ──────────────────────────────────────────────────────────────
// Privacy-first design: only the SHA-256 hash of the email is stored.
// The raw email is never persisted on the server. As a consequence, server-side
// email reminders cannot be dispatched automatically; users are expected to
// proactively return to the app at their target year to unlock their capsule.
export const email_queue = pgTable("email_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email_hash: text("email_hash").notNull(),          // SHA-256 of original email
  target_year: integer("target_year").notNull(),
  keywords: text("keywords").array(),               // only identifier besides year
  status: text("status").notNull().default("pending"), // pending | sent | failed
  sent_at: timestamp("sent_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── waitlist ──────────────────────────────────────────────────────────────────
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── TypeScript types ─────────────────────────────────────────────────────────
export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;
export type Attestation = typeof attestations.$inferSelect;
export type InsertAttestation = typeof attestations.$inferInsert;
export type EmailQueue = typeof email_queue.$inferSelect;
export type InsertEmailQueue = typeof email_queue.$inferInsert;
export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// ─── Zod API validation schemas ───────────────────────────────────────────────
const currentYear = new Date().getFullYear();

export const registerPredictionSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64 lowercase hex chars"),
  mode: z.enum(["proof_of_existence", "sealed_prediction"]),
  target_year: z
    .number()
    .int()
    .min(currentYear + 1, `Must be at least ${currentYear + 1}`)
    .max(currentYear + 50, `Must be at most ${currentYear + 50}`),
  keywords: z
    .array(z.string().max(30).regex(/^[a-zA-Z0-9 -]+$/, "Alphanumeric + spaces/hyphens only"))
    .max(3)
    .optional(),
  email_hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64 lowercase hex chars").optional(),
  is_public: z.boolean().default(false),
});

export const claimPredictionSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64 lowercase hex chars"),
  public_key: z.string().min(1),
  signature: z.string().min(1),
  display_name: z.string().min(1).max(100),
});

export const waitlistSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type RegisterPrediction = z.infer<typeof registerPredictionSchema>;
export type ClaimPrediction = z.infer<typeof claimPredictionSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;
