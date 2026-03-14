import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ExternalLink, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarItem {
  id: string;
  label: string;
  child?: boolean;
  group?: boolean;
}

const SIDEBAR: SidebarItem[] = [
  { id: "overview", label: "Overview" },
  { id: "security-model", label: "Security Model" },
  { id: "threat-model", label: "Threat Model" },
  { id: "zero-knowledge", label: "Zero-Knowledge Design" },
  { id: "server-data", label: "What the Server Sees" },
  { id: "limitations", label: "Known Limitations" },
  { id: "disclosure", label: "Responsible Disclosure" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function IC({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] bg-[#F0F0F0] text-[#111] px-1.5 py-0.5 rounded">
      {children}
    </code>
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

function Divider() {
  return <div className="h-px bg-[#F0F0F0] my-8" />;
}

function StatusRow({
  status,
  label,
  detail,
}: {
  status: "protected" | "partial" | "exposed";
  label: string;
  detail: string;
}) {
  const icon =
    status === "protected" ? (
      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
    ) : status === "partial" ? (
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
    );

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F5F5F5] last:border-0">
      {icon}
      <div className="flex-1">
        <p className="text-sm font-medium text-[#111]">{label}</p>
        <p className="text-xs text-[#777] leading-relaxed mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function ThreatRow({
  actor,
  impact,
  severity,
}: {
  actor: string;
  impact: string;
  severity: "low" | "medium" | "high";
}) {
  const colors = {
    low: "text-green-600 bg-green-50 border-green-100",
    medium: "text-amber-600 bg-amber-50 border-amber-100",
    high: "text-red-500 bg-red-50 border-red-100",
  };

  return (
    <tr className="border-b border-[#F5F5F5] last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-[#111] align-top">
        {actor}
      </td>
      <td className="py-3 pr-4 text-sm text-[#555] align-top leading-relaxed">
        {impact}
      </td>
      <td className="py-3 align-top">
        <span
          className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${colors[severity]}`}
        >
          {severity}
        </span>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SecurityAudit() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>("[data-section]");
      let current = "overview";
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
          <Link href="/docs">
            <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
              Docs
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
              Security Audit
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
                  {isActive && (
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

          {/* ─── Overview ─────────────────────────────────────────────────── */}
          <H2 id="overview">Security Overview</H2>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              No third-party security audit has been conducted as of the
              current version. The source code is available for independent
              review at{" "}
              <a
                href="https://github.com/giulioparrinello/YouSaidThat"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                github.com/giulioparrinello/YouSaidThat
              </a>
              . If you find a vulnerability, see the{" "}
              <button
                onClick={() => scrollTo("disclosure")}
                className="underline"
              >
                Responsible Disclosure
              </button>{" "}
              section.
            </p>
          </div>

          <P>
            YouSaidThat is designed around a single security principle: the
            server should not be a point of trust. For Sealed Predictions, the
            server is a dumb hash registry — it can be fully compromised without
            revealing any prediction content, because the content never arrives
            there in plaintext.
          </P>
          <P>
            This document describes what that means in practice, where the
            boundaries are, and where we fall short.
          </P>

          <Divider />

          {/* ─── Security Model ───────────────────────────────────────────── */}
          <H2 id="security-model">Security Model</H2>

          <div className="border border-[#E5E5E5] rounded-2xl overflow-hidden mb-6">
            <div className="bg-[#FAFAFA] px-5 py-3 border-b border-[#E5E5E5]">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#999]">
                Protection Status
              </p>
            </div>
            <div className="px-5 divide-y divide-[#F5F5F5]">
              <StatusRow
                status="protected"
                label="Sealed Prediction plaintext"
                detail="Encrypted client-side with drand IBE timelock before any network request. The server receives only the hash and the ciphertext. Decryption requires the drand beacon, which doesn't exist until the target round."
              />
              <StatusRow
                status="protected"
                label="RSA private key"
                detail="Generated in-browser via WebCrypto. Stored only in the local .capsule file. Never transmitted. Lost capsule = lost attestation capability — there is no recovery path."
              />
              <StatusRow
                status="protected"
                label="Raw email address"
                detail="Stored server-side only if explicitly provided for delivery reminders. Protected by double opt-in (confirmation email required before queuing). Access restricted via Supabase RLS to service role only."
              />
              <StatusRow
                status="protected"
                label="AES keys (v1 legacy)"
                detail="Stored exclusively in the .capsule file. The server stores only the ciphertext, not the key."
              />
              <StatusRow
                status="partial"
                label="Metadata"
                detail="Keywords, target year, mode, and creation timestamp are stored in plaintext on the server. For sealed predictions, keywords can hint at content."
              />
              <StatusRow
                status="partial"
                label="Timing correlation"
                detail="The creation timestamp is precise to the second. An adversary with access to the server can correlate prediction timing with external events."
              />
              <StatusRow
                status="exposed"
                label="Cleartext Proof of Existence content"
                detail="By design, cleartext predictions are stored on the server and uploaded permanently to Arweave. Once submitted, they cannot be deleted. Use encrypted or sealed mode if privacy matters."
              />
            </div>
          </div>

          <Divider />

          {/* ─── Threat Model ─────────────────────────────────────────────── */}
          <H2 id="threat-model">Threat Model</H2>
          <P>
            The following actors are considered in scope. Impact assessment
            assumes a sealed prediction scenario unless noted.
          </P>

          <div className="border border-[#E5E5E5] rounded-2xl overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                  <th className="text-left px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999]">
                    Actor
                  </th>
                  <th className="text-left px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999]">
                    Impact
                  </th>
                  <th className="text-left px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999]">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody className="px-5 divide-y divide-[#F5F5F5]">
                <ThreatRow
                  actor="Compromised server (DB read)"
                  impact="Attacker gains full read access to the database. Can see hashes, metadata, TSA tokens, OTS proofs. Cannot decrypt sealed predictions (ciphertext requires a drand beacon not yet published). Cannot forge attestations (private keys not stored)."
                  severity="low"
                />
                <ThreatRow
                  actor="Compromised server (code exec)"
                  impact="Attacker controls the server process. Can intercept cleartext Proof of Existence submissions at the API boundary. Cannot see sealed prediction plaintext — it is never transmitted. Can forge timestamps for new submissions going forward, but cannot alter existing Bitcoin-anchored proofs."
                  severity="medium"
                />
                <ThreatRow
                  actor="Network MitM"
                  impact="HTTPS is enforced. Assuming certificate pinning is not compromised, an attacker cannot read or modify in-flight data. Metadata (hash, keywords, year) is visible to TLS-terminating infrastructure."
                  severity="low"
                />
                <ThreatRow
                  actor="Malicious drand beacon"
                  impact="Breaking a timelock requires the IBE master key, which requires colluding with all participating organizations simultaneously (EPFL, Cloudflare, Protocol Labs, University of Chile, Kudelski Security). Early decryption via this path is considered infeasible."
                  severity="low"
                />
                <ThreatRow
                  actor="Browser compromise at creation time"
                  impact="If the user's browser is compromised while writing a prediction, an attacker can intercept the plaintext before encryption. This is out of scope for the protocol — it is equivalent to compromising the end user's device."
                  severity="high"
                />
                <ThreatRow
                  actor="Capsule file theft"
                  impact="The .capsule file contains all keys and ciphertext. An attacker who obtains it can claim authorship at any time (RSA private key) and decrypt sealed predictions after the target datetime (combined with drand beacon). Treat it as a private key."
                  severity="high"
                />
              </tbody>
            </table>
          </div>

          <Divider />

          {/* ─── Zero-Knowledge Design ────────────────────────────────────── */}
          <H2 id="zero-knowledge">Zero-Knowledge Design</H2>
          <P>
            For Sealed Predictions, the following operations happen entirely
            inside the browser before any network request is made:
          </P>

          <div className="space-y-3 mb-6">
            {[
              {
                step: "01",
                title: "SHA-256 hash",
                detail:
                  "SHA-256(utf8(plaintext)) computed via WebCrypto. This is the only representation of the content that reaches the server.",
              },
              {
                step: "02",
                title: "drand IBE encryption",
                detail:
                  "tlockEncrypt(plaintext, round) produces an IBE ciphertext using tlock-js. The encryption uses the drand public key for the target round — no network call needed. The ciphertext goes into the local .capsule file only.",
              },
              {
                step: "03",
                title: "RSA-PSS keypair generation",
                detail:
                  "A fresh 2048-bit RSA keypair is generated via WebCrypto. The public key is included in the registration request. The private key goes into the .capsule file only.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-5 flex gap-4"
              >
                <span className="text-[10px] font-mono text-[#BBBBBB] font-bold shrink-0 mt-0.5">
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111] mb-1">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#666] leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <P>
            The registration API call transmits: <IC>hash</IC>,{" "}
            <IC>mode</IC>, <IC>target_year</IC>, <IC>target_datetime</IC>,{" "}
            <IC>drand_round</IC>, <IC>public_key</IC> (RSA, public only),
            optional <IC>keywords</IC>, and optional <IC>email</IC>
            (for future delivery reminder). The plaintext and private key are never
            included.
          </P>
          <P>
            At reveal time (<IC>POST /api/predictions/:id/reveal</IC>), if the
            user chooses to publish, the plaintext is submitted. The server
            verifies <IC>SHA-256(content) === stored_hash</IC> before accepting
            it. If the hashes do not match, the submission is rejected and
            nothing is stored.
          </P>

          <Divider />

          {/* ─── What the Server Sees ─────────────────────────────────────── */}
          <H2 id="server-data">What the Server Sees</H2>
          <P>
            This is an exhaustive list of data persisted server-side for each
            prediction type.
          </P>

          <div className="overflow-x-auto mb-6">
            <table className="w-full border border-[#E5E5E5] rounded-2xl overflow-hidden text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                  <th className="text-left px-4 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] font-normal">
                    Field
                  </th>
                  <th className="text-left px-4 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] font-normal">
                    Sealed
                  </th>
                  <th className="text-left px-4 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] font-normal">
                    PoE Cleartext
                  </th>
                  <th className="text-left px-4 py-3 text-[9px] font-mono uppercase tracking-[0.2em] text-[#999] font-normal">
                    PoE Encrypted
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["SHA-256 hash", "✓", "✓", "✓"],
                  ["Mode & visibility", "✓", "✓", "✓"],
                  ["Target year / datetime", "✓", "✓", "✓"],
                  ["Keywords (optional)", "✓", "✓", "✓"],
                  ["Creation timestamp", "✓", "✓", "✓"],
                  ["TSA token (proof of time)", "✓", "✓", "✓"],
                  ["OTS proof (Bitcoin)", "✓", "✓", "✓"],
                  ["RSA public key", "✓", "✓", "✓"],
                  ["Plaintext content", "✗", "✓", "✗"],
                  ["AES ciphertext", "✗", "✗", "✓ (key is not stored)"],
                  ["drand round / chain hash", "✓", "✗", "✗"],
                  ["Email (if provided, confirmed)", "✓ (RLS)", "✓ (RLS)", "✓ (RLS)"],
                  ["RSA private key", "✗", "✗", "✗"],
                  ["AES decryption key", "✗", "✗", "✗"],
                  ["IP address", "Rate limiting only — not persisted", "←", "←"],
                ].map(([field, sealed, cleartext, encrypted], i) => (
                  <tr
                    key={i}
                    className="border-b border-[#F5F5F5] last:border-0"
                  >
                    <td className="px-4 py-2.5 text-[11px] font-mono text-[#555]">
                      {field}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-[11px] ${
                        sealed === "✗"
                          ? "text-green-500"
                          : sealed === "✓"
                          ? "text-[#555]"
                          : "text-[#888]"
                      }`}
                    >
                      {sealed}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-[11px] ${
                        cleartext === "✗"
                          ? "text-green-500"
                          : cleartext === "✓"
                          ? "text-[#555]"
                          : "text-[#888]"
                      }`}
                    >
                      {cleartext}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-[11px] ${
                        encrypted === "✗"
                          ? "text-green-500"
                          : encrypted === "✓"
                          ? "text-[#555]"
                          : "text-[#888]"
                      }`}
                    >
                      {encrypted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Divider />

          {/* ─── Known Limitations ────────────────────────────────────────── */}
          <H2 id="limitations">Known Limitations</H2>

          <div className="space-y-4 mb-6">
            {[
              {
                n: "01",
                title: "No third-party audit",
                body: "No independent security audit has been conducted. The codebase is open source and available for review. A formal audit is planned before a production launch with significant user data.",
              },
              {
                n: "02",
                title: "Metadata leakage",
                body: "Keywords, target year, creation time, and the hash itself are stored unencrypted. Keywords can reveal intent. SHA-256 is not a commitment scheme under active adversarial search — if the content space is small, brute-force preimage search is feasible.",
              },
              {
                n: "03",
                title: "drand network continuity",
                body: "The quicknet network launched in 2023. Its operational continuity depends on the participating organizations maintaining their nodes. Long-horizon predictions (2040+) carry drand availability risk. The Bitcoin OTS proof is independent and remains valid regardless of drand's status.",
              },
              {
                n: "04",
                title: "OTS calendar availability",
                body: "OpenTimestamps proof upgrades (pending → confirmed) depend on the Alice and Bob public calendar servers. If they are unavailable, OTS confirmation is delayed but not permanently blocked — the proof can be upgraded via any available OTS calendar.",
              },
              {
                n: "05",
                title: "Arweave permanence",
                body: "Arweave provides economic guarantees of data permanence backed by a storage endowment, not cryptographic guarantees. In the event of severe Arweave network failure, cleartext prediction content could become inaccessible. The SHA-256 hash and TSA/OTS proofs remain valid independently.",
              },
              {
                n: "06",
                title: "Rate limiting",
                body: "Rate limits are enforced per IP address using the x-forwarded-for header (trust proxy enabled for Vercel). Users behind shared NAT, corporate proxies, or Tor may be affected by limits triggered by other users.",
              },
              {
                n: "07",
                title: "Email reminder limitation",
                body: "Email reminders require double opt-in: a confirmation email is sent immediately after registration, and the reminder is only queued after the user clicks the confirmation link. Unconfirmed entries are never emailed at the target date.",
              },
            ].map((item) => (
              <div
                key={item.n}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-5 flex gap-4"
              >
                <span className="text-[10px] font-mono text-[#BBBBBB] font-bold shrink-0 mt-0.5">
                  {item.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111] mb-1.5">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#666] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Divider />

          {/* ─── Responsible Disclosure ───────────────────────────────────── */}
          <H2 id="disclosure">Responsible Disclosure</H2>
          <P>
            There is no dedicated security email address at this time. Please
            use the following channels depending on severity:
          </P>

          <div className="space-y-3 mb-6">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#111] mb-1.5">
                Non-critical issues
              </p>
              <p className="text-xs text-[#666] leading-relaxed mb-3">
                Open a GitHub issue with the label{" "}
                <IC>security</IC>. Describe the issue without including a
                working exploit.
              </p>
              <a
                href="https://github.com/giulioparrinello/YouSaidThat/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#6366F1] hover:underline font-medium"
              >
                Open an issue <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#111] mb-1.5">
                Critical vulnerabilities
              </p>
              <p className="text-xs text-[#666] leading-relaxed">
                For issues that could impact existing user data — direct
                message{" "}
                <span className="font-mono text-[#111]">@giulioparrinello</span>{" "}
                before making any public disclosure. Please allow reasonable
                time for a fix before publishing.
              </p>
            </div>
          </div>

          <P>
            We do not currently have a bug bounty program. Responsible
            disclosures will be credited in the release notes unless you prefer
            to remain anonymous.
          </P>

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
              <span className="hover:text-[#111] transition-colors cursor-pointer">
                Documentation
              </span>
            </Link>
            <Link href="/security-audit">
              <span className="text-[#6366F1] font-medium cursor-pointer">
                Security Audit
              </span>
            </Link>
            <Link href="/privacy">
              <span className="hover:text-[#111] transition-colors cursor-pointer">
                Privacy
              </span>
            </Link>
            <a
              href="https://github.com/giulioparrinello/YouSaidThat"
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
