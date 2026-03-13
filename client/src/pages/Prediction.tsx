import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Hash,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Eye,
  Calendar,
  Tag,
  User,
  Bitcoin,
  ArrowRight,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { api, type PredictionDetailResponse } from "@/lib/api";

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] border border-[#EBEBEB] flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

export default function Prediction() {
  const [, params] = useRoute("/p/:id");
  const predictionId = params?.id ?? "";

  const [data, setData] = useState<PredictionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!predictionId) return;
    setLoading(true);
    api
      .getPrediction(predictionId)
      .then(setData)
      .catch((err: any) => setError(err?.message ?? "Prediction not found"))
      .finally(() => setLoading(false));
  }, [predictionId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyHash = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const isSealed = data?.mode === "sealed_prediction";
  const isConfirmed = data?.ots_status === "confirmed";

  const registeredDate = data?.timestamp_utc ?? data?.created_at;
  const registeredLabel = registeredDate
    ? new Date(registeredDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const targetLabel = data?.target_datetime
    ? new Date(data.target_datetime).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : data?.target_year
    ? String(data.target_year)
    : "—";

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
      {/* Nav */}
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60 sticky top-0 bg-[#FAFAFA]/95 backdrop-blur z-20">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/community">
            <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
              Community
            </span>
          </Link>
          <Link href="/verify">
            <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
              Verify
            </span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 py-12 w-full max-w-lg mx-auto">
        {/* Loading */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full space-y-4"
          >
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-[#F0F0F0] animate-pulse" />
            ))}
          </motion.div>
        )}

        {/* Error */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4 py-20"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6 text-[#CCC]" />
            </div>
            <p className="font-semibold text-[#111]">Prediction not found</p>
            <p className="text-sm text-[#666]">{error}</p>
            <Link href="/community">
              <button className="mt-2 h-10 px-6 rounded-full bg-[#111] text-white text-xs hover:bg-[#333] transition-colors">
                Back to community
              </button>
            </Link>
          </motion.div>
        )}

        {/* Content */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full"
          >
            {/* Label */}
            <div className="flex items-center gap-2 mb-6">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSealed ? "bg-[#6366F1]/10" : "bg-[#F5F5F5]"
                }`}
              >
                {isSealed ? (
                  <Lock className="w-3.5 h-3.5 text-[#6366F1]" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-[#666]" />
                )}
              </div>
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
                {isSealed ? "Sealed Prediction" : "Proof of Existence"}
              </p>
            </div>

            {/* Card */}
            <div className="relative p-px rounded-3xl bg-gradient-to-b from-[#6366F1]/20 to-[#E5E5E5]/30">
              <div className="bg-white rounded-[23px] p-7 space-y-5">

                {/* Hash */}
                <Row
                  icon={<Hash className="w-3.5 h-3.5 text-[#999]" />}
                  label="SHA-256 Hash"
                >
                  <div className="flex items-start gap-2">
                    <p className="text-[11px] font-mono text-[#444] break-all leading-relaxed flex-1">
                      {data.hash}
                    </p>
                    <button
                      onClick={copyHash}
                      className="shrink-0 mt-0.5 text-[#CCC] hover:text-[#6366F1] transition-colors"
                      title="Copy hash"
                    >
                      {copiedHash ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </Row>

                <div className="border-t border-[#F5F5F5]" />

                {/* Dates grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">Registered</p>
                    <p className="text-sm text-[#444]">{registeredLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-[#BBB] uppercase mb-0.5">
                      {data.target_datetime ? "Unlock date" : "Target year"}
                    </p>
                    <p className="text-sm font-semibold">{targetLabel}</p>
                  </div>
                </div>

                {/* Author */}
                {data.author_name && (
                  <Row icon={<User className="w-3.5 h-3.5 text-[#999]" />} label="Author">
                    <p className="text-sm text-[#444]">{data.author_name}</p>
                  </Row>
                )}

                {/* Content (proof_of_existence public) */}
                {data.content && (
                  <Row icon={<Eye className="w-3.5 h-3.5 text-[#999]" />} label="Prediction">
                    <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap mt-0.5">
                      {data.content}
                    </p>
                  </Row>
                )}

                {/* Keywords */}
                {data.keywords && data.keywords.length > 0 && (
                  <Row icon={<Tag className="w-3.5 h-3.5 text-[#999]" />} label="Keywords">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {data.keywords.map((k) => (
                        <span
                          key={k}
                          className="px-2.5 py-0.5 bg-[#F5F5F5] rounded-full text-[11px] font-mono text-[#666]"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </Row>
                )}

                <div className="border-t border-[#F5F5F5]" />

                {/* Proof badges */}
                <div className="flex flex-wrap gap-2">
                  {isConfirmed ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Bitcoin Anchored
                      {data.bitcoin_block && ` · #${data.bitcoin_block.toLocaleString()}`}
                    </span>
                  ) : data.ots_status === "failed" ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      OTS Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3 animate-pulse" />
                      Pending Bitcoin Anchor
                    </span>
                  )}

                  {data.tsa_token && (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      RFC 3161 TSA
                    </span>
                  )}

                  {data.is_public && (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#666] bg-[#F5F5F5] border border-[#E5E5E5] px-2.5 py-1 rounded-full">
                      <Eye className="w-3 h-3" />
                      Public
                    </span>
                  )}
                </div>

                {/* Watermark */}
                <div className="flex items-center justify-between pt-1 border-t border-[#F5F5F5]">
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
            <div className="flex gap-3 mt-5 flex-wrap">
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

              <Link href={`/verify?hash=${data.hash}`}>
                <button className="h-11 px-5 rounded-full border border-[#E5E5E5] text-sm flex items-center gap-2 hover:bg-[#F5F5F5] transition-colors whitespace-nowrap">
                  <ExternalLink className="w-4 h-4" />
                  Verify
                </button>
              </Link>

              {isSealed && (
                <Link href={`/unlock`}>
                  <button className="h-11 px-5 rounded-full bg-[#6366F1] text-white text-sm flex items-center gap-2 hover:bg-[#4F46E5] transition-colors whitespace-nowrap">
                    <Lock className="w-4 h-4" />
                    Unlock
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              )}

              {data.arweave_tx_id && (
                <a
                  href={`https://arweave.net/${data.arweave_tx_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-5 rounded-full border border-[#E5E5E5] text-sm flex items-center gap-2 hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  Arweave
                </a>
              )}
            </div>

            {/* OTS details (expanded if confirmed) */}
            {isConfirmed && data.ots_proof && (
              <motion.details
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 group"
              >
                <summary className="flex items-center gap-2 text-xs text-[#999] cursor-pointer hover:text-[#666] transition-colors select-none list-none">
                  <Bitcoin className="w-3.5 h-3.5 text-amber-500" />
                  Show OTS proof (base64)
                </summary>
                <div className="mt-3 p-4 rounded-2xl bg-[#F8F8F8] border border-[#F0F0F0]">
                  <p className="text-[10px] font-mono text-[#AAA] break-all leading-relaxed">
                    {data.ots_proof}
                  </p>
                </div>
              </motion.details>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
