import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Hash,
  Copy,
  Check,
  ExternalLink,
  Fingerprint,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { api, type AttestationPageResponse } from "@/lib/api";

export default function Attestation() {
  const [, params] = useRoute("/attestation/:id");
  const attestationId = params?.id ?? "";

  const [data, setData] = useState<AttestationPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!attestationId) return;
    setLoading(true);
    api
      .getAttestation(attestationId)
      .then(setData)
      .catch((err: any) => setError(err?.message ?? "Not found"))
      .finally(() => setLoading(false));
  }, [attestationId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      <main className="flex-1 flex flex-col items-center px-6 py-12 w-full max-w-lg mx-auto">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full space-y-4"
          >
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-2xl bg-[#F0F0F0] animate-pulse"
              />
            ))}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4 py-20"
          >
            <p className="font-semibold text-[#111]">Attestation not found</p>
            <p className="text-sm text-[#666]">{error}</p>
            <Link href="/">
              <button className="h-10 px-6 rounded-full bg-[#111111] text-white text-xs hover:bg-[#222] transition-colors">
                Go home
              </button>
            </Link>
          </motion.div>
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-6">
              Verified Attestation
            </p>

            {/* Certificate card */}
            <div className="relative p-px rounded-3xl bg-gradient-to-b from-[#6366F1]/20 to-[#E5E5E5]/30">
              <div className="bg-white rounded-[23px] p-8 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#BBB] mb-1">
                      Prediction author
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                      {data.display_name}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-[#6366F1]" />
                  </div>
                </div>

                <p className="text-sm text-[#555] leading-relaxed">
                  {data.prediction.mode === "sealed_prediction"
                    ? "Sealed and encrypted this prediction cryptographically, then claimed authorship after the target year."
                    : "Registered this prediction as proof of existence and has now claimed authorship."}
                </p>

                <div className="space-y-3 py-4 border-t border-b border-[#F5F5F5]">
                  {/* Hash */}
                  <div className="flex items-start gap-2">
                    <Hash className="w-4 h-4 text-[#BBB] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Hash (SHA-256)
                      </p>
                      <p className="text-xs font-mono text-[#444] break-all">
                        {data.prediction.hash}
                      </p>
                    </div>
                  </div>

                  {/* Year + Mode */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Target Year
                      </p>
                      <p className="text-sm font-semibold">{data.prediction.target_year}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Registered
                      </p>
                      <p className="text-sm text-[#555]">
                        {new Date(data.prediction.timestamp_utc).toLocaleDateString(
                          "en-GB",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Mode
                      </p>
                      <p className="text-sm capitalize">
                        {data.prediction.mode.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                        Attested
                      </p>
                      <p className="text-sm text-[#555]">
                        {new Date(data.created_at).toLocaleDateString(
                          "en-GB",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Keywords */}
                  {data.prediction.keywords && data.prediction.keywords.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono text-[#BBB] uppercase mb-1">
                        Keywords
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {data.prediction.keywords.map((k) => (
                          <span
                            key={k}
                            className="px-2.5 py-0.5 bg-[#F5F5F5] rounded-full text-xs font-mono"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Proof badges */}
                <div className="flex flex-wrap gap-2">
                  {data.prediction.ots_status === "confirmed" ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Bitcoin Anchored
                      {data.prediction.bitcoin_block && ` · #${data.prediction.bitcoin_block.toLocaleString()}`}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      OTS Pending
                    </span>
                  )}
                  {data.prediction.tsa_token && (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      RFC 3161 TSA
                    </span>
                  )}
                </div>

                {/* Watermark */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5]">
                  <span className="text-[10px] font-mono text-[#CCC] uppercase tracking-widest">
                    yousaidthat.org
                  </span>
                  <motion.div
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-[#6366F1]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={copyUrl}
                className="flex-1 h-11 rounded-full border border-[#E5E5E5] text-sm flex items-center justify-center gap-2 hover:bg-[#F5F5F5] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy link
                  </>
                )}
              </button>
              <Link href={`/verify`}>
                <button className="h-11 px-5 rounded-full border border-[#E5E5E5] text-sm flex items-center gap-2 hover:bg-[#F5F5F5] transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Verify hash
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
