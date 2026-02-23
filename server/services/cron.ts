import cron from "node-cron";
import { storage } from "../storage";
import { upgradeOtsProof } from "./ots";

export function startCronJobs(): void {
  // Poll OTS calendar every 6 hours for pending confirmations
  cron.schedule("0 */6 * * *", async () => {
    console.log("[cron] Starting OTS polling job");
    await pollOtsStatus();
  });

  // Send annual email reminders on January 1 at 09:00 UTC
  cron.schedule("0 9 1 1 *", async () => {
    console.log("[cron] Starting annual email reminder job");
    await sendAnnualReminders();
  });

  console.log("[cron] Jobs initialized (OTS every 6h, reminders Jan 1 09:00 UTC)");
}

export async function pollOtsStatus(): Promise<number> {
  let processed = 0;
  try {
    const pending = await storage.getPendingOts();
    console.log(`[cron] Checking ${pending.length} pending OTS proofs`);

    for (const prediction of pending) {
      if (!prediction.ots_proof) continue;

      const ageHours =
        (Date.now() - new Date(prediction.created_at!).getTime()) /
        (1000 * 60 * 60);

      // Bitcoin anchoring takes 1-24h, skip if too fresh
      if (ageHours < 2) continue;

      // Mark as failed after 7 days and trigger re-submission
      if (ageHours > 7 * 24) {
        await storage.updateOtsStatus(prediction.id, { ots_status: "failed" });
        console.log(`[cron] Prediction ${prediction.id} OTS failed (7d timeout)`);
        processed++;
        continue;
      }

      const result = await upgradeOtsProof(
        prediction.ots_proof,
        prediction.hash
      );

      if (result.upgraded) {
        await storage.updateOtsStatus(prediction.id, {
          ots_status: "confirmed",
          ots_proof: result.proof,
        });
        console.log(`[cron] Prediction ${prediction.id} OTS confirmed`);
        processed++;
      }
    }
  } catch (err) {
    console.error("[cron] OTS polling error:", err);
  }
  return processed;
}

async function sendAnnualReminders(): Promise<void> {
  // Privacy-first design: only email_hash is stored, so server-side dispatch
  // is intentionally not supported. Users unlock proactively at target year.
  // To enable email reminders, a separate opt-in mechanism that encrypts
  // the address server-side would be needed.
  console.log("[cron] Annual email reminder job: skipped (privacy mode — email_hash only, no raw address stored)");
}
