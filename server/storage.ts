import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  predictions,
  attestations,
  email_queue,
  waitlist,
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
    emailQueueData?: Pick<InsertEmailQueue, "email_hash" | "target_year" | "keywords">
  ): Promise<Prediction>;
  getPredictionByHash(hash: string): Promise<Prediction | undefined>;
  getPredictionById(id: string): Promise<Prediction | undefined>;
  getPublicPredictions(opts: {
    page: number;
    limit: number;
    keyword?: string;
    year?: number;
    mode?: string;
  }): Promise<{ predictions: Prediction[]; total: number }>;
  updateOtsStatus(
    id: string,
    data: { ots_status: string; ots_proof?: string; bitcoin_block?: number }
  ): Promise<void>;
  getPendingOts(): Promise<Prediction[]>;

  // Attestations
  insertAttestation(data: InsertAttestation): Promise<Attestation>;
  getAttestationByPredictionId(
    prediction_id: string
  ): Promise<Attestation | undefined>;
  getAttestationById(id: string): Promise<Attestation | undefined>;

  // Email queue
  insertEmailQueue(data: InsertEmailQueue): Promise<EmailQueue>;
  getPendingEmailsForYear(year: number): Promise<EmailQueue[]>;
  markEmailSent(id: string): Promise<void>;
  markEmailFailed(id: string): Promise<void>;

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
    emailQueueData?: Pick<InsertEmailQueue, "email_hash" | "target_year" | "keywords">
  ): Promise<Prediction> {
    return db.transaction(async (tx) => {
      const [prediction] = await tx
        .insert(predictions)
        .values(predictionData)
        .returning();

      if (emailQueueData) {
        await tx.insert(email_queue).values({
          ...emailQueueData,
          status: "pending",
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
    mode?: string;
  }): Promise<{ predictions: Prediction[]; total: number }> {
    const { page, limit, keyword, year, mode } = opts;
    const offset = (page - 1) * limit;

    const conditions = [eq(predictions.is_public, true)];
    if (mode) conditions.push(eq(predictions.mode, mode));
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

  async getPendingEmailsForYear(year: number): Promise<EmailQueue[]> {
    return db
      .select()
      .from(email_queue)
      .where(
        and(eq(email_queue.target_year, year), eq(email_queue.status, "pending"))
      );
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
