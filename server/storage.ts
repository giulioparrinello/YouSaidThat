import { eq, desc, and, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  predictions,
  attestations,
  email_queue,
  waitlist,
  predictionVotes,
  type Prediction,
  type InsertPrediction,
  type Attestation,
  type InsertAttestation,
  type EmailQueue,
  type InsertEmailQueue,
  type Waitlist,
  type InsertWaitlist,
} from "../shared/schema";

export interface IStorage {
  // Predictions
  insertPrediction(data: InsertPrediction): Promise<Prediction>;
  // Atomically insert prediction + optional email_queue entry in a single transaction
  registerPredictionWithEmail(
    predictionData: InsertPrediction,
    emailData?: { email: string; notify_at: Date; keywords?: string[] | null; confirmation_token?: string }
  ): Promise<Prediction>;
  getPredictionByHash(hash: string): Promise<Prediction | undefined>;
  getPredictionById(id: string): Promise<Prediction | undefined>;
  getPublicPredictions(opts: {
    page: number;
    limit: number;
    keyword?: string;
    year?: number;
  }): Promise<{ predictions: Prediction[]; total: number }>;
  updateOtsStatus(
    id: string,
    data: { ots_status: string; ots_proof?: string; bitcoin_block?: number }
  ): Promise<void>;
  getPendingOts(): Promise<Prediction[]>;
  updateArweaveStatus(
    id: string,
    data: { arweave_tx_id?: string; arweave_status: string }
  ): Promise<void>;
  getPendingArweaveUploads(): Promise<Prediction[]>;
  getStats(): Promise<{ total: number }>;
  getAdminStats(): Promise<{
    total: number;
    otsByStatus: Record<string, number>;
    arweaveByStatus: Record<string, number>;
  }>;

  // Attestations
  insertAttestation(data: InsertAttestation): Promise<Attestation>;
  getAttestationByPredictionId(
    prediction_id: string
  ): Promise<Attestation | undefined>;
  getAttestationById(id: string): Promise<Attestation | undefined>;

  // Email queue
  insertEmailQueue(data: InsertEmailQueue): Promise<EmailQueue>;
  getPendingEmailsDue(): Promise<EmailQueue[]>;
  confirmEmailByToken(token: string): Promise<boolean>;
  markEmailSent(id: string): Promise<void>;
  markEmailFailed(id: string): Promise<void>;

  // Reveal a sealed prediction (at unlock time, optionally make public)
  revealPrediction(
    id: string,
    data: { content?: string; is_public: boolean }
  ): Promise<void>;

  // Votes
  upsertVote(prediction_id: string, vote_type: "like" | "dislike", fingerprint: string): Promise<void>;
  removeVote(prediction_id: string, fingerprint: string): Promise<void>;
  getVoteCounts(prediction_id: string): Promise<{ likes: number; dislikes: number }>;
  getMyVote(prediction_id: string, fingerprint: string): Promise<"like" | "dislike" | null>;

  // Waitlist
  insertWaitlistEntry(email: string): Promise<Waitlist>;
  getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined>;
}

export class DrizzleStorage implements IStorage {
  async insertPrediction(data: InsertPrediction): Promise<Prediction> {
    const [result] = await db.insert(predictions).values(data).returning();
    return result;
  }

  async registerPredictionWithEmail(
    predictionData: InsertPrediction,
    emailData?: { email: string; notify_at: Date; keywords?: string[] | null; confirmation_token?: string }
  ): Promise<Prediction> {
    return db.transaction(async (tx) => {
      const [prediction] = await tx
        .insert(predictions)
        .values(predictionData)
        .returning();

      if (emailData) {
        await tx.insert(email_queue).values({
          prediction_id: prediction.id,
          email: emailData.email,
          notify_at: emailData.notify_at,
          keywords: emailData.keywords ?? null,
          confirmation_token: emailData.confirmation_token,
          status: "pending",
          confirmed: false,
        });
      }

      return prediction;
    });
  }

  async getPredictionByHash(hash: string): Promise<Prediction | undefined> {
    const [result] = await db
      .select()
      .from(predictions)
      .where(eq(predictions.hash, hash));
    return result;
  }

