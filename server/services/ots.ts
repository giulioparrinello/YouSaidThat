// @ts-ignore — opentimestamps has no TypeScript types
import OpenTimestamps from "opentimestamps";

const CALENDARS = [
  process.env.OTS_CALENDAR_URL_1 ||
    "https://alice.btc.calendar.opentimestamps.org",
  process.env.OTS_CALENDAR_URL_2 ||
    "https://bob.btc.calendar.opentimestamps.org",
];

// ─── Submit hash to OTS calendar servers ──────────────────────────────────────
// Returns base64-encoded incomplete proof from the first successful calendar.
export async function submitToOts(hashHex: string): Promise<string | null> {
  const hashBytes = Buffer.from(hashHex, "hex");

  for (const calendarUrl of CALENDARS) {
    try {
      const response = await fetch(`${calendarUrl}/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: hashBytes,
      });

      if (response.ok) {
        const proofBytes = Buffer.from(await response.arrayBuffer());
        console.log(`[ots] Submitted to ${calendarUrl}: ${proofBytes.length} bytes`);
        return proofBytes.toString("base64");
      }

      console.error(`[ots] ${calendarUrl} returned ${response.status}`);
    } catch (err) {
      console.error(`[ots] Error submitting to ${calendarUrl}:`, err);
    }
  }

  return null;
}

// ─── Try to upgrade a pending OTS proof ───────────────────────────────────────
// Returns the upgraded proof if confirmed, or { upgraded: false } if still pending.
export async function upgradeOtsProof(
  otsProofBase64: string,
  hashHex: string
): Promise<{ upgraded: boolean; proof?: string; bitcoinBlock?: number }> {
  try {
    const proofBytes = Buffer.from(otsProofBase64, "base64");

    // deserialize() accepts a Buffer directly
    const detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes);

    // upgrade() mutates detached and returns a Promise<boolean> (true = upgraded)
    const changed: boolean = await OpenTimestamps.upgrade(detached);

    if (!changed) {
      return { upgraded: false };
    }

    // Serialize the upgraded proof
    const upgradedBytes: Buffer = detached.serializeToBytes();

    // Extract Bitcoin block height from attestations (best-effort)
    let bitcoinBlock: number | undefined;
    try {
      for (const [attest] of detached.timestamp.allAttestations()) {
        if (attest instanceof OpenTimestamps.Notary.BitcoinBlockHeaderAttestation) {
          bitcoinBlock = attest.height;
          break;
        }
      }
    } catch {
      // block extraction is optional
    }

    console.log(`[ots] Proof upgraded for hash ${hashHex.slice(0, 8)}… bitcoin block: ${bitcoinBlock ?? "unknown"}`);
    return { upgraded: true, proof: upgradedBytes.toString("base64"), bitcoinBlock };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ots] upgradeOtsProof error for ${hashHex.slice(0, 8)}…: ${msg}`);
    // Fall back to simple HTTP check on library error
    return simpleOtsCheck(hashHex);
  }
}

// Fallback: check if the calendar has confirmed the timestamp via simple HTTP
async function simpleOtsCheck(
  hashHex: string
): Promise<{ upgraded: boolean; proof?: string }> {
  for (const calendarUrl of CALENDARS) {
    try {
      const response = await fetch(`${calendarUrl}/timestamp/${hashHex}`);
      if (response.ok) {
        const proofBytes = Buffer.from(await response.arrayBuffer());
        return { upgraded: true, proof: proofBytes.toString("base64") };
      }
    } catch {
      // try next calendar
    }
  }
  return { upgraded: false };
}
