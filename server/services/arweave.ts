// ─── Arweave permanent storage service ───────────────────────────────────────
// Uploads prediction content directly to Arweave via arweave-js SDK.
// Env vars:
//   ARWEAVE_KEY_JSON — Arweave JWK wallet key (JSON string)
//   ARWEAVE_HOST     — Arweave gateway host (default: arweave.net)

import { storage } from "../storage";

const ARWEAVE_HOST = process.env.ARWEAVE_HOST ?? "arweave.net";
const ARWEAVE_GATEWAY = `https://${ARWEAVE_HOST}`;

export interface ArweaveBalance {
  ar: string;
  winston: string;
}

// ─── Internal helper: get Arweave instance and key ────────────────────────────

async function getArweaveClient() {
  // @ts-ignore — arweave package types
  const ArweaveModule = await import("arweave");
  const Arweave = ArweaveModule.default ?? ArweaveModule;
  return Arweave.init({
    host: ARWEAVE_HOST,
    port: 443,
    protocol: "https",
    timeout: 30000,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWalletKey(): any | null {
  const keyJson = process.env.ARWEAVE_KEY_JSON;
  if (!keyJson) {
    console.log("[arweave] ARWEAVE_KEY_JSON not set — skipping Arweave upload");
    return null;
  }
  try {
    return JSON.parse(keyJson);
  } catch {
    console.error("[arweave] Failed to parse ARWEAVE_KEY_JSON");
    return null;
  }
}

// ─── Upload to Arweave ────────────────────────────────────────────────────────

async function uploadToArweave(
  content: string,
  tags: { name: string; value: string }[]
): Promise<string | null> {
  const key = getWalletKey();
  if (!key) return null;

  try {
    const arweave = await getArweaveClient();

    const tx = await arweave.createTransaction({ data: content }, key);
    tx.addTag("Content-Type", "text/plain");
    for (const tag of tags) {
      tx.addTag(tag.name, tag.value);
    }

    await arweave.transactions.sign(tx, key);
    const response = await arweave.transactions.post(tx);

    if (response.status === 200 || response.status === 202) {
      console.log(`[arweave] Uploaded to Arweave: ${tx.id}`);
      return tx.id as string;
    }

    console.error("[arweave] Upload failed — status:", response.status);
    return null;
  } catch (err) {
    console.error("[arweave] Upload error:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload content to Arweave.
 * Returns TX ID on success, null on failure (caller should set arweave_status='pending').
 */
export async function uploadContent(
  content: string,
  tags: { hash: string; mode: string; targetYear?: string }
): Promise<string | null> {
  const arweaveTags = [
    { name: "App-Name", value: "YouSaidThat" },
    { name: "Hash", value: tags.hash },
    { name: "Mode", value: tags.mode },
    ...(tags.targetYear ? [{ name: "Target-Year", value: tags.targetYear }] : []),
  ];

  return uploadToArweave(content, arweaveTags);
}

/**
 * Get current Arweave wallet balance.
 * Returns { ar: "0", winston: "0" } if not configured.
 */
export async function getArweaveBalance(): Promise<ArweaveBalance> {
  const key = getWalletKey();
  if (!key) {
    return { ar: "N/A (not configured)", winston: "0" };
  }

  try {
    const arweave = await getArweaveClient();
    const address = await arweave.wallets.jwkToAddress(key);
    const winston = await arweave.wallets.getBalance(address);
    const ar = arweave.ar.winstonToAr(winston);
    return { ar, winston };
  } catch (err) {
    console.error("[arweave] Failed to get balance:", err);
    return { ar: "error", winston: "error" };
  }
}

/**
 * Derive the Arweave wallet address from the configured JWK.
 * Returns null if ARWEAVE_KEY_JSON is not set.
 */
export async function getArweaveAddress(): Promise<string | null> {
  const key = getWalletKey();
  if (!key) return null;
  try {
    const arweave = await getArweaveClient();
    return await arweave.wallets.jwkToAddress(key);
  } catch (err) {
    console.error("[arweave] Failed to derive address:", err);
    return null;
  }
}

/**
 * Retry all predictions with arweave_status='pending'.
 * Marks as failed after 7 days.
 * Returns number of successfully uploaded.
 */
export async function retryPendingUploads(): Promise<number> {
  let succeeded = 0;
  try {
    const pending = await storage.getPendingArweaveUploads();
    console.log(`[arweave] Retrying ${pending.length} pending uploads`);

    for (const prediction of pending) {
      const content = prediction.content ?? prediction.content_encrypted;
      if (!content) {
        await storage.updateArweaveStatus(prediction.id, {
          arweave_status: "failed",
        });
        continue;
      }

      // Mark failed after 7 days
      const ageHours =
        (Date.now() - new Date(prediction.created_at!).getTime()) /
        (1000 * 60 * 60);
      if (ageHours > 7 * 24) {
        await storage.updateArweaveStatus(prediction.id, {
          arweave_status: "failed",
        });
        console.log(`[arweave] Prediction ${prediction.id} failed (7d timeout)`);
        continue;
      }

      const txId = await uploadContent(content, {
        hash: prediction.hash,
        mode: prediction.mode,
        targetYear: prediction.target_year ? String(prediction.target_year) : undefined,
      });

      if (txId) {
        await storage.updateArweaveStatus(prediction.id, {
          arweave_tx_id: txId,
          arweave_status: "confirmed",
        });
        succeeded++;
        console.log(`[arweave] Retry succeeded for prediction ${prediction.id}: ${txId}`);
      }
    }
  } catch (err) {
    console.error("[arweave] retryPendingUploads error:", err);
  }
  return succeeded;
}

/** Returns the public Arweave URL for a given TX ID. */
export function arweaveUrl(txId: string): string {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}
