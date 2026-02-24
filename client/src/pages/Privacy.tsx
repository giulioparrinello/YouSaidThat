import { motion } from "framer-motion";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

const SECTIONS = [
  {
    title: "What we collect",
    body: `When you register a prediction, we store:
• The SHA-256 hash of your content — always
• Your chosen target year, optional keywords, and visibility setting
• For Proof of Existence (Cleartext sub-mode): the full prediction text is stored in our database and uploaded permanently to Arweave, where it is publicly accessible forever
• For Proof of Existence (Encrypted sub-mode): only the AES-256-GCM ciphertext is stored — the decryption key never leaves your device
• For Sealed Prediction: only the hash is stored — content and keys exist solely in the .capsule file you download
• If you provide an email address, only its SHA-256 hash is stored — we never retain the raw address
• Standard server access logs (IP address, timestamp) are not permanently stored`,
  },
  {
    title: "What we never collect",
    body: `• Your private key or RSA encryption key — these exist only in the .capsule file you download
• A recoverable form of your email address
• Prediction text for Sealed Predictions — encryption happens entirely in your browser before anything is sent
• Decryption keys for Encrypted Proof of Existence predictions`,
  },
  {
    title: "Third-party services",
    body: `To anchor your hash to the Bitcoin blockchain, we submit it to OpenTimestamps calendar servers (alice.btc.calendar.opentimestamps.org and bob.btc.calendar.opentimestamps.org). Your hash (not your content) is sent to these servers.

For an immediate timestamp token (RFC 3161), we use Actalis CA. Again, only your hash is transmitted.

For Proof of Existence predictions (Cleartext mode), the content is uploaded directly to Arweave — a decentralized, permanent storage network. Once uploaded, this content is publicly accessible at arweave.net and cannot be deleted. Do not use Cleartext mode if you intend to keep your prediction private.

Email notifications (where opted in) are sent via Resend. Because we store only the hash of your email, reminder delivery requires manual re-verification at the target year — this feature is planned but not yet active.`,
  },
  {
    title: "Data retention",
    body: `Prediction metadata (hash, mode, year, keywords) is stored indefinitely as it forms the permanent record of your timestamp. This is necessary for the service to function.

Email hashes in the queue are retained until the target year has passed. Waitlist entries are retained until you request removal.`,
  },
  {
    title: "Your rights (GDPR)",
    body: `If you are in the European Economic Area, you have the right to access, rectify, or erase personal data we hold about you. Because we store only hashed values, we cannot identify records by email address without you providing the original address.

To exercise your rights or raise a concern, contact: privacy@yousaidthat.org`,
  },
  {
    title: "Cookies & tracking",
    body: `We do not use cookies, analytics scripts, or any third-party tracking on this site. There are no fingerprinting libraries, no ad networks, and no social media widgets.`,
  },
  {
    title: "Security",
    body: `All data is transmitted over HTTPS. The database is hosted on Supabase with Row-Level Security enabled. Service-role database credentials are never exposed to the client.`,
  },
  {
    title: "Changes to this policy",
    body: `We may update this page to reflect changes in our practices or legal requirements. The date at the top of this page indicates when it was last revised.`,
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <Link href="/create">
          <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
            Register a prediction
          </span>
        </Link>
      </nav>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#6366F1]" />
            </div>
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
              Privacy Policy
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Your privacy, in plain language
          </h1>
          <p className="text-sm text-[#888] mb-10">
            Last updated: February 2026
          </p>

          <div className="bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-2xl p-5 mb-10">
            <p className="text-sm text-[#444] leading-relaxed">
              <strong className="text-[#111]">TL;DR:</strong> For{" "}
              <strong>Sealed Predictions</strong>, we store only a cryptographic
              hash — your text never leaves your browser in plaintext. For{" "}
              <strong>Proof of Existence (Cleartext)</strong>, the full text is
              stored permanently on Arweave and is publicly accessible forever —
              this is by design. We do not sell or share your data. We use no
              analytics cookies.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((s, i) => (
              <section key={i}>
                <h2 className="text-base font-semibold mb-3">{s.title}</h2>
                <p className="text-sm text-[#555] leading-relaxed whitespace-pre-line">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-14 pt-8 border-t border-[#E5E5E5] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#CCC] uppercase tracking-widest">
              yousaidthat.org
            </span>
            <Link href="/">
              <span className="text-xs text-[#999] hover:text-[#111] transition-colors cursor-pointer">
                ← Back to home
              </span>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