  async getPredictionById(id: string): Promise<Prediction | undefined> {
    const [result] = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, id));
    return result;
  }

  async getPublicPredictions(opts: {
    page: number;
    limit: number;
    keyword?: string;
    year?: number;
  }): Promise<{ predictions: Prediction[]; total: number }> {
    const { page, limit, keyword, year } = opts;
    const offset = (page - 1) * limit;

    const conditions = [eq(predictions.is_public, true)];
    if (year) conditions.push(eq(predictions.target_year, year));
    if (keyword) {
      conditions.push(
        sql`${predictions.keywords} @> ARRAY[${keyword}]::text[]`
      );
    }
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select()
      .from(predictions)
      .where(whereClause)
      .orderBy(desc(predictions.created_at))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(predictions)
      .where(whereClause);

    return { predictions: rows, total: parseInt(count, 10) };
  }

  async updateOtsStatus(
    id: string,
    data: { ots_status: string; ots_proof?: string; bitcoin_block?: number }
  ): Promise<void> {
    await db.update(predictions).set(data).where(eq(predictions.id, id));
  }

  async getPendingOts(): Promise<Prediction[]> {
    return db
      .select()
      .from(predictions)
      .where(eq(predictions.ots_status, "pending"));
  }

  async updateArweaveStatus(
    id: string,
    data: { arweave_tx_id?: string; arweave_status: string }
  ): Promise<void> {
    await db.update(predictions).set(data).where(eq(predictions.id, id));
  }

  async getPendingArweaveUploads(): Promise<Prediction[]> {
    return db
      .select()
      .from(predictions)
      .where(eq(predictions.arweave_status, "pending"));
  }

  async getStats(): Promise<{ total: number }> {
    const [{ cnt }] = await db
      .select({ cnt: sql<string>`count(*)` })
      .from(predictions);
    return { total: parseInt(cnt, 10) };
  }

  async getAdminStats(): Promise<{
    total: number;
    otsByStatus: Record<string, number>;
    arweaveByStatus: Record<string, number>;
  }> {
    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(predictions);

    const otsCounts = await db
      .select({
        status: predictions.ots_status,
        count: sql<string>`count(*)`,
      })
      .from(predictions)
      .groupBy(predictions.ots_status);

    const arweaveCounts = await db
      .select({
        status: predictions.arweave_status,
        count: sql<string>`count(*)`,
      })
      .from(predictions)
      .groupBy(predictions.arweave_status);

    const otsByStatus: Record<string, number> = {};
    for (const row of otsCounts) {
      otsByStatus[row.status] = parseInt(row.count, 10);
    }

    const arweaveByStatus: Record<string, number> = {};
    for (const row of arweaveCounts) {
      arweaveByStatus[row.status] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(count, 10),
      otsByStatus,
      arweaveByStatus,
    };
  }

  async insertAttestation(data: InsertAttestation): Promise<Attestation> {
    const [result] = await db.insert(attestations).values(data).returning();
    return result;
  }

  async getAttestationByPredictionId(
    prediction_id: string
  ): Promise<Attestation | undefined> {
    const [result] = await db
      .select()
      .from(attestations)
      .where(eq(attestations.prediction_id, prediction_id));
    return result;
  }

  async getAttestationById(id: string): Promise<Attestation | undefined> {
    const [result] = await db
      .select()
      .from(attestations)
      .where(eq(attestations.id, id));
    return result;
  }

  async insertEmailQueue(data: InsertEmailQueue): Promise<EmailQueue> {
    const [result] = await db.insert(email_queue).values(data).returning();
    return result;
  }

  async getPendingEmailsDue(): Promise<EmailQueue[]> {
    return db
      .select()
      .from(email_queue)
      .where(
        and(
          eq(email_queue.status, "pending"),
          eq(email_queue.confirmed, true),
          sql`${email_queue.notify_at} <= NOW()`
        )
      );
  }

  async confirmEmailByToken(token: string): Promise<boolean> {
    const result = await db
      .update(email_queue)
      .set({ confirmed: true })
      .where(
        and(
          eq(email_queue.confirmation_token, token),
          eq(email_queue.confirmed, false)
        )
      )
      .returning({ id: email_queue.id });
    return result.length > 0;
  }

  async markEmailSent(id: string): Promise<void> {
    await db
      .update(email_queue)
      .set({ status: "sent", sent_at: new Date() })
      .where(eq(email_queue.id, id));
  }

  async markEmailFailed(id: string): Promise<void> {
    await db
      .update(email_queue)
      .set({ status: "failed" })
      .where(eq(email_queue.id, id));
  }

  async revealPrediction(
    id: string,
    data: { content?: string; is_public: boolean }
  ): Promise<void> {
    await db
      .update(predictions)
      .set({
        is_public: data.is_public,
        ...(data.content !== undefined ? { content: data.content } : {}),
      })
      .where(eq(predictions.id, id));
  }

  async upsertVote(prediction_id: string, vote_type: "like" | "dislike", fingerprint: string): Promise<void> {
    await db
      .insert(predictionVotes)
      .values({ prediction_id, vote_type, voter_fingerprint: fingerprint })
      .onConflictDoUpdate({
        target: [predictionVotes.prediction_id, predictionVotes.voter_fingerprint],
        set: { vote_type },
      });
  }

  async removeVote(prediction_id: string, fingerprint: string): Promise<void> {
    await db
      .delete(predictionVotes)
      .where(
        and(
          eq(predictionVotes.prediction_id, prediction_id),
          eq(predictionVotes.voter_fingerprint, fingerprint)
        )
      );
  }

  async getVoteCounts(prediction_id: string): Promise<{ likes: number; dislikes: number }> {
    const rows = await db
      .select({ vote_type: predictionVotes.vote_type, cnt: count() })
      .from(predictionVotes)
      .where(eq(predictionVotes.prediction_id, prediction_id))
      .groupBy(predictionVotes.vote_type);

    let likes = 0;
    let dislikes = 0;
    for (const r of rows) {
      if (r.vote_type === "like") likes = Number(r.cnt);
      else if (r.vote_type === "dislike") dislikes = Number(r.cnt);
    }
    return { likes, dislikes };
  }

  async getMyVote(prediction_id: string, fingerprint: string): Promise<"like" | "dislike" | null> {
    const [row] = await db
      .select({ vote_type: predictionVotes.vote_type })
      .from(predictionVotes)
      .where(
        and(
          eq(predictionVotes.prediction_id, prediction_id),
          eq(predictionVotes.voter_fingerprint, fingerprint)
        )
      );
    return (row?.vote_type as "like" | "dislike" | null) ?? null;
  }

  async insertWaitlistEntry(email: string): Promise<Waitlist> {
    const [result] = await db
      .insert(waitlist)
      .values({ email })
      .returning();
    return result;
  }

  async getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined> {
    const [result] = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email));
    return result;
  }
}

export const storage = new DrizzleStorage();
