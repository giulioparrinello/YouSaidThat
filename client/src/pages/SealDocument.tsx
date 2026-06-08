import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import {
  hashBinary,
  encryptBytes,
  tlockEncrypt,
  drandRoundAt,
  DRAND_CHAIN_HASH,
  downloadCapsule,
  type CapsuleData,
} from "@/lib/crypto";
import {
  encryptPdf,
  randomPassword,
  appendSeal,
  type SealData,
} from "@/lib/pdfCrypto";
import { api } from "@/lib/api";
import { generateCertificatePdf } from "@/lib/generateCertificate";

type SealMethod = "qpdf-aes256" | "container";

/** Trigger a browser download of raw bytes. */
function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STEPS = ["Document", "Time-Lock", "Seal"];

// 8 MB cap — base64 inside the .capsule inflates ~33%, kept comfortable for download.
const MAX_BYTES = 8 * 1024 * 1024;

function minDateLocal(): string {
  return new Date().toISOString().slice(0, 10);
}
function maxDateLocal(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 50);
  return d.toISOString().slice(0, 10);
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function SealDocument() {
  const [step, setStep] = useState(0);

  // Encryption method: real native PDF (qpdf) vs YST container (.capsule).
  const [method, setMethod] = useState<SealMethod>("qpdf-aes256");

  // Document state — the raw bytes are kept client-side only, never uploaded.
  const fileBufRef = useRef<ArrayBuffer | null>(null);
  // Sealed PDF bytes (qpdf method) kept for re-download.
  const sealedPdfRef = useRef<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileHashing, setFileHashing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Unlock datetime (required)
  const [targetDatetime, setTargetDatetime] = useState<string>("");

  // Optional metadata
  const [authorName, setAuthorName] = useState("");
  const [email, setEmail] = useState("");

  // Sealing state
  const [sealing, setSealing] = useState(false);
  const [sealStep, setSealStep] = useState("");
  const [sealed, setSealed] = useState<CapsuleData | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTS polling (after sealing)
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
          setSealed((prev) => (prev ? { ...prev, ots_proof: status.ots_proof } : prev));
        }
      } catch {
        // silent — polling errors should not interrupt UX
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [predictionId, sealed, otsStatus]);

  const handleFile = async (file: File) => {
    setFileError(null);
    setFileHash(null);
    setFileName(null);
    fileBufRef.current = null;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Only PDF files are supported in this phase.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError(`File too large (${prettySize(file.size)}). Max ${prettySize(MAX_BYTES)}.`);
      return;
    }

    setFileHashing(true);
    try {
      const buf = await file.arrayBuffer();
      const h = await hashBinary(buf);
      fileBufRef.current = buf;
      setFileHash(h);
      setFileName(file.name);
      setFileSize(file.size);
    } catch {
      setFileError("Could not read the file. Please try again.");
    } finally {
      setFileHashing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    fileBufRef.current = null;
    setFileHash(null);
    setFileName(null);
    setFileSize(0);
    setFileError(null);
  };

  const step1ok = targetDatetime !== "" && new Date(targetDatetime) > new Date();
  const canProceed = [fileHash !== null, step1ok, true][step];

  const handleSeal = useCallback(async () => {
    if (!fileBufRef.current || !fileHash) return;
    setSealing(true);
    setError(null);

    try {
      const buffer = fileBufRef.current;
      const hash = fileHash;
      const targetMs = new Date(targetDatetime).getTime();
      const effectiveDatetime = new Date(targetDatetime).toISOString();
      const base = (fileName ?? "document").replace(/\.pdf$/i, "");

      if (method === "qpdf-aes256") {
        // ── Real native PDF (qpdf AES-256), password sealed with tlock ──
        const userPw = randomPassword();
        const ownerPw = randomPassword();

        setSealStep("Encrypting PDF with AES-256 (qpdf)…");
        const encPdf = await encryptPdf(buffer, userPw, ownerPw);

        setSealStep("Sealing password with drand timelock…");
        const tlock = await tlockEncrypt(userPw, targetMs);

        setSealStep("Registering on YouSaidThat…");
        const res = await api.registerPrediction({
          hash,
          mode: "sealed_prediction",
          target_year: new Date(targetDatetime).getFullYear(),
          author_name: authorName.trim() || undefined,
          email: email.trim() ? email.trim().toLowerCase() : undefined,
          is_public: false,
          drand_round: tlock.round,
          target_datetime: effectiveDatetime,
        });
        setPredictionId(res.prediction_id);

        // Embed the sealed password inside the PDF (cleartext marker after %%EOF)
        const seal: SealData = {
          v: 1,
          alg: "qpdf-aes256",
          tlock_ciphertext: tlock.ciphertext,
          drand_round: tlock.round,
          drand_chain_hash: DRAND_CHAIN_HASH,
          hash,
          prediction_id: res.prediction_id,
          target_datetime: effectiveDatetime,
          file_name: fileName ?? "document.pdf",
          tsa_token: res.tsa_token,
          created_at: res.created_at ?? new Date().toISOString(),
        };
        setSealStep("Embedding seal & saving PDF…");
        const finalBytes = appendSeal(encPdf, seal);
        sealedPdfRef.current = finalBytes;
        downloadBytes(finalBytes, `${base}-sealed.pdf`, "application/pdf");

        // Minimal CapsuleData for the success screen + certificate (no blob inside)
        setSealed({
          version: "2.0",
          mode: "sealed_prediction",
          visibility: null,
          target_year: new Date(targetDatetime).getFullYear(),
          target_datetime: effectiveDatetime,
          lock_mode: "tlock",
          tlock_ciphertext: null,
          drand_round: tlock.round,
          drand_chain_hash: DRAND_CHAIN_HASH,
          keywords: [],
          hash,
          public_key: null,
          private_key: null,
          encrypted_content: null,
          nonce: null,
          encryption_key: null,
          ots_proof: null,
          tsa_token: res.tsa_token,
          created_at: res.created_at ?? new Date().toISOString(),
          prediction_id: res.prediction_id,
          arweave_tx_id: null,
          artifact_type: "pdf",
          pdf_encryption: "qpdf-aes256",
          file_name: fileName,
          file_size: fileSize,
          mime_type: "application/pdf",
        });
        return;
      }

      // ── Container (.capsule): AES-256-GCM blob, key sealed with tlock ──
      setSealStep("Encrypting PDF with AES-256-GCM…");
      const enc = await encryptBytes(buffer);

      setSealStep("Sealing key with drand timelock…");
      const tlock = await tlockEncrypt(enc.keyB64, targetMs);

      setSealStep("Registering on YouSaidThat…");
      const res = await api.registerPrediction({
        hash,
        mode: "sealed_prediction",
        target_year: new Date(targetDatetime).getFullYear(),
        author_name: authorName.trim() || undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        is_public: false,
        drand_round: tlock.round,
        target_datetime: effectiveDatetime,
      });
      setPredictionId(res.prediction_id);

      const capsule: CapsuleData = {
        version: "2.0",
        mode: "sealed_prediction",
        visibility: null,
        target_year: new Date(targetDatetime).getFullYear(),
        target_datetime: effectiveDatetime,
        lock_mode: "tlock",
        tlock_ciphertext: tlock.ciphertext, // sealed AES key
        drand_round: tlock.round,
        drand_chain_hash: DRAND_CHAIN_HASH,
        keywords: [],
        hash,
        public_key: null,
        private_key: null,
        encrypted_content: null,
        nonce: null,
        encryption_key: null,
        ots_proof: null,
        tsa_token: res.tsa_token,
        created_at: res.created_at ?? new Date().toISOString(),
        prediction_id: res.prediction_id,
        arweave_tx_id: null,
        artifact_type: "pdf",
        pdf_encryption: "container",
        encrypted_file: enc.ciphertext,
        file_nonce: enc.nonce,
        file_name: fileName,
        file_size: fileSize,
        mime_type: "application/pdf",
      };

      setSealStep("Generating capsule file…");
      downloadCapsule(capsule, `${base}-sealed-${hash.slice(0, 8)}.capsule`);
      setSealed(capsule);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSealing(false);
      setSealStep("");
    }
  }, [fileHash, targetDatetime, authorName, email, fileName, fileSize, method]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
      {/* Nav */}
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <Link href="/unlock">
          <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
            Unlock a capsule
          </span>
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start px-6 py-12 w-full max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-2">
            Sealed Document
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Time-lock a PDF</h1>
          <p className="text-sm text-[#666] leading-relaxed mb-8">
            Your PDF is encrypted in your browser with a strong key we never see. The key is
            sealed with a drand timelock — nobody can open it before your chosen date.
          </p>

          <StepBar current={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 0: Upload PDF ── */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Encryption method */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                    Output format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMethod("qpdf-aes256")}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        method === "qpdf-aes256"
                          ? "border-[#6366F1] bg-[#6366F1]/5"
                          : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${method === "qpdf-aes256" ? "text-[#6366F1]" : "text-[#111]"}`}>
                        Real PDF (.pdf)
                      </p>
                      <p className="text-[10px] text-[#666] leading-relaxed">
                        A genuine AES-256 password-protected PDF, openable in any reader. Self-unlocks here.
                      </p>
                    </button>
                    <button
                      onClick={() => setMethod("container")}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        method === "container"
                          ? "border-[#6366F1] bg-[#6366F1]/5"
                          : "border-[#E5E5E5] bg-white hover:border-[#CCC]"
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${method === "container" ? "text-[#6366F1]" : "text-[#111]"}`}>
                        Container (.capsule)
                      </p>
                      <p className="text-[10px] text-[#666] leading-relaxed">
                        A YST capsule file. Opens only on yousaidthat.org.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-mono bg-[#6366F1]/5 border border-[#6366F1]/20 text-[#6366F1]">
                  <Lock className="w-3 h-3" /> Encrypted locally — the server never sees the PDF or the key
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />

                {!fileHash ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`w-full rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                      dragging ? "border-[#6366F1] bg-[#6366F1]/5" : "border-[#E5E5E5] bg-white hover:border-[#6366F1]/40"
                    }`}
                  >
                    {fileHashing ? (
                      <>
                        <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
                        <p className="text-sm text-[#666]">Computing SHA-256…</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-[#CCC]" />
                        <p className="text-sm text-[#666] text-center">Drop your PDF here</p>
                        <p className="text-xs text-[#BBB]">or click to browse · max {prettySize(MAX_BYTES)}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-sm font-medium text-green-800 truncate max-w-[220px]">
                          {fileName}
                        </span>
                        <span className="text-[10px] font-mono text-green-600 shrink-0">
                          {prettySize(fileSize)}
                        </span>
                      </div>
                      <button onClick={clearFile} className="text-xs text-[#999] hover:text-[#666]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-green-700 break-all">SHA-256: {fileHash}</p>
                  </div>
                )}

                {fileError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{fileError}</p>
                  </div>
                )}

                <p className="text-[11px] text-[#999] leading-relaxed">
                  The PDF is encrypted and hashed locally in your browser. Only the hash and the
                  unlock date are registered — the encrypted file stays inside the capsule you download.
                </p>
              </motion.div>
            )}

            {/* ── Step 1: Time-lock ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
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
                      The AES key is sealed with drand IBE — mathematically impossible to recover before
                      this moment, even with the capsule file in hand.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                      Author name <span className="normal-case text-[#CCC]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Your name or alias"
                      maxLength={100}
                      className="w-full h-11 rounded-full border border-[#E5E5E5] bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-[#999] mb-2 block">
                      Email reminder <span className="normal-case text-[#CCC]">(optional)</span>
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
                        We'll email you when the unlock date arrives. A confirmation email is sent first.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Seal ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {!sealed ? (
                  <>
                    <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
                      <p className="text-[10px] font-mono tracking-widest uppercase text-[#999]">
                        Document summary
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2">
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">File</p>
                          <p className="font-medium truncate">
                            {fileName} <span className="text-[#999] font-mono text-xs">· {prettySize(fileSize)}</span>
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">Unlocks</p>
                          <p className="font-medium">
                            {new Date(targetDatetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">SHA-256</p>
                          <p className="text-[11px] font-mono text-[#444] break-all">{fileHash}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Your .capsule file is your only copy.</strong> It holds the encrypted
                        PDF and the sealed key. We never receive them. If you lose it, the document
                        cannot be recovered.
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
                      className="w-full py-3.5 rounded-full bg-[#111111] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-60"
                    >
                      {sealing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-mono">{sealStep}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Encrypt &amp; Seal
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  /* Success */
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
                          <p className="text-sm font-bold">Document sealed</p>
                          <p className="text-[10px] font-mono text-[#999]">{predictionId?.slice(0, 8)}…</p>
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
                            <span className="text-[10px] font-mono text-amber-700 uppercase">OTS Pending</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-100">
                          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] font-mono text-green-700 uppercase">TSA Signed</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {sealed.pdf_encryption === "qpdf-aes256" ? (
                          <>Your sealed <strong>PDF</strong> was downloaded. Store it safely — it's your only
                          copy, and it self-unlocks here on{" "}
                          {new Date(targetDatetime).toLocaleDateString(undefined, { dateStyle: "long" })}.</>
                        ) : (
                          <>Your capsule was downloaded. Store it safely — it's your only key to unlock this
                          PDF on {new Date(targetDatetime).toLocaleDateString(undefined, { dateStyle: "long" })}.</>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const base = (fileName ?? "document").replace(/\.pdf$/i, "");
                        if (sealed.pdf_encryption === "qpdf-aes256" && sealedPdfRef.current) {
                          downloadBytes(sealedPdfRef.current, `${base}-sealed.pdf`, "application/pdf");
                        } else {
                          downloadCapsule(sealed, `${base}-sealed-${sealed.hash.slice(0, 8)}.capsule`);
                        }
                      }}
                      className="w-full h-12 rounded-full border border-[#E5E5E5] bg-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#FAFAFA] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      {sealed.pdf_encryption === "qpdf-aes256" ? "Re-download sealed PDF" : "Re-download capsule"}
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
                          artifactType: "pdf",
                          pdfEncryption: sealed.pdf_encryption ?? undefined,
                          fileName: sealed.file_name ?? undefined,
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

          {/* Navigation */}
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
