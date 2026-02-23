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
} from "lucide-react";
import { Link } from "wouter";
import {
  hashText,
  hashBinary,
  hashEmail,
  generateKeyPair,
  encryptContent,
  downloadCapsule,
  type CapsuleData,
} from "@/lib/crypto";
import { api } from "@/lib/api";
import { generateCertificatePdf } from "@/lib/generateCertificate";

type Mode = "proof_of_existence" | "sealed_prediction";

const STEPS = ["Mode", "Prediction", "Time-Lock", "Options", "Seal"];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => currentYear + 1 + i);

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
  const [text, setText] = useState("");
  // File-based hashing (proof_of_existence only)
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHashing, setFileHashing] = useState(false);
  const [inputTab, setInputTab] = useState<"text" | "file">("text");
  const fileRef = useRef<HTMLInputElement>(null);

  const [targetYear, setTargetYear] = useState<number>(currentYear + 1);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Sealing state
  const [sealing, setSealing] = useState(false);
  const [sealStep, setSealStep] = useState("");
  const [sealed, setSealed] = useState<CapsuleData | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
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

  const canProceed = [
    true,           // step 0: mode selection always valid
    hasContent,     // step 1: need text or file hash
    targetYear > currentYear,
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
      // Determine hash: from uploaded file or from text
      let hash: string;
      if (inputTab === "file" && fileHash) {
        hash = fileHash;
        setSealStep("Using file SHA-256 hash…");
      } else {
        setSealStep("Computing SHA-256 hash…");
        hash = await hashText(text.trim());
      }

      setSealStep("Generating RSA-PSS key pair…");
      const { publicKeyPem, privateKeyPem } = await generateKeyPair();

      let encryptedContent: string | null = null;
      let nonce: string | null = null;
      let encryptionKey: string | null = null;

      // Only encrypt text content for sealed_prediction (not file hashes)
      if (mode === "sealed_prediction" && inputTab === "text") {
        setSealStep("Encrypting with AES-256-GCM…");
        const enc = await encryptContent(text.trim());
        encryptedContent = enc.encryptedContent;
        nonce = enc.nonce;
        encryptionKey = enc.encryptionKey;
      }

      setSealStep("Registering on YouSaidThat…");
      const emailHashValue = email.trim() ? await hashEmail(email.trim()) : undefined;
      const res = await api.registerPrediction({
        hash,
        mode,
        target_year: targetYear,
        keywords: keywords.length ? keywords : undefined,
        email_hash: emailHashValue,
        is_public: isPublic,
      });

      setPredictionId(res.prediction_id);

      const capsule: CapsuleData = {
        version: "1.0",
        mode,
        target_year: targetYear,
        keywords,
        hash,
        public_key: publicKeyPem,
        private_key: privateKeyPem,
        encrypted_content: encryptedContent,
        nonce,
        encryption_key: encryptionKey,
        ots_proof: null,
        tsa_token: res.tsa_token,
        created_at: res.created_at ?? new Date().toISOString(),
        prediction_id: res.prediction_id,
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
  }, [text, fileHash, inputTab, mode, targetYear, keywords, email, isPublic]);

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
                  {[
                    {
                      value: "proof_of_existence" as const,
                      icon: Eye,
                      title: "Proof of Existence",
                      badge: "Public-ready",
                      desc: "Your text is hashed and timestamped. No encryption — content is visible when you choose to share it. Best for public claims and verifiable statements.",
                      detail: ["SHA-256 hash", "Bitcoin OTS anchor", "RFC 3161 TSA", "No encryption"],
                    },
                    {
                      value: "sealed_prediction" as const,
                      icon: Lock,
                      title: "Sealed Prediction",
                      badge: "Private",
                      desc: "Your text is encrypted locally with AES-256-GCM before hashing. Only you can decrypt it — the server never sees your content or keys.",
                      detail: ["AES-256-GCM encrypted", "RSA-PSS keypair", "Bitcoin OTS anchor", "Zero-knowledge"],
                    },
                  ].map(({ value, icon: Icon, title, badge, desc, detail }) => (
                    <button
                      key={value}
                      onClick={() => setMode(value)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all ${
                        mode === value
                          ? "border-[#6366F1] bg-[#6366F1]/5 shadow-sm"
                          : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          mode === value ? "bg-[#6366F1]/10" : "bg-[#F5F5F5]"
                        }`}>
                          <Icon className={`w-4 h-4 ${mode === value ? "text-[#6366F1]" : "text-[#999]"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">{title}</p>
                            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              mode === value
                                ? "bg-[#6366F1]/10 text-[#6366F1]"
                                : "bg-[#F5F5F5] text-[#999]"
                            }`}>{badge}</span>
                          </div>
                          <p className="text-[11px] text-[#666] leading-relaxed mb-2">{desc}</p>
                          <div className="flex flex-wrap gap-1">
                            {detail.map((d) => (
                              <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5F5] text-[#888]">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-colors ${
                          mode === value ? "border-[#6366F1] bg-[#6366F1]" : "border-[#DDD] bg-white"
                        }`}>
                          {mode === value && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[3px]" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
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
                  mode === "sealed_prediction"
                    ? "bg-[#6366F1]/5 border border-[#6366F1]/20 text-[#6366F1]"
                    : "bg-[#F5F5F5] border border-[#E5E5E5] text-[#666]"
                }`}>
                  {mode === "sealed_prediction"
                    ? <><Lock className="w-3 h-3" /> Text will be encrypted locally — server never sees it</>
                    : <><FileText className="w-3 h-3" /> Content hash will be timestamped — file stays with you</>
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
                      className="w-full rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm text-[#111] placeholder:text-[#CCC] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] resize-none transition-all leading-relaxed"
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] font-mono text-[#CCC]">
                        {text.length} chars
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
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-3 block">
                    Target year
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {YEAR_OPTIONS.map((y) => (
                      <button
                        key={y}
                        onClick={() => setTargetYear(y)}
                        className={`h-11 rounded-xl text-sm font-mono font-bold transition-all ${
                          targetYear === y
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "bg-white border border-[#E5E5E5] hover:border-[#6366F1]/40 text-[#444]"
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#999] mt-3 font-mono">
                    Your prediction unlocks on January 1, {targetYear}
                  </p>
                </div>

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
                      Privacy-first: only a SHA-256 hash of your email is stored — never the address itself.
                      Email reminders require manual verification at target year (coming soon).
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
                          Shows hash preview + year + keywords on the public
                          feed. Content stays private.
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
                            {mode === "sealed_prediction" ? "Sealed Prediction" : "Proof of Existence"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                            Unlocks
                          </p>
                          <p className="font-medium">{targetYear}</p>
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
                          Store it safely — it contains your encryption key and private key.
                          If you lose it, your prediction cannot be decrypted.</>
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
                          targetYear: sealed.target_year,
                          keywords: sealed.keywords,
                          createdAt: sealed.created_at,
                          tsaToken: sealed.tsa_token,
                          otsStatus,
                          bitcoinBlock: otsBitcoinBlock,
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
