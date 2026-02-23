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
// Returns the upgraded proof if confirmed, or null if still pending.
export async function upgradeOtsProof(
  otsProofBase64: string,
  hashHex: string
): Promise<{ upgraded: boolean; proof?: string }> {
  // Try to dynamically load the opentimestamps library (optional dependency)
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const OpenTimestamps = require("opentimestamps") as any;

    const proofBytes = new Uint8Array(Buffer.from(otsProofBase64, "base64"));
    const ctx = new OpenTimestamps.Context.StreamDeserializationContext(proofBytes);
    const detached = OpenTimestamps.DetachedTimestampFile.deserialize(ctx);

    await OpenTimestamps.upgrade(detached);

    const upgradedBytes = Buffer.from(detached.serializeToBytes());
    // If the proof grew, it was upgraded with Bitcoin attestation
    if (upgradedBytes.length > proofBytes.length) {
      return { upgraded: true, proof: upgradedBytes.toString("base64") };
    }

    return { upgraded: false };
  } catch {
    // Library not available — fall back to simple calendar HTTP check
    return simpleOtsCheck(hashHex);
  }
}

// Fallback: check if the calendar has confirmed the timestamp via simple HTTP
async function simpleOtsCheck(
  hashHex: string
): Promise<{ upgraded: boolean; proof?: string }> {
  for (const calendarUrl of CALENDARS) {
    try {
      const response = await fetch(
        `${calendarUrl}/timestamp/${hashHex}`
      );
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
