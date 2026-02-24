import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { webcrypto, randomUUID } from "crypto";
import DOMPurify from "isomorphic-dompurify";
import { storage } from "./storage";
import { requestTsaToken } from "./services/tsa";
import { submitToOts } from "./services/ots";
import { uploadContent, getArweaveBalance } from "./services/arweave";
import {
  registerPredictionSchema,
  claimPredictionSchema,
  waitlistSchema,
} from "../shared/schema";
import {
  registerLimiter,
  claimLimiter,
  getLimiter,
} from "./middleware/rateLimiter";
import { sendWaitlistConfirmationEmail } from "./services/email";
import type { ZodError } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zodMsg(err: ZodError): string {
  return err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
}

// Verify RSA-PSS signature: backend mirrors client-side WebCrypto parameters
async function verifyRsaPssSignature(
  hash: string,
  publicKeyPem: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const { subtle } = webcrypto;

    const keyBase64 = publicKeyPem
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s/g, "");
    const keyBuffer = Buffer.from(keyBase64, "base64");

    const publicKey = await subtle.importKey(
      "spki",
      keyBuffer,
      { name: "RSA-PSS", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(hash); // hash as UTF-8 bytes
    const signature = Buffer.from(signatureBase64, "base64");

    return await subtle.verify(
      { name: "RSA-PSS", saltLength: 32 },
      publicKey,
      signature,
      data
    );
  } catch {
    return false;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // GET /health
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // POST /api/predictions/register
  app.post(
    "/api/predictions/register",
    registerLimiter,
    async (req: Request, res: Response) => {
      const parsed = registerPredictionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: zodMsg(parsed.error) });
      }

      const { hash, mode, target_year, keywords, email_hash, is_public, content, content_encrypted } =
        parsed.data;

      // Idempotent: if this hash was already registered, return existing record
      const existing = await storage.getPredictionByHash(hash);
      if (existing) {
        return res.status(200).json({
          prediction_id: existing.id,
          hash: existing.hash,
          mode: existing.mode,
          ots_status: existing.ots_status,
          tsa_token: existing.tsa_token,
          created_at: existing.created_at,
          arweave_tx_id: existing.arweave_tx_id,
          arweave_status: existing.arweave_status,
        });
      }

      // RFC 3161 TSA token — synchronous, immediate proof of existence
      const tsaToken = await requestTsaToken(hash).catch(() => null);

      // Atomically insert prediction + optional email queue entry
      // email_hash is pre-computed client-side (SHA-256 of lowercase-trimmed email)
      const emailQueueData = email_hash
        ? {
            email_hash,
            target_year,
            keywords: keywords ?? null,
          }
        : undefined;

      // Determine arweave_status: only attempt upload if there's content to store
      const hasArweaveContent = !!(content || content_encrypted);

      const prediction = await storage.registerPredictionWithEmail(
        {
          hash,
          mode,
          target_year,
          keywords: keywords ?? null,
          ots_status: "pending",
          ots_proof: null,
          tsa_token: tsaToken,
          is_public,
          content: content ?? null,
          content_encrypted: content_encrypted ?? null,
          arweave_status: hasArweaveContent ? "pending" : "none",
        },
        emailQueueData
      );

      // OTS submission — async, Bitcoin anchoring happens in background
      submitToOts(hash)
        .then(async (otsProof) => {
          if (otsProof) {
            await storage.updateOtsStatus(prediction.id, {
              ots_status: "pending",
              ots_proof: otsProof,
            });
          }
        })
        .catch((err) => console.error("[routes] OTS submission error:", err));

      // Arweave upload — async fire-and-forget, only if content present
      if (hasArweaveContent) {
        const uploadPayload = content ?? content_encrypted!;
        uploadContent(uploadPayload, {
          hash,
          mode,
          targetYear: String(target_year),
        })
          .then(async (txId) => {
            if (txId) {
              await storage.updateArweaveStatus(prediction.id, {
                arweave_tx_id: txId,
                arweave_status: "confirmed",
              });
            }
            // If null, stays 'pending' and will be retried by cron
          })
          .catch((err) => console.error("[routes] Arweave upload error:", err));
      }

      return res.status(201).json({
        prediction_id: prediction.id,
        hash: prediction.hash,
        mode: prediction.mode,
        ots_status: prediction.ots_status,
        tsa_token: prediction.tsa_token,
        created_at: prediction.created_at,
        arweave_tx_id: prediction.arweave_tx_id,
        arweave_status: prediction.arweave_status,
      });
    }
  );

  // GET /api/predictions/public
  // Only Mode 1 (proof_of_existence) predictions with is_public=true appear here
  app.get(
    "/api/predictions/public",
    getLimiter,
    async (req: Request, res: Response) => {
      const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
      const limit = Math.min(
        50,
        Math.max(1, parseInt((req.query.limit as string) ?? "20", 10))
      );
      const keyword = req.query.keyword as string | undefined;
      const year = req.query.year
        ? parseInt(req.query.year as string, 10)
        : undefined;

      const { predictions, total } = await storage.getPublicPredictions({
        page,
        limit,
        keyword,
        year,
        mode: "proof_of_existence",
      });

      const sanitized = predictions.map((p) => ({
        id: p.id,
        hash_preview: p.hash.slice(0, 8),
        target_year: p.target_year,
        keywords: p.keywords,
        mode: p.mode,
        ots_status: p.ots_status,
        created_at: p.created_at,
        content: p.content ?? null,
        arweave_tx_id: p.arweave_tx_id ?? null,
        arweave_status: p.arweave_status,
      }));

      return res.json({ predictions: sanitized, total, page, limit });
    }
  );

  // GET /api/predictions/verify?hash=<64hex>
  app.get(
    "/api/predictions/verify",
    getLimiter,
    async (req: Request, res: Response) => {
      const hash = req.query.hash as string;

      if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
        return res
          .status(400)
          .json({ message: "hash must be 64 lowercase hex characters" });
      }

      const prediction = await storage.getPredictionByHash(hash);
      if (!prediction) {
        return res.json({ found: false });
      }

      return res.json({
        found: true,
        prediction_id: prediction.id,
        hash: prediction.hash,
        mode: prediction.mode,
        target_year: prediction.target_year,
        keywords: prediction.keywords,
        ots_confirmed: prediction.ots_status === "confirmed",
        ots_status: prediction.ots_status,
        bitcoin_block: prediction.bitcoin_block,
        timestamp_utc: prediction.timestamp_utc,
        tsa_token: prediction.tsa_token,
        ots_proof: prediction.ots_proof,
        content: prediction.content ?? null,
        arweave_tx_id: prediction.arweave_tx_id ?? null,
        arweave_status: prediction.arweave_status,
      });
    }
  );

  // GET /api/predictions/:id
  app.get(
    "/api/predictions/:id",
    getLimiter,
    async (req: Request, res: Response) => {
      const prediction = await storage.getPredictionById(req.params.id as string);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      return res.json({
        id: prediction.id,
        hash: prediction.hash,
        mode: prediction.mode,
        target_year: prediction.target_year,
        keywords: prediction.keywords,
        ots_status: prediction.ots_status,
        bitcoin_block: prediction.bitcoin_block,
        timestamp_utc: prediction.timestamp_utc,
        tsa_token: prediction.tsa_token,
        ots_proof: prediction.ots_proof,
        is_public: prediction.is_public,
        created_at: prediction.created_at,
      });
    }
  );

  // GET /api/predictions/:id/ots-status
  app.get(
    "/api/predictions/:id/ots-status",
    getLimiter,
    async (req: Request, res: Response) => {
      const prediction = await storage.getPredictionById(req.params.id as string);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      return res.json({
        prediction_id: prediction.id,
        ots_status: prediction.ots_status,
        bitcoin_block: prediction.bitcoin_block,
        ots_proof: prediction.ots_proof,
      });
    }
  );

  // POST /api/predictions/claim
  app.post(
    "/api/predictions/claim",
    claimLimiter,
    async (req: Request, res: Response) => {
      const parsed = claimPredictionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: zodMsg(parsed.error) });
      }

      const { hash, public_key, signature, display_name } = parsed.data;

      const prediction = await storage.getPredictionByHash(hash);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      // Server-side year gate (cryptographic enforcement)
      const currentYear = new Date().getFullYear();
      if (currentYear < prediction.target_year) {
        return res.status(403).json({
          message: `This prediction cannot be claimed until ${prediction.target_year}`,
        });
      }

      // One claim per prediction
      const existing = await storage.getAttestationByPredictionId(
        prediction.id
      );
      if (existing) {
        return res
          .status(409)
          .json({ message: "This prediction already has an attestation" });
      }

      // Validate PEM format
      if (!public_key.includes("-----BEGIN PUBLIC KEY-----")) {
        return res.status(400).json({ message: "Invalid public key format" });
      }

      // Verify RSA-PSS signature
      const valid = await verifyRsaPssSignature(hash, public_key, signature);
      if (!valid) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      // Sanitize display_name — strip all HTML tags and attributes
      const sanitizedName = DOMPurify.sanitize(display_name.slice(0, 100), {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });

      // Pre-generate the ID so the URL can be included on first insert
      const attestationId = randomUUID();
      const attestationUrl = `https://yousaidthat.org/attestation/${attestationId}`;

      const attestation = await storage.insertAttestation({
        id: attestationId,
        prediction_id: prediction.id,
        display_name: sanitizedName,
        public_key,
        signature,
        attestation_url: attestationUrl,
      });

      return res.status(201).json({
        attestation_id: attestation.id,
        attestation_url: attestationUrl,
        display_name: attestation.display_name,
        hash: prediction.hash,
        timestamp_verified: prediction.timestamp_utc,
        bitcoin_block: prediction.bitcoin_block,
      });
    }
  );

  // GET /api/attestations/:id
  // Returns full attestation data for the public attestation page
  app.get(
    "/api/attestations/:id",
    getLimiter,
    async (req: Request, res: Response) => {
      const attestation = await storage.getAttestationById(req.params.id as string);
      if (!attestation) {
        return res.status(404).json({ message: "Attestation not found" });
      }

      const prediction = await storage.getPredictionById(attestation.prediction_id);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      return res.json({
        attestation_id: attestation.id,
        display_name: attestation.display_name,
        attestation_url: attestation.attestation_url,
        created_at: attestation.created_at,
        prediction: {
          id: prediction.id,
          hash: prediction.hash,
          mode: prediction.mode,
          target_year: prediction.target_year,
          keywords: prediction.keywords,
          ots_status: prediction.ots_status,
          bitcoin_block: prediction.bitcoin_block,
          timestamp_utc: prediction.timestamp_utc,
          tsa_token: prediction.tsa_token,
        },
      });
    }
  );

  // ─── Admin endpoints (protected by ADMIN_SECRET header) ─────────────────────

  function checkAdminSecret(req: Request, res: Response): boolean {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      res.status(503).json({ error: "Admin not configured (ADMIN_SECRET not set)" });
      return false;
    }
    if (req.headers["x-admin-secret"] !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }

  // GET /api/admin/stats
  app.get("/api/admin/stats", getLimiter, async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;
    try {
      const stats = await storage.getAdminStats();
      const balance = await getArweaveBalance();
      return res.json({ ...stats, arweaveBalance: balance });
    } catch (err) {
      console.error("[admin/stats] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/admin/arweave-balance
  app.get("/api/admin/arweave-balance", getLimiter, async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;
    try {
      const balance = await getArweaveBalance();
      return res.json(balance);
    } catch (err) {
      console.error("[admin/arweave-balance] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // POST /api/admin/retry-arweave/:id
  app.post("/api/admin/retry-arweave/:id", getLimiter, async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;
    try {
      const prediction = await storage.getPredictionById(req.params.id as string);
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }

      const content = prediction.content ?? prediction.content_encrypted;
      if (!content) {
        return res.status(400).json({ error: "No content to upload for this prediction" });
      }

      const txId = await uploadContent(content, {
        hash: prediction.hash,
        mode: prediction.mode,
        targetYear: String(prediction.target_year),
      });

      if (txId) {
        await storage.updateArweaveStatus(prediction.id, {
          arweave_tx_id: txId,
          arweave_status: "confirmed",
        });
        return res.json({ ok: true, arweave_tx_id: txId });
      } else {
        return res.json({ ok: false, message: "Upload failed — will retry via cron" });
      }
    } catch (err) {
      console.error("[admin/retry-arweave] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/admin/pending-arweave
  app.get("/api/admin/pending-arweave", getLimiter, async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;
    try {
      const pending = await storage.getPendingArweaveUploads();
      const sanitized = pending.map((p) => ({
        id: p.id,
        hash: p.hash.slice(0, 8) + "…",
        mode: p.mode,
        target_year: p.target_year,
        arweave_status: p.arweave_status,
        created_at: p.created_at,
      }));
      return res.json({ predictions: sanitized, total: sanitized.length });
    } catch (err) {
      console.error("[admin/pending-arweave] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/cron/arweave-retry
  // Called by Vercel Cron every hour. Protected by CRON_SECRET.
  app.get("/api/cron/arweave-retry", async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { retryPendingUploads } = await import("./services/arweave");
      const succeeded = await retryPendingUploads();
      return res.json({ ok: true, succeeded });
    } catch (err) {
      console.error("[cron/arweave-retry] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/cron/ots-poll
  // Called by Vercel Cron every 6h. Protected by CRON_SECRET.
  app.get("/api/cron/ots-poll", async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { pollOtsStatus } = await import("./services/cron");
      const processed = await pollOtsStatus();
      return res.json({ ok: true, processed });
    } catch (err) {
      console.error("[cron/ots-poll] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // POST /api/waitlist
  app.post(
    "/api/waitlist",
    registerLimiter,
    async (req: Request, res: Response) => {
      const parsed = waitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: zodMsg(parsed.error) });
      }

      const { email } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      // Idempotent: already on the list → silent success (no info leak)
      const existing = await storage.getWaitlistEntryByEmail(normalizedEmail);
      if (existing) {
        return res.status(200).json({ message: "You're already on the list." });
      }

      await storage.insertWaitlistEntry(normalizedEmail);

      // Fire-and-forget — don't block the response on email delivery
      sendWaitlistConfirmationEmail(normalizedEmail).catch((err) =>
        console.error("[waitlist] Email error:", err)
      );

      return res.status(201).json({ message: "You're on the list." });
    }
  );

  return httpServer;
}
