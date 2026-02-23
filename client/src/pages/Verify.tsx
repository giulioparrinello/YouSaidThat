import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FileText,
  Download,
} from "lucide-react";
import { Link } from "wouter";
import { api, type VerifyResponse } from "@/lib/api";
import { loadCapsule } from "@/lib/crypto";
import { generateCertificatePdf } from "@/lib/generateCertificate";

type Tab = "hash" | "capsule";

function OtsStatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full uppercase">
        <CheckCircle2 className="w-3 h-3" />
        Bitcoin Anchored
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full uppercase">
        <XCircle className="w-3 h-3" />
        OTS Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full uppercase">
      <Clock className="w-3 h-3" />
      OTS Pending
    </span>
  );
}

export default function Verify() {
  const [tab, setTab] = useState<Tab>("hash");
  const [hashInput, setHashInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const verify = async (hash: string) => {
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      setError("Please enter a valid 64-character SHA-256 hash (lowercase hex).");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.verifyPrediction(hash);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const capsule = await loadCapsule(file);
      setHashInput(capsule.hash);
      setTab("hash");
      await verify(capsule.hash);
    } catch (err: any) {
      setError(err?.message ?? "Could not read capsule file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

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
            Create a prediction
          </span>
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 py-12 w-full max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-2">
            Verification
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-8">
            Verify a prediction
          </h1>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 bg-[#F5F5F5] rounded-full mb-6 w-fit">
            {(["hash", "capsule"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setResult(null); setError(null); }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  tab === t
                    ? "bg-white shadow-sm text-[#111]"
                    : "text-[#999] hover:text-[#666]"
                }`}
              >
                {t === "hash" ? "Enter Hash" : "Upload Capsule"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "hash" ? (
              <motion.div
                key="hash-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <input
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value.toLowerCase().trim())}
                  onKeyDown={(e) => e.key === "Enter" && verify(hashInput)}
                  placeholder="e.g. a3f9c2d1e8b7f4a2..."
                  maxLength={64}
                  className="w-full h-12 rounded-full border border-[#E5E5E5] bg-white px-5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                />
                <button
                  onClick={() => verify(hashInput)}
                  disabled={hashInput.length !== 64 || loading}
                  className="w-full h-11 rounded-full bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Verify
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="capsule-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`w-full rounded-3xl border-2 border-dashed p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    dragging
                      ? "border-[#6366F1] bg-[#6366F1]/5"
                      : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
                  }`}
                >
                  <Upload className="w-8 h-8 text-[#CCC]" />
                  <p className="text-sm text-[#666]">
                    Drop your <span className="font-mono">.capsule</span> file here
                  </p>
                  <p className="text-xs text-[#BBB]">or click to browse</p>
                </div>
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
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </motion.div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6"
              >
                {result.found ? (
                  <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <p className="font-semibold">Prediction found</p>
                    </div>

                    {/* Hash */}
                    <div>
                      <p className="text-[10px] font-mono uppercase text-[#BBB] mb-1">
                        SHA-256 Hash
                      </p>
                      <p className="text-xs font-mono text-[#444] break-all bg-[#FAFAFA] p-3 rounded-xl border border-[#F0F0F0]">
                        {result.hash}
                      </p>
                    </div>

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                          Mode
                        </p>
                        <p className="font-medium capitalize">
                          {result.mode?.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                          Target Year
                        </p>
                        <p className="font-medium">{result.target_year}</p>
                      </div>
                      {result.keywords && result.keywords.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-1">
                            Keywords
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.keywords.map((k) => (
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
                      <div>
                        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                          Registered
                        </p>
                        <p className="text-xs text-[#666]">
                          {result.timestamp_utc
                            ? new Date(result.timestamp_utc).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      {result.bitcoin_block && (
                        <div>
                          <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                            Bitcoin Block
                          </p>
                          <p className="text-xs font-mono text-[#444]">
                            #{result.bitcoin_block.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Proof badges */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F5F5F5]">
                      <OtsStatusBadge status={result.ots_status ?? "pending"} />
                      {result.tsa_token && (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase">
                          <ShieldCheck className="w-3 h-3" />
                          RFC 3161 TSA
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        generateCertificatePdf({
                          predictionId: result.prediction_id ?? "unknown",
                          hash: result.hash ?? "",
                          mode: (result.mode as "proof_of_existence" | "sealed_prediction") ?? "proof_of_existence",
                          targetYear: result.target_year,
                          keywords: result.keywords ?? [],
                          createdAt: result.timestamp_utc ?? new Date().toISOString(),
                          tsaToken: result.tsa_token,
                          otsStatus: result.ots_status,
                          bitcoinBlock: result.bitcoin_block,
                        })
                      }
                      className="w-full h-10 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1] text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[#6366F1]/10 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download Certificate (PDF)
                    </button>

                    <Link href={`/unlock`}>
                      <button className="w-full h-10 rounded-full bg-[#111111] text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[#222] transition-colors">
                        Unlock this prediction
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 text-center space-y-4">
                    <XCircle className="w-8 h-8 text-[#CCC] mx-auto" />
                    <div>
                      <p className="font-semibold text-[#111]">Hash not found</p>
                      <p className="text-sm text-[#666] mt-1">
                        This hash is not registered on YouSaidThat.
                      </p>
                    </div>
                    <Link href="/create">
                      <button className="h-10 px-6 rounded-full bg-[#111111] text-white text-xs font-medium hover:bg-[#222] transition-colors">
                        Register a prediction
                      </button>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}
