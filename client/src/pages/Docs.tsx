import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

// ─── Sidebar definition ───────────────────────────────────────────────────────

interface SidebarItem {
  id: string;
  label: string;
  child?: boolean;
  group?: boolean;
}

const SIDEBAR: SidebarItem[] = [
  { id: "introduction", label: "Introduction" },
  { id: "protocol-overview", label: "Protocol Overview" },
  { id: "crypto", label: "Cryptographic Primitives", group: true },
  { id: "crypto-sha256", label: "SHA-256", child: true },
  { id: "crypto-drand", label: "drand IBE Timelock", child: true },
  { id: "crypto-rsa", label: "RSA-PSS", child: true },
  { id: "crypto-aes", label: "AES-256-GCM (Legacy)", child: true },
  { id: "capsule", label: "Capsule Format", group: true },
  { id: "capsule-v2", label: "v2 — Current", child: true },
  { id: "capsule-v1", label: "v1 — Legacy", child: true },
  { id: "verification", label: "Independent Verification" },
  { id: "api", label: "API Reference", group: true },
  { id: "api-register", label: "POST /register", child: true },
  { id: "api-public", label: "GET /public", child: true },
  { id: "api-verify", label: "GET /verify", child: true },
  { id: "api-reveal", label: "POST /:id/reveal", child: true },
  { id: "api-claim", label: "POST /claim", child: true },
  { id: "api-attestation", label: "GET /attestations/:id", child: true },
  { id: "open-source", label: "Open Source" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-[#111111] text-[#d4d4d4] rounded-2xl px-5 py-4 text-[11px] font-mono overflow-x-auto leading-relaxed my-4 border border-[#1e1e1e]">
      <code>{children.trim()}</code>
    </pre>
  );
}

function IC({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] bg-[#F0F0F0] text-[#111] px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function MethodTag({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
        method === "POST"
          ? "text-[#6366F1] bg-[#6366F1]/10 border-[#6366F1]/20"
          : "text-green-600 bg-green-50 border-green-100"
      }`}
    >
      {method}
    </span>
  );
}

function ApiCard({
  method,
  path,
  description,
  request,
  response,
  notes,
}: {
  method: "GET" | "POST";
  path: string;
  description: string;
  request?: string;
  response: string;
  notes?: string;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-2xl overflow-hidden my-6">
      <div className="bg-[#FAFAFA] px-5 py-3 flex items-center gap-3 border-b border-[#E5E5E5]">
        <MethodTag method={method} />
        <span className="font-mono text-sm text-[#111]">{path}</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-[#555] leading-relaxed">{description}</p>
        {request && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] mb-1">
              Request body
            </p>
            <Code>{request}</Code>
          </div>
        )}
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] mb-1">
            Response
          </p>
          <Code>{response}</Code>
        </div>
        {notes && (
          <p className="text-xs text-[#888] leading-relaxed border-t border-[#F0F0F0] pt-3">
            {notes}
          </p>
        )}
      </div>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      data-section={id}
      className="scroll-mt-24 text-2xl font-bold tracking-tight text-[#111] mb-4 pt-12 first:pt-0"
    >
      {children}
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      data-section={id}
      className="scroll-mt-24 text-base font-semibold tracking-tight text-[#111] mb-3 pt-8"
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[#555] leading-relaxed mb-3">{children}</p>
  );
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-[#555]">
          <span className="text-[#6366F1] mt-0.5 shrink-0">—</span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Divider() {
  return <div className="h-px bg-[#F0F0F0] my-8" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Docs() {
  const [active, setActive] = useState("introduction");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>("[data-section]");
      let current = "introduction";
      sections.forEach((el) => {
        if (el.getBoundingClientRect().top <= 100) {
          current = el.getAttribute("data-section") ?? current;
        }
      });
      setActive(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans">
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-sm border-b border-[#E5E5E5] px-8 py-4 flex justify-between items-center">
        <Link href="/">
          <span className="font-semibold text-base text-[#111111] tracking-tight cursor-pointer">
            yousaidthat.org
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/security-audit">
            <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
              Security
            </span>
          </Link>
          <Link href="/verify">
            <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
              Verify
            </span>
          </Link>
          <Link href="/create">
            <button className="h-8 px-4 rounded-full bg-[#111111] text-white text-xs font-semibold hover:bg-[#222] transition-colors">
              Create
            </button>
          </Link>
        </div>
      </nav>

      {/* ─── Body ─── */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex gap-12 py-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#999] mb-4 px-2">
              Documentation
            </p>
            {SIDEBAR.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2
                    ${item.child ? "pl-5" : ""}
                    ${
                      isActive
                        ? "text-[#6366F1] bg-[#6366F1]/5 font-medium"
                        : item.group
                        ? "text-[#111] font-semibold hover:text-[#6366F1]"
                        : "text-[#666] hover:text-[#111]"
                    }`}
                >
                  {isActive && !item.group && (
                    <span className="w-1 h-1 rounded-full bg-[#6366F1] shrink-0" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <article className="flex-1 min-w-0 max-w-3xl">

          {/* ─── Introduction ─────────────────────────────────────────────── */}
          <H2 id="introduction">Introduction</H2>
          <P>
            YouSaidThat is an open protocol for cryptographically anchoring
            statements to time. SHA-256 hashes are submitted to the Bitcoin
            blockchain via OpenTimestamps and timestamped with an RFC 3161 TSA
            token. For Sealed Predictions, content is encrypted client-side
            using drand IBE timelock before any data is sent to the server.
          </P>
          <P>
            This documentation covers the wire protocol, the{" "}
            <IC>.capsule</IC> file format, cryptographic primitives, and how
            to verify any proof without depending on our servers. The source
            code is available on{" "}
            <a
              href="https://github.com/giulioparrinello/teaserYST"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6366F1] hover:underline inline-flex items-center gap-0.5"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
            .
          </P>

          <Divider />

          {/* ─── Protocol Overview ────────────────────────────────────────── */}
          <H2 id="protocol-overview">Protocol Overview</H2>
          <P>Two modes are available at creation time:</P>
          <UL
            items={[
              <>
                <strong>Proof of Existence</strong> — cleartext or
                AES-encrypted content. The SHA-256 hash is anchored to
                Bitcoin. Cleartext predictions are also uploaded to Arweave for
                permanent, censorship-resistant storage.
              </>,
              <>
                <strong>Sealed Prediction</strong> — content is encrypted
                locally using drand IBE timelock before the hash is sent to
                the server. The decryption key does not exist until drand
                publishes the target round beacon. The server never sees the
                plaintext.
              </>,
            ]}
          />
          <P>
            In both cases the server receives only a SHA-256 hash, optional
            metadata (keywords, target year, mode), and the drand ciphertext
            for sealed predictions. No plaintext, no private keys.
          </P>

          <P>Flow for Sealed Prediction:</P>
          <Code>{`
User writes text
  ↓
SHA-256(utf8(text)) → hash                 [client]
tlockEncrypt(text, targetRound) → ct       [client, tlock-js]
  ↓
POST /api/predictions/register
  { hash, mode: "sealed_prediction", drand_round, target_datetime, ... }
  ↓
Server: OTS submit (Bitcoin calendars)     [async]
Server: RFC 3161 TSA token                 [sync, returned immediately]
  ↓
Response: { prediction_id, tsa_token, ... }
  ↓
.capsule file written and downloaded       [client]
          `}</Code>

          <P>Flow for Proof of Existence (cleartext):</P>
          <Code>{`
User writes text
  ↓
SHA-256(utf8(text)) → hash                 [client]
  ↓
POST /api/predictions/register
  { hash, mode: "proof_of_existence", content, is_public: true, ... }
  ↓
Server: OTS submit                         [async]
Server: RFC 3161 TSA token                 [sync]
Server: Arweave upload                     [async]
  ↓
Response: { prediction_id, tsa_token, arweave_tx_id, ... }
          `}</Code>

          <Divider />

          {/* ─── Cryptographic Primitives ─────────────────────────────────── */}
          <H2 id="crypto">Cryptographic Primitives</H2>
          <P>
            All client-side operations use the browser's native{" "}
            <IC>WebCrypto</IC> API (
            <IC>window.crypto.subtle</IC>) or{" "}
            <IC>tlock-js</IC>. Nothing is implemented from scratch.
          </P>

          <H3 id="crypto-sha256">SHA-256</H3>
          <P>
            SHA-256 is the canonical content identifier throughout the system.
            It is computed over the UTF-8 encoded plaintext with no padding or
            normalization beyond what the browser's{" "}
            <IC>TextEncoder</IC> applies.
          </P>
          <Code>{`
const data = new TextEncoder().encode(plaintext);
const buf  = await crypto.subtle.digest("SHA-256", data);
const hex  = Array.from(new Uint8Array(buf))
               .map(b => b.toString(16).padStart(2, "0"))
               .join("");
// → 64 lowercase hex characters
          `}</Code>
          <P>
            The hash is stored server-side, submitted to OTS calendars, and
            included in the TSA query. To verify a capsule independently:{" "}
            <IC>sha256sum</IC> the plaintext (UTF-8, no trailing newline) and
            compare against the <IC>hash</IC> field.
          </P>

          <H3 id="crypto-drand">drand IBE Timelock</H3>
          <P>
            Sealed Predictions use Identity-Based Encryption (IBE) over
            BLS12-381, implemented by{" "}
            <a
              href="https://github.com/drand/tlock-js"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6366F1] hover:underline"
            >
              tlock-js
            </a>{" "}
            v0.9.0. The ciphertext can only be decrypted after drand publishes
            the beacon for the target round — this is a mathematical guarantee,
            not a policy.
          </P>

          <P>Chain parameters (quicknet):</P>
          <Code>{`
Chain hash : 52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
Genesis    : 1692803367 Unix seconds  (2023-08-23T15:09:27Z)
Period     : 3 seconds
Scheme     : pedersen-bls-unchained-on-g1
API        : https://api.drand.sh/<chain_hash>
          `}</Code>

          <P>Round computation:</P>
          <Code>{`
// targetMs = target datetime in milliseconds
const genesisMs = 1692803367 * 1000;
const periodMs  = 3000;

const round = Math.floor((targetMs - genesisMs) / periodMs) + 1;

// Example: 2030-01-01T00:00:00Z → round 66884212
          `}</Code>

          <P>
            Encryption does not require a network call. Decryption requires
            fetching the beacon from the drand network — this call goes
            directly from the browser to{" "}
            <IC>api.drand.sh</IC>, never through our servers.
          </P>

          <P>
            The quicknet network is operated by EPFL, Cloudflare, Protocol
            Labs, University of Chile, and Kudelski Security. Compromising a
            timelock requires colluding with all participants simultaneously.
          </P>

          <H3 id="crypto-rsa">RSA-PSS</H3>
          <P>
            An RSA-PSS 2048-bit keypair is generated at creation time and
            stored in the <IC>.capsule</IC> file. The public key is registered
            server-side. The private key is never transmitted and exists only
            locally.
          </P>
          <Code>{`
Algorithm   : RSA-PSS
Modulus     : 2048 bits
Public exp  : 65537 (0x010001)
Hash        : SHA-256
Salt length : 32 bytes
Public key  : SPKI, PEM  (-----BEGIN PUBLIC KEY-----)
Private key : PKCS8, PEM (-----BEGIN PRIVATE KEY-----)
          `}</Code>
          <P>
            The keypair is used exclusively for attestation claims. When
            claiming authorship, the user signs the prediction hash with the
            private key. The server verifies the signature against the stored
            public key and mints an attestation record.
          </P>
          <Code>{`
// Signing (WebCrypto)
const sig = await crypto.subtle.sign(
  { name: "RSA-PSS", saltLength: 32 },
  privateKey,                         // CryptoKey, from PKCS8 PEM
  new TextEncoder().encode(hash)      // UTF-8 encoded 64-char hex string
);
          `}</Code>

          <H3 id="crypto-aes">AES-256-GCM (Legacy)</H3>
          <P>
            Used in capsule v1 for Proof of Existence (Encrypted sub-mode). A
            256-bit key and 12-byte random IV are generated per prediction;
            both are stored in the <IC>.capsule</IC> file alongside the
            ciphertext.
          </P>
          <P>
            Security model: client-side privacy against server breach. The
            capsule file is simultaneously the lock and the key — losing it
            means losing access to the plaintext permanently. New predictions
            use drand tlock instead.
          </P>
          <Code>{`
Key  : 256-bit AES, randomly generated, exported as raw base64
Nonce: 12-byte random (crypto.getRandomValues), base64
Mode : AES-256-GCM (authenticated encryption with 128-bit tag)
          `}</Code>

          <Divider />

          {/* ─── Capsule Format ───────────────────────────────────────────── */}
          <H2 id="capsule">Capsule Format</H2>
          <P>
            A <IC>.capsule</IC> file is a plain JSON document. It is
            human-readable, self-describing, and designed to be verifiable
            without any external tooling beyond standard crypto utilities. Keep
            it safe — for Sealed Predictions and AES-encrypted proofs, it is
            the only copy of keys that exist.
          </P>

          <H3 id="capsule-v2">v2 — Current</H3>
          <P>
            Used for all Sealed Predictions. Encrypted with drand IBE
            timelock.
          </P>
          <Code>{`
{
  "version": "2.0",
  "mode": "sealed_prediction",
  "visibility": null,
  "target_year": 2030,
  "target_datetime": "2030-01-01T00:00:00.000Z",   // ISO 8601 UTC
  "keywords": ["technology", "ai"],
  "hash": "a3f9e2b1c4d87a6f0e3c2b5a8d1f4e7b0c9...", // SHA-256, 64 hex chars

  // Timelock
  "lock_mode": "tlock",
  "tlock_ciphertext": "gBIAAAA...",                  // armored IBE ciphertext
  "drand_round": 66884212,                           // quicknet round number
  "drand_chain_hash": "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",

  // Attestation keypair
  "public_key":  "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",

  // AES fields (null in v2)
  "encrypted_content": null,
  "nonce": null,
  "encryption_key": null,

  // Proof data (populated after server response / OTS confirmation)
  "ots_proof": null,                                 // base64 OTS blob — null until confirmed
  "tsa_token": "MIIHQgYJKoZIhvcNA...",              // base64 RFC 3161 DER token
  "arweave_tx_id": null,                             // null for sealed predictions

  "created_at": "2026-03-12T10:23:45.000Z",
  "prediction_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
          `}</Code>

          <P>
            <strong>ots_proof</strong> is <IC>null</IC> at creation time.
            Bitcoin confirmation takes 1–3 hours. Poll{" "}
            <IC>GET /api/predictions/:id/ots-status</IC> and update the capsule
            manually once the status changes to <IC>confirmed</IC>.
          </P>

          <H3 id="capsule-v1">v1 — Legacy</H3>
          <P>
            Used for Proof of Existence (Encrypted sub-mode) created before
            the tlock upgrade. Decryption is possible at any time using the{" "}
            <IC>encryption_key</IC> field — no time gate is enforced.
          </P>
          <Code>{`
{
  "version": "1.0",
  "mode": "proof_of_existence",
  "visibility": "encrypted",
  "target_year": 2028,
  "keywords": ["finance"],
  "hash": "7d4e2f9a1b8c3e0f5a2d9c6b3f8e1a4d7b0c...",

  "lock_mode": "aes",
  "tlock_ciphertext": null,
  "drand_round": null,
  "drand_chain_hash": null,

  "public_key":  "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",

  "encrypted_content": "SGVsbG8gV29ybGQ...", // base64 AES-GCM ciphertext
  "nonce": "dGVzdG5vbmNl",                   // base64 12-byte IV
  "encryption_key": "a1b2c3d4e5f6...",        // base64 32-byte raw AES key

  "ots_proof": null,
  "tsa_token": "MIIHQgYJKoZIhvcNA...",

  "created_at": "2025-06-01T14:30:00.000Z",
  "prediction_id": "a8b2c3d4-e5f6-7890-abcd-ef0123456789",
  "arweave_tx_id": null
}
          `}</Code>

          <P>
            <strong>Migration note:</strong> very early capsules may have a{" "}
            <IC>type</IC> field instead of <IC>mode</IC>.{" "}
            <IC>type === "full_phrase"</IC> maps to{" "}
            <IC>mode === "sealed_prediction"</IC>; all other values map to{" "}
            <IC>proof_of_existence</IC>. The unlock page handles this
            automatically.
          </P>

          <Divider />

          {/* ─── Independent Verification ─────────────────────────────────── */}
          <H2 id="verification">Independent Verification</H2>
          <P>
            Every proof issued by YouSaidThat can be verified without
            contacting our servers. The following commands work on any Unix
            system.
          </P>

          <H3 id="verify-hash">Hash</H3>
          <P>
            Compute SHA-256 of the plaintext (UTF-8, no trailing newline) and
            compare against the <IC>hash</IC> field in the capsule:
          </P>
          <Code>{`
printf '%s' "your exact plaintext" | sha256sum
# output must match capsule.hash
          `}</Code>

          <H3 id="verify-tsa">RFC 3161 TSA Token</H3>
          <P>
            The <IC>tsa_token</IC> field is a base64-encoded DER-format TSA
            response. The primary TSA is Actalis (
            <IC>tsa.actalis.it</IC>); fallbacks are FreeTSA and Sectigo.
          </P>
          <Code>{`
# Decode token
echo "<base64_tsa_token>" | base64 -d > tsa.tsr

# Verify with OpenSSL (requires the issuing CA cert)
openssl ts -verify -in tsa.tsr -data <(printf '%s' "your plaintext" | sha256sum -b | cut -d' ' -f1 | xxd -r -p) -CAfile actalis-ca.pem
          `}</Code>
          <P>
            The Actalis TSA root certificate is available from{" "}
            <IC>actalis.it/Area-Download/Documents/Actalis-Authentication-Root-CA.pem</IC>
            .
          </P>

          <H3 id="verify-ots">OpenTimestamps (Bitcoin)</H3>
          <P>
            The <IC>ots_proof</IC> field (populated once Bitcoin confirms) is a
            base64-encoded OTS proof blob.
          </P>
          <Code>{`
# Install opentimestamps-client
pip install opentimestamps-client

# Decode and verify
echo "<base64_ots_proof>" | base64 -d > proof.ots
ots verify proof.ots --hash <capsule.hash>
          `}</Code>

          <H3 id="verify-arweave">Arweave (Cleartext Predictions)</H3>
          <P>
            For public Proof of Existence predictions, the full plaintext is
            stored permanently on Arweave. Retrieve it directly:
          </P>
          <Code>{`
curl https://arweave.net/<arweave_tx_id>
# Returns the original plaintext. No key required. Permanent.
          `}</Code>

          <Divider />

          {/* ─── API Reference ────────────────────────────────────────────── */}
          <H2 id="api">API Reference</H2>
          <P>
            Base URL: <IC>https://yousaidthat.org/api</IC>. All endpoints
            accept and return <IC>application/json</IC>. Write endpoints are
            rate-limited per IP. The API is stateless; authentication is not
            required for public read endpoints.
          </P>

          <H3 id="api-register">Register a prediction</H3>
          <ApiCard
            method="POST"
            path="/api/predictions/register"
            description="Registers a SHA-256 hash, submits it to OTS Bitcoin calendars, and issues an RFC 3161 TSA token. For cleartext Proof of Existence, the content is uploaded to Arweave asynchronously."
            request={`{
  "hash": "a3f9e2b1...",            // SHA-256 hex, 64 chars, required
  "mode": "sealed_prediction",      // "proof_of_existence" | "sealed_prediction"
  "target_year": 2030,              // integer, current year ≤ year ≤ current+50
  "keywords": ["tech", "ai"],       // optional, max 3, max 30 chars each
  "email": "user@example.com",       // optional, for future delivery reminder
  "is_public": false,               // whether to include in public feed
  "content": "...",                 // proof_of_existence cleartext only, max 10000 chars
  "content_encrypted": "...",       // proof_of_existence encrypted only, max 50000 chars
  "drand_round": 66884212,          // sealed_prediction v2 only
  "target_datetime": "2030-01-01T00:00:00.000Z"  // sealed_prediction v2 only
}`}
            response={`{
  "prediction_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "hash": "a3f9e2b1...",
  "mode": "sealed_prediction",
  "ots_status": "pending",
  "tsa_token": "MIIHQgYJKoZIhvcNA...",  // base64 RFC 3161 token, or null
  "created_at": "2026-03-12T10:23:45.000Z",
  "arweave_tx_id": null,                 // populated async for cleartext mode
  "arweave_status": "none"
}`}
            notes="OTS confirmation typically takes 1–3 hours. tsa_token is issued synchronously; null only if all three configured TSA providers fail."
          />

          <H3 id="api-public">List public predictions</H3>
          <ApiCard
            method="GET"
            path="/api/predictions/public"
            description="Returns paginated public predictions (proof_of_existence with is_public=true). Supports filtering by keyword and year."
            request={`// Query parameters (all optional):
?page=1
&limit=20          // max 50
&keyword=tech      // filter by keyword
&year=2030         // filter by target year`}
            response={`{
  "predictions": [
    {
      "id": "f47ac10b...",
      "hash_preview": "a3f9e2b1",   // first 8 chars of hash
      "target_year": 2030,
      "keywords": ["tech"],
      "mode": "proof_of_existence",
      "ots_status": "confirmed",
      "created_at": "2026-03-12T10:23:45.000Z",
      "content": "...",             // present for cleartext mode
      "arweave_tx_id": "xyz...",
      "arweave_status": "confirmed"
    }
  ],
  "total": 412,
  "page": 1,
  "limit": 20
}`}
          />

          <H3 id="api-verify">Verify by hash</H3>
          <ApiCard
            method="GET"
            path="/api/predictions/verify?hash=<sha256>"
            description="Look up a prediction by its SHA-256 hash. Returns timestamp proof data for independent verification."
            response={`{
  "found": true,
  "prediction_id": "f47ac10b...",
  "hash": "a3f9e2b1...",
  "mode": "proof_of_existence",
  "target_year": 2030,
  "keywords": ["tech"],
  "ots_confirmed": true,
  "ots_status": "confirmed",
  "bitcoin_block": 882451,
  "timestamp_utc": "2026-03-12T10:23:45.000Z",
  "tsa_token": "MIIHQgYJKoZIhvcNA...",
  "ots_proof": "AE9w...",            // base64 OTS proof, null if pending
  "content": "...",                  // only for cleartext mode
  "arweave_tx_id": "xyz...",
  "arweave_status": "confirmed"
}

// Not found:
{ "found": false }`}
          />

          <H3 id="api-reveal">Reveal a sealed prediction</H3>
          <ApiCard
            method="POST"
            path="/api/predictions/:id/reveal"
            description="Reveals the plaintext of a sealed prediction after the unlock time has passed. The server verifies SHA-256(content) matches the stored hash before publishing."
            request={`{
  "content": "your original plaintext",   // optional — only if publishing
  "is_public": true                        // set to true to add to public feed
}`}
            response={`{
  "ok": true,
  "is_public": true
}`}
            notes="Passing content without is_public: true discards the content after verification. Only submitted content is ever stored; nothing is persisted if is_public is false."
          />

          <H3 id="api-claim">Claim authorship</H3>
          <ApiCard
            method="POST"
            path="/api/predictions/claim"
            description="Creates a public attestation record linking a display name to a prediction. Requires an RSA-PSS signature of the prediction hash using the private key from the .capsule file."
            request={`{
  "hash": "a3f9e2b1...",
  "public_key": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
  "signature": "base64-rsa-pss-signature-of-hash",
  "display_name": "Jane Doe"
}`}
            response={`{
  "attestation_id": "9b1e4dc3...",
  "attestation_url": "https://yousaidthat.org/attestation/9b1e4dc3...",
  "display_name": "Jane Doe",
  "hash": "a3f9e2b1...",
  "timestamp_verified": "2026-03-12T10:23:45.000Z",
  "bitcoin_block": 882451
}`}
            notes="The year gate is enforced server-side: target_year must be ≤ current year at the time of the claim request."
          />

          <H3 id="api-attestation">Get attestation</H3>
          <ApiCard
            method="GET"
            path="/api/attestations/:id"
            description="Returns the public attestation page data for a given attestation ID."
            response={`{
  "attestation_id": "9b1e4dc3...",
  "display_name": "Jane Doe",
  "attestation_url": "https://yousaidthat.org/attestation/9b1e4dc3...",
  "created_at": "2026-03-12T10:23:45.000Z",
  "prediction": {
    "id": "f47ac10b...",
    "hash": "a3f9e2b1...",
    "mode": "sealed_prediction",
    "target_year": 2030,
    "keywords": ["tech"],
    "ots_status": "confirmed",
    "bitcoin_block": 882451,
    "timestamp_utc": "2026-03-12T10:23:45.000Z",
    "tsa_token": "MIIHQgYJKoZIhvcNA..."
  }
}`}
          />

          <Divider />

          {/* ─── Open Source ──────────────────────────────────────────────── */}
          <H2 id="open-source">Open Source</H2>
          <P>
            YouSaidThat is open source. The capsule format is an open standard
            — any compatible client can read, write, and verify{" "}
            <IC>.capsule</IC> files without depending on yousaidthat.org.
          </P>
          <UL
            items={[
              <>
                Repository:{" "}
                <a
                  href="https://github.com/giulioparrinello/teaserYST"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6366F1] hover:underline inline-flex items-center gap-0.5"
                >
                  github.com/giulioparrinello/teaserYST{" "}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>,
              <>License: MIT</>,
              <>
                Issues and PRs welcome. For security vulnerabilities, see the{" "}
                <Link href="/security-audit">
                  <span className="text-[#6366F1] hover:underline cursor-pointer">
                    Security Audit
                  </span>
                </Link>{" "}
                page for responsible disclosure instructions.
              </>,
            ]}
          />

          <div className="h-16" />
        </article>
      </div>

      {/* ─── Footer ─── */}
      <footer className="w-full py-8 border-t border-[#E5E5E5]/50 bg-white/50 mt-4">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#666]">
          <span className="font-bold text-[#111] tracking-tight">
            yousaidthat.org
          </span>
          <div className="flex items-center gap-6">
            <Link href="/docs">
              <span className="text-[#6366F1] font-medium cursor-pointer">
                Documentation
              </span>
            </Link>
            <Link href="/security-audit">
              <span className="hover:text-[#111] transition-colors cursor-pointer">
                Security Audit
              </span>
            </Link>
            <Link href="/privacy">
              <span className="hover:text-[#111] transition-colors cursor-pointer">
                Privacy
              </span>
            </Link>
            <a
              href="https://github.com/giulioparrinello/teaserYST"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111] transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
