// @ts-ignore — opentimestamps has no TypeScript types
import OpenTimestamps from "opentimestamps";

const CALENDARS = [
  process.env.OTS_CALENDAR_URL_1 ||
    "https://alice.btc.calendar.opentimestamps.org",
  process.env.OTS_CALENDAR_URL_2 ||
    "https://bob.btc.calendar.opentimestamps.org",
];

// ─── Submit hash to OTS calendar servers ──────────────────────────────────────
// Creates a proper DetachedTimestampFile using the OTS library and serializes it.
// This produces a valid .ots blob that can later be deserialized and upgraded.
export async function submitToOts(hashHex: string): Promise<string | null> {
  try {
    const hashBytes = Buffer.from(hashHex, "hex");

    // Build a DetachedTimestampFile from the pre-computed SHA-256 hash
    const f = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      hashBytes
    );

    // Stamp: submits the Merkle tip to calendars and merges their response into f
    // m=1 means at least 1 calendar must reply
    await OpenTimestamps.stamp(f, { calendars: CALENDARS, m: 1 });

    // Serialize the full OTS file (can later be deserialised + upgraded).
    // serializeToBytes() returns a plain Uint8Array: it must be wrapped in a
    // Buffer or .toString("base64") silently degrades to comma-joined decimals.
    const otsBytes = Buffer.from(f.serializeToBytes());
    console.log(`[ots] Stamped hash ${hashHex.slice(0, 8)}…: ${otsBytes.length} bytes`);
    return otsBytes.toString("base64");
  } catch (err) {
    console.error("[ots] submitToOts error:", err);
    return null;
  }
}

// Proofs stamped before the Buffer fix above were stored as comma-joined
// decimal bytes ("0,79,112,…") instead of base64. Decode both formats so
// legacy rows can still be upgraded; they get rewritten in base64 on upgrade.
export function decodeStoredProof(stored: string): Buffer {
  if (/^\d{1,3}(,\d{1,3})*$/.test(stored)) {
    return Buffer.from(stored.split(",").map(Number));
  }
  return Buffer.from(stored, "base64");
}

// Extract the Bitcoin block height from a (upgraded) detached timestamp.
// allAttestations() returns a Map of msg → attestation: iterate the values.
export function extractBitcoinBlock(detached: any): number | undefined {
  try {
    for (const attest of detached.timestamp.allAttestations().values()) {
      if (attest instanceof OpenTimestamps.Notary.BitcoinBlockHeaderAttestation) {
        return attest.height;
      }
    }
  } catch {
    // block extraction is optional
  }
  return undefined;
}

// ─── Try to upgrade a pending OTS proof ───────────────────────────────────────
// Returns the upgraded proof if confirmed, or { upgraded: false } if still pending.
export async function upgradeOtsProof(
  otsProofBase64: string,
  hashHex: string
): Promise<{ upgraded: boolean; proof?: string; bitcoinBlock?: number }> {
  try {
    const proofBytes = decodeStoredProof(otsProofBase64);

    // deserialize() accepts a Buffer directly
    const detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes);

    // upgrade() mutates detached and returns a Promise<boolean> (true = upgraded)
    const changed: boolean = await OpenTimestamps.upgrade(detached);

    if (!changed) {
      return { upgraded: false };
    }

    // Serialize the upgraded proof (Uint8Array → Buffer, see submitToOts)
    const upgradedBytes = Buffer.from(detached.serializeToBytes());

    const bitcoinBlock = extractBitcoinBlock(detached);

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
