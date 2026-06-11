import cron from "node-cron";
import { storage } from "../storage";
import { submitToOts, upgradeOtsProof } from "./ots";
import { sendReminderEmail } from "./email";

export function startCronJobs(): void {
  // Poll OTS calendar every 6 hours for pending confirmations
  cron.schedule("0 */6 * * *", async () => {
    console.log("[cron] Starting OTS polling job");
    await pollOtsStatus();
  });

  // Retry pending Arweave uploads every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[cron] Starting Arweave retry job");
    try {
      const { retryPendingUploads } = await import("./arweave");
      const succeeded = await retryPendingUploads();
      console.log(`[cron] Arweave retry: ${succeeded} succeeded`);
    } catch (err) {
      console.error("[cron] Arweave retry error:", err);
    }
  });

  // Send due email reminders every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[cron] Starting email reminder job");
    await sendDueReminders();
  });

  console.log("[cron] Jobs initialized (OTS every 6h, Arweave retry every 1h, reminders every 1h)");
}

export async function pollOtsStatus(): Promise<number> {
  let processed = 0;
  try {
    const pending = await storage.getPendingOts();
    console.log(`[cron] Checking ${pending.length} pending OTS proofs`);

    for (const prediction of pending) {
      // No proof stored (original submission was lost): re-stamp now.
      // The upgrade will be attempted on the next run.
      if (!prediction.ots_proof) {
        const proof = await submitToOts(prediction.hash);
        if (proof) {
          await storage.updateOtsStatus(prediction.id, {
            ots_status: "pending",
            ots_proof: proof,
            ots_stamped_at: new Date(),
          });
          console.log(`[cron] Prediction ${prediction.id} re-stamped (missing proof)`);
          processed++;
        }
        continue;
      }

      // Age is measured from the last calendar submission; legacy rows
      // (stamped before ots_stamped_at existed) fall back to created_at.
      const stampedAt = prediction.ots_stamped_at ?? prediction.created_at!;
      const ageHours =
        (Date.now() - new Date(stampedAt).getTime()) / (1000 * 60 * 60);

      // Bitcoin anchoring takes 1-24h, skip if too fresh
      if (ageHours < 2) continue;

      // Always try the upgrade first: a proof may be confirmable even if old
      const result = await upgradeOtsProof(prediction.ots_proof, prediction.hash);

      if (result.upgraded) {
        await storage.updateOtsStatus(prediction.id, {
          ots_status: "confirmed",
          ots_proof: result.proof,
          bitcoin_block: result.bitcoinBlock,
        });
        console.log(`[cron] Prediction ${prediction.id} OTS confirmed (block ${result.bitcoinBlock ?? "?"})`);
        processed++;
        continue;
      }

      // Still unconfirmed after 7 days since stamping: the calendar likely
      // lost the commitment. Re-stamp once (resets the window) so the proof
      // chain stays alive instead of going dead-pending.
      if (ageHours > 7 * 24) {
        const proof = await submitToOts(prediction.hash);
        if (proof) {
          await storage.updateOtsStatus(prediction.id, {
            ots_status: "pending",
            ots_proof: proof,
            ots_stamped_at: new Date(),
          });
          console.log(`[cron] Prediction ${prediction.id} re-stamped (7d without confirmation)`);
        } else {
          await storage.updateOtsStatus(prediction.id, { ots_status: "failed" });
          console.log(`[cron] Prediction ${prediction.id} OTS failed (7d timeout, re-stamp failed)`);
        }
        processed++;
      }
    }
  } catch (err) {
    console.error("[cron] OTS polling error:", err);
  }
  return processed;
}

async function sendDueReminders(): Promise<void> {
  try {
    const due = await storage.getPendingEmailsDue();
    console.log(`[cron] Sending reminders to ${due.length} recipients`);

    for (const entry of due) {
      const targetYear = new Date(entry.notify_at).getFullYear();
      const ok = await sendReminderEmail({
        email: entry.email,
        targetYear,
        keywords: entry.keywords,
      }).catch(() => false);

      if (ok) {
        await storage.markEmailSent(entry.id);
        console.log(`[cron] Reminder sent for email_queue ${entry.id}`);
      } else {
        await storage.markEmailFailed(entry.id);
        console.log(`[cron] Reminder failed for email_queue ${entry.id}`);
      }
    }
  } catch (err) {
    console.error("[cron] Email reminder error:", err);
  }
}
