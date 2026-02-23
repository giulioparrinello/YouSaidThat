import { useState, useRef } from "react";
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
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  decryptContent,
  hashText,
  signHash,
  loadCapsule,
  type CapsuleData,
} from "@/lib/crypto";
import { generateCertificatePdf } from "@/lib/generateCertificate";
import { api } from "@/lib/api";

export default function UnlockPage() {
  const [capsule, setCapsule] = useState<CapsuleData | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [hashMatch, setHashMatch] = useState<boolean | null>(null);
  const [flickerInput, setFlickerInput] = useState("");
  const [flickerResult, setFlickerResult] = useState<boolean | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ url: string } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();

  const handleFile = async (file: File) => {
    setFileError(null);
    setCapsule(null);
    setDecrypted(null);
    setHashMatch(null);
    setFlickerResult(null);
    setClaimResult(null);
    try {
      const c = await loadCapsule(file);
      setCapsule(c);
    } catch (err: any) {
      setFileError(err?.message ?? "Could not read capsule file.");
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
    try {
      const plaintext = await decryptContent(
        capsule.encrypted_content!,
        capsule.nonce!,
        capsule.encryption_key!
      );
      setDecrypted(plaintext);
      // Verify hash
      const h = await hashText(plaintext);
      setHashMatch(h === capsule.hash);
    } catch {
      setDecryptError("Decryption failed. The capsule file may be corrupted.");
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

  const isLocked = capsule ? currentYear < capsule.target_year : false;
  const yearsLeft = capsule ? capsule.target_year - currentYear : 0;
  const progress = capsule
    ? Math.min(
        100,
        Math.max(0, ((currentYear - (capsule.target_year - 10)) / 10) * 100)
      )
    : 0;

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
                Drop your <span className="font-mono">.capsule</span> file here
              </p>
              <p className="text-xs text-[#BBB]">or click to browse</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".capsule,application/json"
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
                        Target Year
                      </p>
                      <p className="font-medium">{capsule.target_year}</p>
                    </div>
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
                        Returns in{" "}
                        <span className="font-semibold text-[#111]">
                          {yearsLeft} {yearsLeft === 1 ? "year" : "years"}
                        </span>{" "}
                        — {capsule.target_year}
                      </p>
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
                      <div className="flex justify-between text-[10px] font-mono text-[#CCC]">
                        <span>{capsule.target_year - 10}</span>
                        <span>{capsule.target_year}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#999]">
                      Come back on January 1, {capsule.target_year} to unlock.
                    </p>
                  </motion.div>
                )}

                {/* ── UNLOCKED: SEALED PREDICTION ── */}
                {!isLocked && capsule.mode === "sealed_prediction" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-green-50 border border-green-200">
                      <Unlock className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        It's {currentYear} — this prediction can be unlocked
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
                          className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Decrypt Content
                        </button>
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
                        </div>

                        {hashMatch && (
                          <button
                            onClick={() =>
                              generateCertificatePdf({
                                predictionId: capsule.prediction_id ?? "unknown",
                                hash: capsule.hash,
                                mode: capsule.mode,
                                targetYear: capsule.target_year,
                                keywords: capsule.keywords,
                                createdAt: capsule.created_at,
                                tsaToken: capsule.tsa_token,
                                otsStatus: capsule.ots_proof ? "confirmed" : "pending",
                                revealedContent: decrypted ?? undefined,
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
                                targetYear: capsule.target_year,
                                keywords: capsule.keywords,
                                createdAt: capsule.created_at,
                                tsaToken: capsule.tsa_token,
                                otsStatus: capsule.ots_proof ? "confirmed" : "pending",
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
                {!isLocked && (decrypted || flickerResult === true) && (
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
