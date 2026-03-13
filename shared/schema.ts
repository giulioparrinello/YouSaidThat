import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, uuid, bigint, varchar } from "drizzle-orm/pg-core";
import { z } from "zod";

// ─── predictions ──────────────────────────────────────────────────────────────
export const predictions = pgTable("predictions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hash: text("hash").notNull().unique(),           // SHA-256, 64 hex chars
  mode: text("mode").notNull(),                     // 'proof_of_existence' | 'sealed_prediction'
  target_year: integer("target_year"),
  author_name: varchar("author_name", { length: 100 }),
  keywords: text("keywords").array(),               // up to 3 optional keywords
  ots_status: text("ots_status").notNull().default("pending"), // pending | confirmed | failed
  ots_proof: text("ots_proof"),                     // base64-encoded OTS proof blob
  tsa_token: text("tsa_token"),                     // base64-encoded RFC 3161 token
  bitcoin_block: integer("bitcoin_block"),
  timestamp_utc: timestamp("timestamp_utc", { withTimezone: true }).defaultNow(),
  is_public: boolean("is_public").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Proof of existence content fields
  content: text("content"),                         // cleartext for proof_of_existence cleartext sub-mode
  content_encrypted: text("content_encrypted"),     // ciphertext for encrypted sub-mode
  arweave_tx_id: text("arweave_tx_id"),            // TX ID from Arweave
  arweave_status: text("arweave_status").notNull().default("none"), // none | pending | confirmed | failed
  // drand timelock fields (sealed_prediction v2 only)
  drand_round: bigint("drand_round", { mode: "number" }),           // drand quicknet round number
  target_datetime: timestamp("target_datetime", { withTimezone: true }), // exact unlock datetime
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
// Stores delivery reminders. Email is stored in plain text — the user explicitly
// opts in to future delivery when providing it. notify_at is computed at insert:
// target_datetime for sealed_prediction, Jan 1 09:00 UTC for proof_of_existence.
export const email_queue = pgTable("email_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prediction_id: uuid("prediction_id").references(() => predictions.id),
  email: text("email").notNull(),
  notify_at: timestamp("notify_at", { withTimezone: true }).notNull(),
  keywords: text("keywords").array(),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmation_token: uuid("confirmation_token").default(sql`gen_random_uuid()`).notNull(),
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

// ─── prediction_votes ─────────────────────────────────────────────────────────
// Like/dislike votes on public predictions. voter_fingerprint is a UUID stored
// in localStorage (no auth required). UNIQUE(prediction_id, voter_fingerprint).
export const predictionVotes = pgTable("prediction_votes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prediction_id: uuid("prediction_id")
    .notNull()
    .references(() => predictions.id, { onDelete: "cascade" }),
  vote_type: text("vote_type").notNull(),        // 'like' | 'dislike'
  voter_fingerprint: text("voter_fingerprint").notNull(),
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
export type PredictionVote = typeof predictionVotes.$inferSelect;
export type InsertPredictionVote = typeof predictionVotes.$inferInsert;

// ─── Zod API validation schemas ───────────────────────────────────────────────
const currentYear = new Date().getFullYear();

export const registerPredictionSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64 lowercase hex chars"),
  mode: z.enum(["proof_of_existence", "sealed_prediction"]),
  target_year: z
    .number()
    .int()
    .min(currentYear, `Must be at least ${currentYear}`)
    .max(currentYear + 50, `Must be at most ${currentYear + 50}`)
    .optional(),
  author_name: z.string().max(100).optional(),
  keywords: z
    .array(z.string().max(30).regex(/^[a-zA-Z0-9 -]+$/, "Alphanumeric + spaces/hyphens only"))
    .max(3)
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  is_public: z.boolean().default(false),
  // Proof of existence content — cleartext or encrypted
  content: z.string().max(10000).optional(),
  content_encrypted: z.string().max(50000).optional(),
  // drand timelock fields (sealed_prediction v2 only)
  drand_round: z.number().int().positive().optional(),
  target_datetime: z.string().datetime({ offset: true }).optional(),
});

export const claimPredictionSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64 lowercase hex chars"),
  public_key: z.string().min(1).max(5000),
  signature: z.string().min(1).max(2000),
  display_name: z.string().min(1).max(100),
});

export const waitlistSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const revealPredictionSchema = z.object({
  content: z.string().max(10000).optional(),
  is_public: z.boolean(),
});

export const voteSchema = z.object({
  vote_type: z.enum(["like", "dislike"]),
  fingerprint: z.string().uuid("Must be a valid UUID"),
});

export type RegisterPrediction = z.infer<typeof registerPredictionSchema>;
export type ClaimPrediction = z.infer<typeof claimPredictionSchema>;
export type RevealPrediction = z.infer<typeof revealPredictionSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
