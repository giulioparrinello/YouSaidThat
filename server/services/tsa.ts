import { randomBytes } from "crypto";

// ─── DER encoding helpers ─────────────────────────────────────────────────────

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  const bytes: number[] = [];
  let l = len;
  while (l > 0) { bytes.unshift(l & 0xff); l >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTLV(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

const derSequence   = (v: Buffer) => derTLV(0x30, v);
const derOctetStr   = (v: Buffer) => derTLV(0x04, v);
const derBoolean    = (v: boolean) => Buffer.from([0x01, 0x01, v ? 0xff : 0x00]);

function derInteger(v: Buffer): Buffer {
  // Prepend 0x00 if high bit set to avoid negative DER interpretation
  const data = v[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), v]) : v;
  return derTLV(0x02, data);
}

// SHA-256 AlgorithmIdentifier in DER: OID 2.16.840.1.101.3.4.2.1 + NULL
const SHA256_ALG_ID = derSequence(
  Buffer.concat([
    Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]),
    Buffer.from([0x05, 0x00]),
  ])
);

function buildTsaRequest(hashHex: string): Buffer {
  const hashBytes = Buffer.from(hashHex, "hex");

  const messageImprint = derSequence(
    Buffer.concat([SHA256_ALG_ID, derOctetStr(hashBytes)])
  );

  return derSequence(
    Buffer.concat([
      derInteger(Buffer.from([0x01])),   // version = 1
      messageImprint,
      derInteger(randomBytes(8)),         // nonce
      derBoolean(true),                   // certReq = TRUE
    ])
  );
}

// ─── TSA providers (tried in order) ──────────────────────────────────────────
const TSA_PROVIDERS = [
  process.env.TSA_URL || "https://tsa.actalis.it/TSA/tss-usr-gen",
  "https://freetsa.org/tsr",
  "https://timestamp.sectigo.com",
];

async function tryOneTsa(tsaUrl: string, hashHex: string): Promise<string | null> {
  const body = buildTsaRequest(hashHex);
  const response = await fetch(tsaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/timestamp-query",
      Accept: "application/timestamp-reply",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.warn(`[tsa] ${tsaUrl} returned ${response.status} ${response.statusText}`);
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  // A valid TSA response must be at least 100 bytes (PKIStatusInfo + token)
  if (bytes.length < 100) {
    console.warn(`[tsa] ${tsaUrl} returned suspiciously small response (${bytes.length} bytes)`);
    return null;
  }
  return bytes.toString("base64");
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Tries each TSA provider in sequence with retries. Returns null only if
// ALL providers fail — in that case the caller should log a warning but
// can still proceed (OTS Bitcoin anchoring remains as backup proof).

export async function requestTsaToken(hashHex: string): Promise<string | null> {
  for (const tsaUrl of TSA_PROVIDERS) {
    // Retry each provider up to 3 times before moving to the next
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const token = await tryOneTsa(tsaUrl, hashHex);
        if (token) {
          console.log(`[tsa] Got token from ${tsaUrl} (attempt ${attempt})`);
          return token;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[tsa] ${tsaUrl} attempt ${attempt} error: ${msg}`);
      }

      if (attempt < 3) {
        // Exponential back-off: 500ms, 1s
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }
  }

  console.error("[tsa] All TSA providers failed — registering without TSA token (OTS will serve as backup)");
  return null;
}
