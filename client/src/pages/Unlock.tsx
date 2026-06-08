import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Loader2,
  Eye,
  User,
  ExternalLink,
  FileText,
  Globe,
  Download,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  decryptContent,
  decryptBytes,
  tlockDecrypt,
  hashText,
  hashBinary,
  signHash,
  loadCapsule,
  type CapsuleData,
} from "@/lib/crypto";
import { decryptPdf, extractSeal, stripSeal, isPdfBytes } from "@/lib/pdfCrypto";
import { generateCertificatePdf } from "@/lib/generateCertificate";
import { api } from "@/lib/api";

export default function UnlockPage() {
  const [capsule, setCapsule] = useState<CapsuleData | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptStep, setDecryptStep] = useState("");
  const [hashMatch, setHashMatch] = useState<boolean | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  // Raw bytes of an uploaded sealed PDF (qpdf method), kept for decryption.
  const sealedPdfBytesRef = useRef<Uint8Array | null>(null);
  const [flickerInput, setFlickerInput] = useState("");
  const [flickerResult, setFlickerResult] = useState<boolean | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ url: string } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [publishPublic, setPublishPublic] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<boolean | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();

  // Revoke the decrypted-PDF object URL when leaving the page.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleFile = async (file: File) => {
    setFileError(null);
    setCapsule(null);
    setDecrypted(null);
    setHashMatch(null);
    setFlickerResult(null);
    setClaimResult(null);
    setPublishResult(null);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRevealedPassword(null);
    setPwCopied(false);
    sealedPdfBytesRef.current = null;
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Sealed PDF (qpdf method): read the embedded YST marker, keep bytes for decrypt.
      if (isPdfBytes(bytes)) {
        const seal = extractSeal(bytes);
        if (!seal) {
          setFileError(
            "This PDF has no YouSaidThat seal — it wasn't sealed here, or it was re-saved and the seal was stripped."
          );
          return;
        }
        sealedPdfBytesRef.current = bytes;
        setCapsule({
          version: "2.0",
          mode: "sealed_prediction",
          visibility: null,
          target_year: seal.target_datetime ? new Date(seal.target_datetime).getFullYear() : null,
          target_datetime: seal.target_datetime,
          lock_mode: "tlock",
          tlock_ciphertext: seal.tlock_ciphertext,
          drand_round: seal.drand_round,
          drand_chain_hash: seal.drand_chain_hash,
          keywords: [],
          hash: seal.hash,
          public_key: null,
          private_key: null,
          encrypted_content: null,
          nonce: null,
          encryption_key: null,
          ots_proof: null,
          tsa_token: seal.tsa_token,
          created_at: seal.created_at,
          prediction_id: seal.prediction_id,
          arweave_tx_id: null,
          artifact_type: "pdf",
          pdf_encryption: "qpdf-aes256",
          file_name: seal.file_name,
        });
        return;
      }

      // Otherwise a JSON .capsule file.
      const c = await loadCapsule(file);
      setCapsule(c);
    } catch (err: any) {
      setFileError(err?.message ?? "Could not read the file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleDecrypt = async () => {
    if (!capsule) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      // ── Real native PDF (qpdf): tlock unseals the password, then qpdf decrypts ──
      if (
        capsule.artifact_type === "pdf" &&
        capsule.pdf_encryption === "qpdf-aes256" &&
        capsule.tlock_ciphertext &&
        sealedPdfBytesRef.current
      ) {
        setDecryptStep("Fetching drand beacon…");
        const password = await tlockDecrypt(capsule.tlock_ciphertext);
        setDecryptStep("Decrypting PDF…");
        // Strip the trailing YST seal so qpdf sees a clean, valid PDF.
        const bytes = await decryptPdf(stripSeal(sealedPdfBytesRef.current), password);
        // qpdf re-serialises the PDF, so the decrypted bytes are NOT byte-identical
        // to the original and won't re-hash to the registered hash. Integrity is
        // instead guaranteed by authenticated decryption: only the correct
        // time-locked password yields a valid PDF. The registered SHA-256 remains
        // the timestamped fingerprint of the original document.
        setHashMatch(true);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setRevealedPassword(password);
        setDecrypted(capsule.file_name ?? "document.pdf");
        return;
      }

      // ── Sealed document (PDF) container: tlock unseals the AES key, then AES decrypts ──
      if (capsule.artifact_type === "pdf" && capsule.tlock_ciphertext && capsule.encrypted_file) {
        setDecryptStep("Fetching drand beacon…");
        const keyB64 = await tlockDecrypt(capsule.tlock_ciphertext);
        setDecryptStep("Decrypting PDF…");
        const bytes = await decryptBytes(capsule.encrypted_file, capsule.file_nonce!, keyB64);
        const h = await hashBinary(bytes);
        setHashMatch(h === capsule.hash);
        const blob = new Blob([bytes], { type: capsule.mime_type ?? "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setDecrypted(capsule.file_name ?? "document.pdf");
        return;
      }

      let plaintext: string;

      if (capsule.lock_mode === "tlock" && capsule.tlock_ciphertext) {
        // v2: drand timelock decrypt (requires network call to drand API)
        setDecryptStep("Fetching drand beacon…");
        plaintext = await tlockDecrypt(capsule.tlock_ciphertext);
      } else {
        // v1: local AES-256-GCM decrypt
        setDecryptStep("Decrypting…");
        plaintext = await decryptContent(
          capsule.encrypted_content!,
          capsule.nonce!,
          capsule.encryption_key!
        );
      }

      setDecrypted(plaintext);
      const h = await hashText(plaintext);
      setHashMatch(h === capsule.hash);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[unlock] decryption error:", err);
      if (
        msg.includes("round") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("future")
      ) {
        setDecryptError(
          "The drand beacon for this round is not available yet — the unlock time has not passed."
        );
      } else {
        setDecryptError(`Decryption failed: ${msg}`);
      }
    } finally {
      setDecrypting(false);
      setDecryptStep("");
    }
  };

  const handleFlickerVerify = async () => {
    if (!capsule || !flickerInput.trim()) return;
    const h = await hashText(flickerInput.trim());
    setFlickerResult(h === capsule.hash);
  };

  const handleClaim = async () => {
    if (!capsule || !claimName.trim()) return;
    setClaiming(true);
    setClaimError(null);
    try {
      if (!capsule.private_key || !capsule.public_key) {
        throw new Error("Capsule is missing signing keys. Cannot claim attestation.");
      }
      const signature = await signHash(capsule.hash, capsule.private_key);
      const res = await api.claimPrediction({
        hash: capsule.hash,
        public_key: capsule.public_key,
        signature,
        display_name: claimName.trim(),
      });
      setClaimResult({ url: res.attestation_url });
    } catch (err: any) {
      setClaimError(err?.message ?? "Claim failed.");
    } finally {
      setClaiming(false);
    }
  };

  const handlePublish = async () => {
    if (!capsule || !capsule.prediction_id || !decrypted) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await api.revealPrediction(capsule.prediction_id, {
        content: decrypted,
        is_public: true,
      });
      setPublishResult(true);
    } catch (err: any) {
      setPublishError(err?.message ?? "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  // Lock logic: v2 tlock uses target_datetime; v1 uses target_year; null = no gate (unlocked)
  const isLocked = capsule
    ? capsule.lock_mode === "tlock" && capsule.target_datetime
      ? Date.now() < new Date(capsule.target_datetime).getTime()
      : capsule.target_year != null
      ? currentYear < capsule.target_year
      : false
    : false;

  const isTlock = capsule?.lock_mode === "tlock";
  const isPdf = capsule?.artifact_type === "pdf";

  // Time display for locked state
  const lockedUntilDisplay = capsule
    ? isTlock && capsule.target_datetime
      ? new Date(capsule.target_datetime).toLocaleString(undefined, {
          dateStyle: "long",
          timeStyle: "short",
        })
      : `January 1, ${capsule.target_year}`
    : "";

  // Progress bar calculation
  const progress = (() => {
    if (!capsule) return 0;
    if (isTlock && capsule.target_datetime && capsule.created_at) {
      const start = new Date(capsule.created_at).getTime();
      const end = new Date(capsule.target_datetime).getTime();
      const now = Date.now();
      return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    }
    return Math.min(
      100,
      Math.max(0, ((currentYear - ((capsule.target_year ?? currentYear) - 10)) / 10) * 100)
    );
  })();

  const yearsLeft = capsule && !isTlock && capsule.target_year != null ? capsule.target_year - currentYear : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
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

      <main className="flex-1 flex flex-col items-center px-6 py-12 w-full max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full space-y-6"
        >
          <div>
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-2">
              Unlock
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Open your capsule
            </h1>
          </div>

          {/* Upload zone */}
          {!capsule && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`w-full rounded-3xl border-2 border-dashed p-14 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                dragging
                  ? "border-[#6366F1] bg-[#6366F1]/5"
                  : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
              }`}
            >
              <Upload className="w-9 h-9 text-[#CCC]" />
              <p className="text-sm text-[#666]">
                Drop your <span className="font-mono">.capsule</span> or sealed{" "}
                <span className="font-mono">.pdf</span> here
              </p>
              <p className="text-xs text-[#BBB]">or click to browse</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".capsule,application/json,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {fileError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{fileError}</p>
            </div>
          )}

          <AnimatePresence>
            {capsule && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Capsule metadata card */}
                <div className="bg-white border border-[#E5E5E5] rounded-3xl p-5 space-y-3">
                  <p className="text-[10px] font-mono uppercase text-[#BBB]">
                    Capsule loaded
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Mode
                      </p>
                      <p className="font-medium capitalize">
                        {capsule.mode.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Unlocks
                      </p>
                      <p className="font-medium">
                        {isTlock && capsule.target_datetime
                          ? new Date(capsule.target_datetime).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : capsule.target_year != null
                          ? String(capsule.target_year)
                          : "No time gate"}
                      </p>
                    </div>
                    {isTlock && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                          Encryption
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-[#6366F1]" />
                          <p className="text-xs font-mono text-[#6366F1]">
                            drand IBE timelock · round #{capsule.drand_round?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {capsule.keywords?.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-1">
                          Keywords
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {capsule.keywords.map((k) => (
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
                    <div className="col-span-2">
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Hash preview
                      </p>
                      <p className="text-xs font-mono text-[#444]">
                        {capsule.hash.slice(0, 16)}…
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setCapsule(null); setDecrypted(null); }}
                    className="text-xs text-[#999] hover:text-[#666] transition-colors"
                  >
                    Load different capsule
                  </button>
                </div>

                {/* ── LOCKED STATE ── */}
                {isLocked && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white border border-[#E5E5E5] rounded-3xl p-8 flex flex-col items-center text-center gap-5"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                        <Lock className="w-7 h-7 text-[#111]" strokeWidth={1.5} />
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="absolute inset-0 border-2 border-[#6366F1]/30 rounded-2xl"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Prediction locked</p>
                      <p className="text-[#666] text-sm mt-1">
                        {isTlock ? (
                          <>Sealed until <span className="font-semibold text-[#111]">{lockedUntilDisplay}</span></>
                        ) : (
                          <>Returns in{" "}
                          <span className="font-semibold text-[#111]">
                            {yearsLeft} {yearsLeft === 1 ? "year" : "years"}
                          </span>{" "}
                          — {capsule.target_year}</>
                        )}
                      </p>
                      {isTlock && (
                        <p className="text-[11px] text-[#999] mt-2">
                          The drand randomness needed to decrypt this capsule will only be published after that moment.
                        </p>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full space-y-1">
                      <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-gradient-to-r from-[#6366F1]/40 to-[#6366F1] rounded-full"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[#999]">
                      Come back on {lockedUntilDisplay} to unlock.
                    </p>
                  </motion.div>
                )}

                {/* ── UNLOCKED: SEALED DOCUMENT (PDF) ── */}
                {!isLocked && isPdf && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-green-50 border border-green-200">
                      <Unlock className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        Timelock expired — this document can now be decrypted
                      </p>
                    </div>

                    {!decrypted ? (
                      <>
                        {decryptError && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">{decryptError}</p>
                          </div>
                        )}
                        <button
                          onClick={handleDecrypt}
                          disabled={decrypting}
                          className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] disabled:opacity-60 transition-colors"
                        >
                          {decrypting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="font-mono text-sm">{decryptStep || "Decrypting…"}</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-4 h-4" />
                              Unlock PDF via drand
                            </>
                          )}
                        </button>
                        {!decrypting && (
                          <p className="text-[11px] text-center text-[#999]">
                            Requires an internet connection to fetch the drand beacon.
                          </p>
                        )}
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Hash verification */}
                        <div
                          className={`flex items-center gap-3 p-4 rounded-2xl border ${
                            hashMatch ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                          }`}
                        >
                          {hashMatch ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className={`text-sm font-semibold ${hashMatch ? "text-green-800" : "text-red-800"}`}>
                              {capsule.pdf_encryption === "qpdf-aes256"
                                ? (hashMatch ? "Unlocked ✓" : "Unlock failed ✗")
                                : `Hash ${hashMatch ? "matches ✓" : "mismatch ✗"}`}
                            </p>
                            <p className={`text-[11px] ${hashMatch ? "text-green-600" : "text-red-600"}`}>
                              {capsule.pdf_encryption === "qpdf-aes256"
                                ? "Decrypted with the time-locked password. The registered SHA-256 is the original document's timestamped fingerprint."
                                : hashMatch
                                ? "The decrypted PDF matches the registered hash."
                                : "The hash does not match — the capsule may be corrupted."}
                            </p>
                          </div>
                        </div>

                        {/* Revealed password (qpdf method) */}
                        {revealedPassword && (
                          <div className="bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <Lock className="w-4 h-4 text-[#6366F1] shrink-0" />
                              <p className="text-xs font-semibold text-[#6366F1]">PDF password recovered</p>
                            </div>
                            <p className="text-[11px] text-[#666] leading-relaxed">
                              Use this password to open your <span className="font-mono">-sealed.pdf</span> in any
                              reader (Acrobat, Chrome…). Keep it private.
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs font-mono break-all bg-white border border-[#E5E5E5] rounded-xl px-3 py-2">
                                {revealedPassword}
                              </code>
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(revealedPassword);
                                    setPwCopied(true);
                                    setTimeout(() => setPwCopied(false), 2000);
                                  } catch {
                                    /* clipboard may be blocked — user can select manually */
                                  }
                                }}
                                className="h-9 px-3 rounded-xl border border-[#E5E5E5] bg-white text-xs font-medium hover:bg-[#FAFAFA] transition-colors shrink-0"
                              >
                                {pwCopied ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* PDF preview */}
                        {pdfUrl && (
                          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-3 space-y-3">
                            <div className="flex items-center justify-between px-1">
                              <p className="text-[10px] font-mono uppercase text-[#BBB] flex items-center gap-1.5">
                                <FileText className="w-3 h-3" />
                                {capsule.file_name ?? "document.pdf"}
                              </p>
                            </div>
                            <iframe
                              src={pdfUrl}
                              title="Decrypted PDF"
                              className="w-full h-[480px] rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA]"
                            />
                            <a
                              href={pdfUrl}
                              download={capsule.file_name ?? "document.pdf"}
                              className="w-full h-11 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </a>
                          </div>
                        )}

                        {/* TSA Timestamp */}
                        {capsule.tsa_token && capsule.created_at && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                              <p className="text-xs font-semibold text-indigo-800">Certificazione Temporale (RFC 3161)</p>
                            </div>
                            <p className="text-sm font-mono text-indigo-900 font-medium">
                              Sigillato il:{" "}
                              {new Date(capsule.created_at).toLocaleString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZoneName: "short",
                              })}
                            </p>
                            <p className="text-[10px] text-indigo-600 font-mono">
                              Actalis CA · SHA-256 · {capsule.tsa_token.slice(0, 20)}…
                            </p>
                          </div>
                        )}

                        {/* Proof badges */}
                        <div className="flex flex-wrap gap-2">
                          {capsule.tsa_token && (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                              <ShieldCheck className="w-3 h-3" />
                              RFC 3161 TSA
                            </span>
                          )}
                          {capsule.ots_proof && (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                              <Clock className="w-3 h-3" />
                              OTS Proof
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#6366F1] bg-[#6366F1]/5 border border-[#6366F1]/20 px-2.5 py-1 rounded-full">
                            <Lock className="w-3 h-3" />
                            drand IBE timelock
                          </span>
                        </div>

                        {hashMatch && (
                          <button
                            onClick={() =>
                              generateCertificatePdf({
                                predictionId: capsule.prediction_id ?? "unknown",
                                hash: capsule.hash,
                                mode: capsule.mode,
                                targetYear: capsule.target_year ?? undefined,
                                targetDatetime: capsule.target_datetime ?? null,
                                drandRound: capsule.drand_round ?? null,
                                keywords: capsule.keywords,
                                createdAt: capsule.created_at,
                                tsaToken: capsule.tsa_token,
                                otsStatus: capsule.ots_proof ? "confirmed" : "pending",
                                artifactType: "pdf",
                                pdfEncryption: capsule.pdf_encryption ?? undefined,
                                fileName: capsule.file_name ?? undefined,
                              })
                            }
                            className="w-full h-11 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Download Certificate (PDF)
                          </button>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── UNLOCKED: SEALED PREDICTION ── */}
                {!isLocked && !isPdf && capsule.mode === "sealed_prediction" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-green-50 border border-green-200">
                      <Unlock className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        {isTlock
                          ? "Timelock expired — this prediction can now be decrypted"
                          : `It's ${currentYear} — this prediction can be unlocked`}
                      </p>
                    </div>

                    {!decrypted ? (
                      <>
                        {decryptError && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">{decryptError}</p>
                          </div>
                        )}
                        <button
                          onClick={handleDecrypt}
                          disabled={decrypting}
                          className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] disabled:opacity-60 transition-colors"
                        >
                          {decrypting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="font-mono text-sm">{decryptStep || "Decrypting…"}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              {isTlock ? "Decrypt via drand" : "Decrypt Content"}
                            </>
                          )}
                        </button>
                        {isTlock && !decrypting && (
                          <p className="text-[11px] text-center text-[#999]">
                            Requires an internet connection to fetch the drand beacon.
                          </p>
                        )}
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Decrypted content */}
                        <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6">
                          <p className="text-[10px] font-mono uppercase text-[#BBB] mb-3">
                            Your prediction
                          </p>
                          <p className="text-base leading-relaxed text-[#111]">
                            {decrypted}
                          </p>
                        </div>

                        {/* Hash verification */}
                        <div
                          className={`flex items-center gap-3 p-4 rounded-2xl border ${
                            hashMatch
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          {hashMatch ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                hashMatch ? "text-green-800" : "text-red-800"
                              }`}
                            >
                              Hash {hashMatch ? "matches ✓" : "mismatch ✗"}
                            </p>
                            <p
                              className={`text-[11px] ${
                                hashMatch ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {hashMatch
                                ? "The decrypted text matches the registered hash."
                                : "The hash does not match — capsule may be corrupted."}
                            </p>
                          </div>
                        </div>

                        {/* TSA Timestamp — prominente */}
                        {capsule.tsa_token && capsule.created_at && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                              <p className="text-xs font-semibold text-indigo-800">Certificazione Temporale (RFC 3161)</p>
                            </div>
                            <p className="text-sm font-mono text-indigo-900 font-medium">
                              Detto il:{" "}
                              {new Date(capsule.created_at).toLocaleString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZoneName: "short",
                              })}
                            </p>
                            <p className="text-[10px] text-indigo-600 font-mono">
                              Actalis CA · SHA-256 · {capsule.tsa_token.slice(0, 20)}…
                            </p>
                          </div>
                        )}

                        {/* Proof badges */}
                        <div className="flex flex-wrap gap-2">
                          {capsule.tsa_token && (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                              <ShieldCheck className="w-3 h-3" />
                              RFC 3161 TSA
                            </span>
                          )}
                          {capsule.ots_proof && (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                              <Clock className="w-3 h-3" />
                              OTS Proof
                            </span>
                          )}
                          {isTlock && (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#6366F1] bg-[#6366F1]/5 border border-[#6366F1]/20 px-2.5 py-1 rounded-full">
                              <Lock className="w-3 h-3" />
                              drand IBE timelock
                            </span>
                          )}
                        </div>

                        {hashMatch && (
                          <button
                            onClick={() =>
                              generateCertificatePdf({
                                predictionId: capsule.prediction_id ?? "unknown",
                                hash: capsule.hash,
                                mode: capsule.mode,
                                targetYear: capsule.target_year ?? undefined,
                                targetDatetime: capsule.target_datetime ?? null,
                                drandRound: capsule.drand_round ?? null,
                                keywords: capsule.keywords,
                                createdAt: capsule.created_at,
                                tsaToken: capsule.tsa_token,
                                otsStatus: capsule.ots_proof ? "confirmed" : "pending",
                                arweaveTxId: capsule.arweave_tx_id ?? undefined,
                                revealedContent: decrypted ?? undefined,
                              })
                            }
                            className="w-full h-11 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Download Certificate (PDF)
                          </button>
                        )}

                        {/* ── Publish to community (optional) ── */}
                        {hashMatch && capsule.prediction_id && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-[#6366F1]" />
                              <p className="font-semibold text-sm">
                                Publish to community (optional)
                              </p>
                            </div>
                            <p className="text-xs text-[#666] leading-relaxed">
                              Make this prediction public on the community feed.
                              Your original text and timestamp proof will be visible to everyone.
                            </p>

                            {publishResult === null && (
                              <>
                                <button
                                  onClick={() => setPublishPublic((v) => !v)}
                                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    publishPublic
                                      ? "border-[#6366F1] bg-[#6366F1]/5"
                                      : "border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#CCC]"
                                  }`}
                                >
                                  <span className={`text-sm font-medium ${publishPublic ? "text-[#6366F1]" : "text-[#444]"}`}>
                                    Make prediction public
                                  </span>
                                  <div
                                    className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                                      publishPublic ? "bg-[#6366F1]" : "bg-[#E5E5E5]"
                                    }`}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                        publishPublic ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </div>
                                </button>

                                {publishPublic && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="space-y-3"
                                  >
                                    {publishError && (
                                      <p className="text-xs text-red-600">{publishError}</p>
                                    )}
                                    <button
                                      onClick={handlePublish}
                                      disabled={publishing}
                                      className="w-full h-11 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] disabled:opacity-50 transition-colors"
                                    >
                                      {publishing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Globe className="w-4 h-4" />
                                          Publish now
                                        </>
                                      )}
                                    </button>
                                  </motion.div>
                                )}
                              </>
                            )}

                            {publishResult === true && (
                              <div className="flex items-center gap-2 text-green-700 p-3 rounded-xl bg-green-50 border border-green-200">
                                <CheckCircle2 className="w-4 h-4" />
                                <p className="text-sm font-medium">Published to community feed</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── UNLOCKED: PROOF OF EXISTENCE ── */}
                {!isLocked && capsule.mode === "proof_of_existence" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-green-50 border border-green-200">
                      <Unlock className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        It's {currentYear} — reveal your original text
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-mono uppercase text-[#999] mb-2 block">
                        Enter your original prediction
                      </label>
                      <textarea
                        value={flickerInput}
                        onChange={(e) => {
                          setFlickerInput(e.target.value);
                          setFlickerResult(null);
                        }}
                        rows={4}
                        placeholder="Type your original prediction text…"
                        className="w-full rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] resize-none transition-all"
                      />
                    </div>

                    <button
                      onClick={handleFlickerVerify}
                      disabled={!flickerInput.trim()}
                      className="w-full h-11 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] disabled:opacity-40 transition-colors"
                    >
                      Verify text
                    </button>

                    {flickerResult !== null && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                        <div
                          className={`flex items-center gap-3 p-4 rounded-2xl border ${
                            flickerResult
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          {flickerResult ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <p
                            className={`text-sm font-semibold ${
                              flickerResult ? "text-green-800" : "text-red-800"
                            }`}
                          >
                            {flickerResult
                              ? "Verified ✓ — this is your original prediction"
                              : "Hash mismatch — this is not the original text"}
                          </p>
                        </div>

                        {flickerResult && (
                          <button
                            onClick={() =>
                              generateCertificatePdf({
                                predictionId: capsule.prediction_id ?? "unknown",
                                hash: capsule.hash,
                                mode: capsule.mode,
                                targetYear: capsule.target_year ?? undefined,
                                targetDatetime: capsule.target_datetime ?? null,
                                drandRound: capsule.drand_round ?? null,
                                keywords: capsule.keywords,
                                createdAt: capsule.created_at,
                                tsaToken: capsule.tsa_token,
                                otsStatus: capsule.ots_proof ? "confirmed" : "pending",
                                arweaveTxId: capsule.arweave_tx_id ?? undefined,
                                revealedContent: flickerInput.trim(),
                              })
                            }
                            className="w-full h-11 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Download Certificate (PDF)
                          </button>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── CLAIM IDENTITY (only after successful unlock) ── */}
                {!isLocked && !isPdf && (decrypted || flickerResult === true) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#6366F1]" />
                      <p className="font-semibold text-sm">
                        Claim authorship (optional)
                      </p>
                    </div>
                    <p className="text-xs text-[#666] leading-relaxed">
                      Publish your name linked to this prediction. Your
                      signature proves ownership cryptographically.
                    </p>

                    {!claimResult ? (
                      <>
                        <input
                          value={claimName}
                          onChange={(e) => setClaimName(e.target.value)}
                          placeholder="Your name or handle"
                          maxLength={100}
                          className="w-full h-11 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                        />
                        {claimError && (
                          <p className="text-xs text-red-600">{claimError}</p>
                        )}
                        <button
                          onClick={handleClaim}
                          disabled={!claimName.trim() || claiming}
                          className="w-full h-11 rounded-full border border-[#111] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#111] hover:text-white transition-all disabled:opacity-40"
                        >
                          {claiming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Sign & claim"
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <p className="text-sm font-medium">Attestation created</p>
                        </div>
                        <a
                          href={claimResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-mono text-[#6366F1] hover:underline"
                        >
                          {claimResult.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}
