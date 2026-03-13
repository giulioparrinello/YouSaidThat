import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  ShieldCheck,
  Clock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Upload,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import {
  hashText,
  hashBinary,
  generateKeyPair,
  encryptContent,
  tlockEncrypt,
  drandRoundAt,
  DRAND_CHAIN_HASH,
  downloadCapsule,
  type CapsuleData,
} from "@/lib/crypto";
import { api } from "@/lib/api";
import { generateCertificatePdf } from "@/lib/generateCertificate";

type Mode = "proof_of_existence" | "sealed_prediction";
type Visibility = "cleartext" | "encrypted";

const STEPS = ["Mode", "Prediction", "Time-Lock", "Options", "Seal"];

const currentYear = new Date().getFullYear();

// Minimum date: today
function minDateLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

// Maximum date: 50 years from now
function maxDateLocal(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 50);
  return d.toISOString().slice(0, 10);
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-mono font-bold transition-all duration-300 ${
              i < current
                ? "bg-[#111111] text-white"
                : i === current
                ? "bg-[#6366F1] text-white"
                : "bg-[#F5F5F5] text-[#999]"
            }`}
          >
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={`text-xs hidden sm:inline transition-colors ${
              i === current ? "text-[#111] font-medium" : "text-[#999]"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px w-6 transition-colors ${
                i < current ? "bg-[#111]" : "bg-[#E5E5E5]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Keyword input ────────────────────────────────────────────────────────────
function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (kw: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const kw = input.trim().replace(/[^a-zA-Z0-9 -]/g, "");
    if (!kw || keywords.length >= 3 || keywords.includes(kw)) return;
    onChange([...keywords, kw]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={keywords.length < 3 ? "Add keyword… (Enter)" : "Max 3 keywords"}
          disabled={keywords.length >= 3}
          maxLength={30}
          className="flex-1 h-10 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] disabled:opacity-40 transition-all"
        />
        <button
          onClick={add}
          disabled={!input.trim() || keywords.length >= 3}
          className="h-10 px-4 rounded-full bg-[#111] text-white text-sm disabled:opacity-30 hover:bg-[#222] transition-colors"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-xs font-mono"
          >
            {kw}
            <button onClick={() => onChange(keywords.filter((k) => k !== kw))}>
              <X className="w-3 h-3 text-[#999] hover:text-[#111]" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Create() {
  const [step, setStep] = useState(0);

  // Form state
  const [mode, setMode] = useState<Mode>("sealed_prediction");
  const [visibility, setVisibility] = useState<Visibility>("cleartext");
  const [text, setText] = useState("");
  // File-based hashing (proof_of_existence only)
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHashing, setFileHashing] = useState(false);
  const [inputTab, setInputTab] = useState<"text" | "file">("text");
  const fileRef = useRef<HTMLInputElement>(null);

  // PoE: optional target datetime (null = no gate)
  const [poeDatetime, setPoeDatetime] = useState<string>("");
  const [poeHasDate, setPoeHasDate] = useState(false);
  // Sealed: required target datetime
  const [targetDatetime, setTargetDatetime] = useState<string>("");
  // Legacy: kept for capsule compat (derived from datetime)
  const targetYear = (() => {
    if (mode === "sealed_prediction" && targetDatetime) return new Date(targetDatetime).getFullYear();
    if (mode === "proof_of_existence" && poeHasDate && poeDatetime) return new Date(poeDatetime).getFullYear();
    return null;
  })();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [email, setEmail] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Sealing state
  const [sealing, setSealing] = useState(false);
  const [sealStep, setSealStep] = useState("");
  const [sealed, setSealed] = useState<CapsuleData | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [arweaveTxId, setArweaveTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTS polling state (after sealing)
  const [otsStatus, setOtsStatus] = useState<string>("pending");
  const [otsBitcoinBlock, setOtsBitcoinBlock] = useState<number | null>(null);

  useEffect(() => {
    if (!predictionId || !sealed || otsStatus === "confirmed") return;
    const id = setInterval(async () => {
      try {
        const status = await api.getOtsStatus(predictionId);
        setOtsStatus(status.ots_status);
        setOtsBitcoinBlock(status.bitcoin_block);
        if (status.ots_status === "confirmed" && status.ots_proof) {
          setSealed((prev) =>
            prev ? { ...prev, ots_proof: status.ots_proof } : prev
          );
        }
      } catch {
        // silent — polling errors should not interrupt UX
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [predictionId, sealed, otsStatus]);

  const hasContent =
    inputTab === "file" ? fileHash !== null : text.trim().length >= 3;

  const step2ok =
    mode === "sealed_prediction"
      ? targetDatetime !== "" && new Date(targetDatetime) > new Date()
      : true; // PoE: date is optional

  const canProceed = [
    true,
    hasContent,
    step2ok,
    true,
    true,
  ][step];

  const handleFile = async (file: File) => {
    setFileHashing(true);
    setFileHash(null);
    setFileName(null);
    try {
      const buf = await file.arrayBuffer();
      const h = await hashBinary(buf);
      setFileHash(h);
      setFileName(file.name);
    } catch {
      setFileHash(null);
    } finally {
      setFileHashing(false);
    }
  };

  const handleSeal = useCallback(async () => {
    setSealing(true);
    setError(null);

    try {
      let hash: string;
      if (inputTab === "file" && fileHash) {
        hash = fileHash;
        setSealStep("Using file SHA-256 hash…");
      } else {
        setSealStep("Computing SHA-256 hash…");
        hash = await hashText(text.trim());
      }

      let encryptedContentVal: string | null = null;
      let nonce: string | null = null;
      let encryptionKey: string | null = null;
      let publicKeyPem: string | null = null;
      let privateKeyPem: string | null = null;
      let tlockCiphertext: string | null = null;
      let drandRound: number | null = null;

      if (mode === "sealed_prediction") {
        // v2: drand timelock encryption + RSA keypair for attestation
        setSealStep("Generating RSA-PSS key pair…");
        const kp = await generateKeyPair();
        publicKeyPem = kp.publicKeyPem;
        privateKeyPem = kp.privateKeyPem;

        if (inputTab === "text" && targetDatetime) {
          setSealStep("Encrypting with drand timelock…");
          const targetMs = new Date(targetDatetime).getTime();
          const tlock = await tlockEncrypt(text.trim(), targetMs);
          tlockCiphertext = tlock.ciphertext;
          drandRound = tlock.round;
        }
      } else if (mode === "proof_of_existence" && visibility === "encrypted" && inputTab === "text") {
        // Proof of existence — encrypted sub-mode: AES encrypt only
        setSealStep("Encrypting with AES-256-GCM…");
        const enc = await encryptContent(text.trim());
        encryptedContentVal = enc.encryptedContent;
        nonce = enc.nonce;
        encryptionKey = enc.encryptionKey;
      }
      // Proof of existence — cleartext sub-mode: no crypto, content sent directly

      setSealStep("Registering on YouSaidThat…");

      // Determine effective datetime string
      const effectiveDatetime =
        mode === "sealed_prediction" && targetDatetime
          ? new Date(targetDatetime).toISOString()
          : mode === "proof_of_existence" && poeHasDate && poeDatetime
          ? new Date(poeDatetime).toISOString()
          : null;

      const payload: Parameters<typeof api.registerPrediction>[0] = {
        hash,
        mode,
        target_year: targetYear ?? undefined,
        author_name: authorName.trim() || undefined,
        keywords: keywords.length ? keywords : undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        is_public: isPublic,
      };

      // tlock fields for sealed_prediction v2
      if (mode === "sealed_prediction" && drandRound && effectiveDatetime) {
        payload.drand_round = drandRound;
        payload.target_datetime = effectiveDatetime;
      }

      // PoE with date
      if (mode === "proof_of_existence" && effectiveDatetime) {
        payload.target_datetime = effectiveDatetime;
      }

      // Attach content for proof_of_existence
      if (mode === "proof_of_existence") {
        if (visibility === "cleartext" && inputTab === "text") {
          payload.content = text.trim();
        } else if (visibility === "encrypted" && encryptedContentVal) {
          payload.content_encrypted = encryptedContentVal;
        }
      }

      const res = await api.registerPrediction(payload);
      setPredictionId(res.prediction_id);
      setArweaveTxId(res.arweave_tx_id ?? null);

      const capsule: CapsuleData = {
        version: "2.0",
        mode,
        visibility: mode === "proof_of_existence" ? visibility : null,
        target_year: targetYear,
        target_datetime: effectiveDatetime,
        lock_mode: mode === "sealed_prediction" ? "tlock" : undefined,
        tlock_ciphertext: tlockCiphertext,
        drand_round: drandRound,
        drand_chain_hash: mode === "sealed_prediction" ? DRAND_CHAIN_HASH : null,
        keywords,
        hash,
        public_key: publicKeyPem,
        private_key: privateKeyPem,
        encrypted_content: encryptedContentVal,
        nonce,
        encryption_key: encryptionKey,
        ots_proof: null,
        tsa_token: res.tsa_token,
        created_at: res.created_at ?? new Date().toISOString(),
        prediction_id: res.prediction_id,
        arweave_tx_id: res.arweave_tx_id ?? null,
      };

      setSealStep("Generating capsule file…");
      downloadCapsule(capsule);
      setSealed(capsule);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSealing(false);
      setSealStep("");
    }
  }, [text, fileHash, inputTab, mode, visibility, targetYear, targetDatetime, poeDatetime, poeHasDate, keywords, authorName, email, isPublic]);

  // Whether current mode+visibility uses encryption
  const isEncrypted =
    mode === "sealed_prediction" ||
    (mode === "proof_of_existence" && visibility === "encrypted");

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
      {/* Nav */}
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <Link href="/verify">
          <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
            Verify a prediction
          </span>
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 py-12 w-full max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-2">
            New Prediction
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-8">
            Seal your vision
          </h1>

          <StepBar current={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 0: Mode selection ── */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <p className="text-sm text-[#666] leading-relaxed">
                  Choose how your prediction is stored. Both modes anchor your hash to the Bitcoin blockchain.
                </p>
                <div className="space-y-3">
                  {/* Proof of Existence */}
                  <div
                    className={`rounded-2xl border transition-all ${
                      mode === "proof_of_existence"
                        ? "border-[#6366F1] bg-[#6366F1]/5 shadow-sm"
                        : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
                    }`}
                  >
                    <button
                      onClick={() => setMode("proof_of_existence")}
                      className="w-full text-left p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          mode === "proof_of_existence" ? "bg-[#6366F1]/10" : "bg-[#F5F5F5]"
                        }`}>
                          <Eye className={`w-4 h-4 ${mode === "proof_of_existence" ? "text-[#6366F1]" : "text-[#999]"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">Proof of Existence</p>
                            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              mode === "proof_of_existence"
                                ? "bg-[#6366F1]/10 text-[#6366F1]"
                                : "bg-[#F5F5F5] text-[#999]"
                            }`}>Public-ready</span>
                          </div>
                          <p className="text-[11px] text-[#666] leading-relaxed mb-2">
                            Your text is hashed and timestamped. Content is anchored to Arweave permanently.
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {["SHA-256 hash", "Bitcoin OTS anchor", "RFC 3161 TSA", "Arweave permanent storage"].map((d) => (
                              <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5F5] text-[#888]">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-colors ${
                          mode === "proof_of_existence" ? "border-[#6366F1] bg-[#6366F1]" : "border-[#DDD] bg-white"
                        }`}>
                          {mode === "proof_of_existence" && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[3px]" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Sub-mode selection — only shown when proof_of_existence is selected */}
                    {mode === "proof_of_existence" && (
                      <div className="px-5 pb-5">
                        <div className="border-t border-[#E5E5E5]/60 pt-4">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-[#999] mb-3">
                            Visibility sub-mode
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setVisibility("cleartext")}
                              className={`text-left p-3 rounded-xl border transition-all ${
                                visibility === "cleartext"
                                  ? "border-[#6366F1] bg-[#6366F1]/5"
                                  : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                              }`}
                            >
                              <p className={`text-xs font-semibold mb-1 ${visibility === "cleartext" ? "text-[#6366F1]" : "text-[#111]"}`}>
                                Cleartext
                              </p>
                              <p className="text-[10px] text-[#666] leading-relaxed">
                                Text visible on community feed. Verifiable by anyone.
                              </p>
                            </button>
                            <button
                              onClick={() => setVisibility("encrypted")}
                              className={`text-left p-3 rounded-xl border transition-all ${
                                visibility === "encrypted"
                                  ? "border-[#6366F1] bg-[#6366F1]/5"
                                  : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                              }`}
                            >
                              <p className={`text-xs font-semibold mb-1 ${visibility === "encrypted" ? "text-[#6366F1]" : "text-[#111]"}`}>
                                Encrypted
                              </p>
                              <p className="text-[10px] text-[#666] leading-relaxed">
                                AES-256-GCM encrypted. Key stored in your PDF/capsule.
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sealed Prediction */}
                  <button
                    onClick={() => setMode("sealed_prediction")}
                    className={`w-full text-left p-5 rounded-2xl border transition-all ${
                      mode === "sealed_prediction"
                        ? "border-[#6366F1] bg-[#6366F1]/5 shadow-sm"
                        : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        mode === "sealed_prediction" ? "bg-[#6366F1]/10" : "bg-[#F5F5F5]"
                      }`}>
                        <Lock className={`w-4 h-4 ${mode === "sealed_prediction" ? "text-[#6366F1]" : "text-[#999]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold">Sealed Prediction</p>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            mode === "sealed_prediction"
                              ? "bg-[#6366F1]/10 text-[#6366F1]"
                              : "bg-[#F5F5F5] text-[#999]"
                          }`}>Private</span>
                        </div>
                        <p className="text-[11px] text-[#666] leading-relaxed mb-2">
                          Encrypted with drand timelock (IBE/BLS12-381). Mathematically impossible to decrypt before your chosen date.
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {["drand IBE timelock", "RSA-PSS keypair", "Bitcoin OTS anchor", "Zero-knowledge"].map((d) => (
                            <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5F5] text-[#888]">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-colors ${
                        mode === "sealed_prediction" ? "border-[#6366F1] bg-[#6366F1]" : "border-[#DDD] bg-white"
                      }`}>
                        {mode === "sealed_prediction" && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[3px]" />
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Prediction text or file ── */}
            {step === 1 && (
              <motion.div
                key="step1text"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Mode badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-mono ${
                  isEncrypted
                    ? "bg-[#6366F1]/5 border border-[#6366F1]/20 text-[#6366F1]"
                    : "bg-[#F5F5F5] border border-[#E5E5E5] text-[#666]"
                }`}>
                  {isEncrypted
                    ? <><Lock className="w-3 h-3" /> Text will be encrypted locally — server never sees plaintext</>
                    : <><FileText className="w-3 h-3" /> Content will be stored publicly on Arweave</>
                  }
                </div>

                {/* Tab switcher — file upload only for proof_of_existence */}
                {mode === "proof_of_existence" && (
                  <div className="flex rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-1 gap-1">
                    {(["text", "file"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setInputTab(t)}
                        className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all capitalize ${
                          inputTab === t
                            ? "bg-white shadow-sm text-[#111] border border-[#E5E5E5]"
                            : "text-[#999] hover:text-[#666]"
                        }`}
                      >
                        {t === "text" ? "Write text" : "Upload file / PDF"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input */}
                {(mode === "sealed_prediction" || inputTab === "text") && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                      Your prediction
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Write your prediction about the future…"
                      rows={6}
                      maxLength={10000}
                      className="w-full rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm text-[#111] placeholder:text-[#CCC] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] resize-none transition-all leading-relaxed"
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] font-mono text-[#CCC]">
                        {text.length} / 10,000
                      </span>
                    </div>
                  </div>
                )}

                {/* File upload */}
                {mode === "proof_of_existence" && inputTab === "file" && (
                  <div className="space-y-3">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                    {!fileHash ? (
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="w-full rounded-2xl border-2 border-dashed border-[#E5E5E5] bg-white p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#6366F1]/40 transition-all"
                      >
                        {fileHashing ? (
                          <>
                            <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
                            <p className="text-sm text-[#666]">Computing SHA-256…</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-[#CCC]" />
                            <p className="text-sm text-[#666] text-center">
                              Drop any file (PDF, image, document)
                            </p>
                            <p className="text-xs text-[#BBB]">or click to browse</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-green-50 border border-green-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-sm font-medium text-green-800 truncate max-w-[200px]">
                              {fileName}
                            </span>
                          </div>
                          <button
                            onClick={() => { setFileHash(null); setFileName(null); }}
                            className="text-xs text-[#999] hover:text-[#666]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] font-mono text-green-700 break-all">
                          SHA-256: {fileHash}
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] text-[#999] leading-relaxed">
                      The file is hashed locally in your browser. It is never uploaded.
                      The hash is a unique fingerprint of the file's exact content.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Step 2: Time-lock ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {mode === "sealed_prediction" ? (
                  /* ─ drand timelock: exact datetime picker ─ */
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-3 block">
                      Unlock date &amp; time
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={targetDatetime.slice(0, 10)}
                        onChange={(e) => {
                          const time = targetDatetime.slice(11, 16) || "00:00";
                          setTargetDatetime(e.target.value ? e.target.value + "T" + time : "");
                        }}
                        min={minDateLocal()}
                        max={maxDateLocal()}
                        className="flex-1 h-12 rounded-2xl border border-[#E5E5E5] bg-white px-4 text-sm font-mono text-[#111] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                      />
                      <input
                        type="time"
                        value={targetDatetime.slice(11, 16)}
                        onChange={(e) => {
                          const date = targetDatetime.slice(0, 10);
                          if (date) setTargetDatetime(date + "T" + e.target.value);
                        }}
                        placeholder="00:00"
                        className="w-28 h-12 rounded-2xl border border-[#E5E5E5] bg-white px-4 text-sm font-mono text-[#111] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                      />
                    </div>
                    {targetDatetime && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-[#999] font-mono">
                          Unlocks: {new Date(targetDatetime).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                        </p>
                        {(() => {
                          try {
                            const round = drandRoundAt(new Date(targetDatetime).getTime());
                            return (
                              <p className="text-[10px] text-[#BBB] font-mono">
                                drand quicknet round #{round.toLocaleString()}
                              </p>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-[#6366F1]/5 border border-[#6366F1]/20">
                      <Lock className="w-3.5 h-3.5 text-[#6366F1] mt-0.5 shrink-0" />
                      <p className="text-[11px] text-[#6366F1] leading-relaxed">
                        Encrypted with drand IBE — mathematically impossible to decrypt before this moment, even with your capsule file.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ─ Proof of Existence: optional datetime picker ─ */
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-[#444] leading-relaxed mb-3">
                        Entro quando prevedi che accada?{" "}
                        <span className="text-[#999] text-xs">(opzionale)</span>
                      </p>

                      <button
                        onClick={() => setPoeHasDate(!poeHasDate)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          poeHasDate
                            ? "border-[#6366F1] bg-[#6366F1]/5"
                            : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${poeHasDate ? "text-[#6366F1]" : "text-[#999]"}`} />
                          <span className={`text-sm font-medium ${poeHasDate ? "text-[#6366F1]" : "text-[#444]"}`}>
                            Aggiungi una data target
                          </span>
                        </div>
                        <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${poeHasDate ? "bg-[#6366F1]" : "bg-[#E5E5E5]"}`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${poeHasDate ? "translate-x-4" : "translate-x-0"}`} />
                        </div>
                      </button>

                      {poeHasDate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 space-y-2"
                        >
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={poeDatetime.slice(0, 10)}
                              onChange={(e) => {
                                const time = poeDatetime.slice(11, 16) || "00:00";
                                setPoeDatetime(e.target.value ? e.target.value + "T" + time : "");
                              }}
                              min={minDateLocal()}
                              max={maxDateLocal()}
                              className="flex-1 h-12 rounded-2xl border border-[#E5E5E5] bg-white px-4 text-sm font-mono text-[#111] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                            />
                            <input
                              type="time"
                              value={poeDatetime.slice(11, 16)}
                              onChange={(e) => {
                                const date = poeDatetime.slice(0, 10);
                                if (date) setPoeDatetime(date + "T" + e.target.value);
                              }}
                              placeholder="00:00"
                              className="w-28 h-12 rounded-2xl border border-[#E5E5E5] bg-white px-4 text-sm font-mono text-[#111] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                            />
                          </div>
                          {poeDatetime && (
                            <p className="text-xs text-[#999] font-mono">
                              Gate: {new Date(poeDatetime).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                            </p>
                          )}
                        </motion.div>
                      )}

                      {!poeHasDate && (
                        <p className="text-xs text-[#BBB] mt-2 font-mono">
                          Senza data: la prediction è verificabile in qualsiasi momento.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                    Keywords{" "}
                    <span className="normal-case text-[#CCC]">(optional, up to 3)</span>
                  </label>
                  <KeywordInput keywords={keywords} onChange={setKeywords} />
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Options ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                    Nome autore{" "}
                    <span className="normal-case text-[#CCC]">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Il tuo nome o alias"
                    maxLength={100}
                    className="w-full h-11 rounded-full border border-[#E5E5E5] bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                  />
                  <p className="text-[10px] text-[#BBB] mt-1.5 ml-1">
                    Visibile nel feed pubblico e nel certificato PDF.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                    Email reminder{" "}
                    <span className="normal-case text-[#CCC]">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full h-11 rounded-full border border-[#E5E5E5] bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                  />
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                    <ShieldCheck className="w-4 h-4 text-[#6366F1] mt-0.5 shrink-0" />
                    <p className="text-[11px] text-[#666] leading-relaxed">
                      You'll receive a confirmation email first. Your reminder is queued only after you confirm ownership of the address.
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isPublic
                        ? "border-[#6366F1] bg-[#6366F1]/5"
                        : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe
                        className={`w-5 h-5 ${isPublic ? "text-[#6366F1]" : "text-[#999]"}`}
                      />
                      <div className="text-left">
                        <p className="text-sm font-semibold">
                          Make prediction public
                        </p>
                        <p className="text-[11px] text-[#666]">
                          {mode === "proof_of_existence" && visibility === "cleartext"
                            ? "Shows full text on community feed. Verifiable by anyone."
                            : "Shows hash preview + year + keywords on the public feed."}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                        isPublic ? "bg-[#6366F1]" : "bg-[#E5E5E5]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          isPublic ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Seal ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {!sealed ? (
                  <>
                    {/* Summary card */}
                    <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
                      <p className="text-[10px] font-mono tracking-widest uppercase text-[#999]">
                        Prediction summary
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                            Mode
                          </p>
                          <p className="font-medium">
                            {mode === "sealed_prediction"
                              ? "Sealed Prediction"
                              : `Proof of Existence (${visibility})`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                            Unlocks
                          </p>
                          <p className="font-medium">
                            {mode === "sealed_prediction" && targetDatetime
                              ? new Date(targetDatetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                              : poeHasDate && poeDatetime
                              ? new Date(poeDatetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                              : "No time gate"}
                          </p>
                        </div>
                        {inputTab === "file" && fileName && (
                          <div className="col-span-2">
                            <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                              File
                            </p>
                            <p className="text-sm font-medium truncate">{fileName}</p>
                          </div>
                        )}
                        {keywords.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-[10px] font-mono text-[#BBB] uppercase mb-1">
                              Keywords
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {keywords.map((k) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 bg-[#F5F5F5] rounded-full text-xs font-mono"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="col-span-2 flex items-center gap-1.5">
                          {isPublic ? (
                            <span className="text-[10px] font-mono text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                              PUBLIC
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#666] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 rounded-full">
                              PRIVATE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {mode === "sealed_prediction" ? (
                          <><strong>Your .capsule file is your only key.</strong>{" "}
                          Store it safely. The drand timelock ciphertext and your RSA signing key are inside.
                          If you lose it, your prediction cannot be revealed.</>
                        ) : visibility === "encrypted" ? (
                          <><strong>Keep your .capsule file safe.</strong>{" "}
                          It contains the AES-256 decryption key. Without it you cannot recover the plaintext.</>
                        ) : (
                          <><strong>Keep your .capsule file safe.</strong>{" "}
                          It contains the hash and proof tokens needed to verify authorship later.</>
                        )}
                      </p>
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleSeal}
                      disabled={sealing}
                      className="w-full h-13 py-3.5 rounded-full bg-[#111111] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-60"
                    >
                      {sealing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-mono">{sealStep}</span>
                        </>
                      ) : mode === "sealed_prediction" ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Generate Keys & Seal
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Hash & Register
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  /* Success state */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="bg-white border border-[#6366F1]/20 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Prediction sealed</p>
                          <p className="text-[10px] font-mono text-[#999]">
                            {predictionId?.slice(0, 8)}…
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {otsStatus === "confirmed" ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-[10px] font-mono text-green-700 uppercase leading-tight">
                              Bitcoin{otsBitcoinBlock ? ` #${otsBitcoinBlock.toLocaleString()}` : " Anchored"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            <span className="text-[10px] font-mono text-amber-700 uppercase">
                              OTS Pending
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-100">
                          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] font-mono text-green-700 uppercase">
                            TSA Signed
                          </span>
                        </div>
                        {arweaveTxId ? (
                          <div className="col-span-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-[10px] font-mono text-indigo-700 uppercase">
                              Arweave Stored
                            </span>
                            <a
                              href={`https://arweave.net/${arweaveTxId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-600" />
                            </a>
                          </div>
                        ) : mode === "proof_of_existence" ? (
                          <div className="col-span-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            <span className="text-[10px] font-mono text-amber-700 uppercase">
                              Arweave upload in progress…
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Your capsule was downloaded. Store it somewhere safe —
                        it's your only key to unlock this prediction.
                      </p>
                    </div>

                    <button
                      onClick={() => downloadCapsule(sealed)}
                      className={`w-full h-12 rounded-full border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        otsStatus === "confirmed"
                          ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                          : "border-[#E5E5E5] bg-white hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      {otsStatus === "confirmed"
                        ? "Re-download with OTS proof"
                        : "Re-download capsule"}
                    </button>

                    <button
                      onClick={() =>
                        generateCertificatePdf({
                          predictionId: sealed.prediction_id ?? "unknown",
                          hash: sealed.hash,
                          mode: sealed.mode,
                          targetYear: sealed.target_year ?? undefined,
                          targetDatetime: sealed.target_datetime ?? null,
                          drandRound: sealed.drand_round ?? null,
                          keywords: sealed.keywords,
                          authorName: authorName.trim() || undefined,
                          createdAt: sealed.created_at,
                          tsaToken: sealed.tsa_token,
                          otsStatus,
                          bitcoinBlock: otsBitcoinBlock,
                          // Proof of existence content fields
                          content: sealed.visibility === "cleartext" && mode === "proof_of_existence"
                            ? (inputTab === "text" ? text.trim() : undefined)
                            : undefined,
                          contentEncrypted: sealed.visibility === "encrypted"
                            ? (sealed.encrypted_content ?? undefined)
                            : undefined,
                          encryptionKey: sealed.encryption_key ?? undefined,
                          arweaveTxId: arweaveTxId ?? undefined,
                        })
                      }
                      className="w-full h-12 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Download Certificate (PDF)
                    </button>

                    <Link href="/">
                      <button className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors">
                        Back to home
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          {!sealed && (
            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="h-11 px-5 rounded-full border border-[#E5E5E5] text-sm flex items-center gap-1.5 hover:bg-[#F5F5F5] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {step < STEPS.length - 1 && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed}
                  className="flex-1 h-11 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-40"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
