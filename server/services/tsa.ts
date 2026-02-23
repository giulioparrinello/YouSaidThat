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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function requestTsaToken(hashHex: string): Promise<string | null> {
  const tsaUrl =
    process.env.TSA_URL || "https://tsa.actalis.it/TSA/tss-usr-gen";

  try {
    const body = buildTsaRequest(hashHex);

    const response = await fetch(tsaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/timestamp-query",
        Accept: "application/timestamp-reply",
      },
      body,
    });

    if (!response.ok) {
      console.error(`[tsa] Request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.toString("base64");
  } catch (err) {
    console.error(`[tsa] Error:`, err);
    return null;
  }
}
