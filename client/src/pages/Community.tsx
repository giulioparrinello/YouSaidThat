import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import {
  Lock,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Search,
  Filter,
  X,
  Bitcoin,
  Users,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { api, type PublicPrediction } from "@/lib/api";

// ─── Card ─────────────────────────────────────────────────────────────────────

function PredictionCard({
  prediction,
  index,
}: {
  prediction: PublicPrediction;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const isSealed = prediction.mode === "sealed_prediction";
  const isConfirmed = prediction.ots_status === "confirmed";

  const dateLabel = new Date(prediction.created_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36, rotateX: -4 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{
        duration: 0.55,
        delay: (index % 3) * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group bg-white border border-[#E5E5E5] rounded-2xl p-5 flex flex-col gap-4 cursor-default hover:border-[#6366F1]/30 hover:shadow-md transition-all"
      style={{ perspective: "600px" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isSealed
                ? "bg-[#6366F1]/10"
                : "bg-[#F5F5F5]"
            }`}
          >
            {isSealed ? (
              <Lock className="w-3.5 h-3.5 text-[#6366F1]" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-[#666]" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#111]">
              {isSealed ? "Sealed Prediction" : "Proof of Existence"}
            </p>
            <p className="text-[10px] font-mono text-[#999]">{dateLabel}</p>
          </div>
        </div>

        {/* Target year badge */}
        <span className="shrink-0 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#111111] text-white">
          {prediction.target_year}
        </span>
      </div>

      {/* Content preview or hash preview */}
      {prediction.content ? (
        <div className="bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl px-3 py-2.5">
          <p className="text-[9px] font-mono text-[#BBB] uppercase mb-1">Prediction</p>
          <p className="text-[12px] text-[#333] leading-relaxed">
            {prediction.content.length > 150
              ? prediction.content.slice(0, 150) + "…"
              : prediction.content}
          </p>
        </div>
      ) : (
        <div className="bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl px-3 py-2">
          <p className="text-[9px] font-mono text-[#BBB] uppercase mb-0.5">SHA-256</p>
          <p className="text-[11px] font-mono text-[#444] tracking-wide">
            {prediction.hash_preview}
            <span className="text-[#CCC]">████████████████████████████████████████████████████████</span>
          </p>
        </div>
      )}

      {/* Keywords */}
      {prediction.keywords && prediction.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prediction.keywords.map((kw) => (
            <span
              key={kw}
              className="px-2.5 py-1 rounded-full bg-[#F5F5F5] border border-[#EBEBEB] text-[10px] font-mono text-[#666]"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* OTS status + Arweave link */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[#F5F5F5] flex-wrap">
        {isConfirmed ? (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Bitcoin anchored
          </span>
        ) : prediction.ots_status === "failed" ? (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            <XCircle className="w-2.5 h-2.5" />
            OTS failed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
            <Clock className="w-2.5 h-2.5 animate-pulse" />
            Pending anchor
          </span>
        )}
        {prediction.arweave_tx_id && (
          <a
            href={`https://arweave.net/${prediction.arweave_tx_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Arweave
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[#F0F0F0]" />
        <div className="space-y-1.5">
          <div className="h-3 w-28 bg-[#F0F0F0] rounded" />
          <div className="h-2.5 w-16 bg-[#F5F5F5] rounded" />
        </div>
      </div>
      <div className="h-10 bg-[#F8F8F8] rounded-xl" />
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-[#F5F5F5] rounded-full" />
        <div className="h-5 w-16 bg-[#F5F5F5] rounded-full" />
      </div>
      <div className="h-5 w-24 bg-[#F5F5F5] rounded-full" />
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [0, ...Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + 1 + i)];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Community() {
  const [predictions, setPredictions] = useState<PublicPrediction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedYear, setSelectedYear] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const LIMIT = 12;

  const fetchPage = useCallback(
    async (pageNum: number, reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getPublicPredictions({
          page: pageNum,
          limit: LIMIT,
          keyword: keyword || undefined,
          year: selectedYear || undefined,
        });
        setPredictions((prev) => (reset ? res.predictions : [...prev, ...res.predictions]));
        setTotal(res.total);
        setHasMore(pageNum * LIMIT < res.total);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load predictions.");
      } finally {
        setLoading(false);
      }
    },
    [keyword, selectedYear]
  );

  // Initial + filter change
  useEffect(() => {
    setPage(1);
    setPredictions([]);
    setHasMore(true);
    fetchPage(1, true);
  }, [keyword, selectedYear]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          const next = page + 1;
          setPage(next);
          fetchPage(next);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  const applyKeyword = () => {
    setKeyword(keywordInput.trim());
  };

  const clearFilters = () => {
    setKeyword("");
    setKeywordInput("");
    setSelectedYear(0);
  };

  const hasFilters = keyword || selectedYear > 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans">
      {/* Nav */}
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60 sticky top-0 bg-[#FAFAFA]/95 backdrop-blur z-20">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/verify">
            <span className="text-xs text-[#666] hover:text-[#111] transition-colors cursor-pointer">
              Verify
            </span>
          </Link>
          <Link href="/create">
            <span className="text-xs bg-[#111] text-white px-3 py-1.5 rounded-full hover:bg-[#333] transition-colors cursor-pointer">
              New prediction
            </span>
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#6366F1]" />
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
              Community Vault
            </p>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Public Predictions
          </h1>
          <p className="text-[#666] text-base max-w-xl leading-relaxed">
            Every entry here is cryptographically timestamped and anchored to the Bitcoin
            blockchain. Content is never stored — only hashes and metadata.
          </p>
          {total > 0 && (
            <p className="text-[11px] font-mono text-[#999] mt-2">
              {total.toLocaleString()} public prediction{total !== 1 ? "s" : ""} registered
            </p>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-8 flex flex-wrap gap-3 items-center"
        >
          {/* Keyword search */}
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCC]" />
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyKeyword()}
                placeholder="Search by keyword…"
                className="w-full h-10 pl-9 pr-4 rounded-full border border-[#E5E5E5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
              />
            </div>
            <button
              onClick={applyKeyword}
              className="h-10 px-4 rounded-full bg-[#111] text-white text-xs font-medium hover:bg-[#333] transition-colors"
            >
              Search
            </button>
          </div>

          {/* Year filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#999]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-10 px-3 rounded-full border border-[#E5E5E5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 transition-all text-[#444]"
            >
              <option value={0}>All years</option>
              {YEAR_OPTIONS.filter((y) => y > 0).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-[#E5E5E5] text-xs text-[#666] hover:bg-[#F5F5F5] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </motion.div>

        {/* Active filters display */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {keyword && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 text-[11px] font-mono text-[#6366F1]">
                keyword: {keyword}
                <button onClick={() => { setKeyword(""); setKeywordInput(""); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedYear > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 text-[11px] font-mono text-[#6366F1]">
                year: {selectedYear}
                <button onClick={() => setSelectedYear(0)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Grid */}
        {predictions.length === 0 && !loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center">
              <Bitcoin className="w-6 h-6 text-[#CCC]" />
            </div>
            <p className="text-[#666] font-medium">No public predictions yet</p>
            <p className="text-sm text-[#999]">
              {hasFilters
                ? "Try different filters, or clear them to see all."
                : "Be the first to add one."}
            </p>
            <Link href="/create">
              <button className="mt-2 h-10 px-5 rounded-full bg-[#111] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#333] transition-colors">
                Add a prediction
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {predictions.map((p, i) => (
              <PredictionCard key={p.id} prediction={p} index={i} />
            ))}
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={`sk-${i}`} />
              ))}
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-8 mt-8" />

        {/* End of results */}
        {!hasMore && predictions.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-[#CCC] font-mono mt-4 pb-8"
          >
            — {predictions.length} prediction{predictions.length !== 1 ? "s" : ""} shown —
          </motion.p>
        )}

        {/* CTA */}
        {!loading && predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-8 rounded-3xl bg-[#111] text-white text-center space-y-4"
          >
            <p className="text-sm font-mono text-[#999] uppercase tracking-widest">Add yours</p>
            <p className="text-2xl font-bold">Your prediction belongs here.</p>
            <p className="text-[#888] text-sm max-w-sm mx-auto">
              Register a public proof of existence and join the vault.
              Anchored to Bitcoin. Immutable. Yours.
            </p>
            <Link href="/create">
              <button className="mt-2 h-11 px-8 rounded-full bg-white text-[#111] font-semibold text-sm hover:bg-[#E5E5E5] transition-colors inline-flex items-center gap-2">
                Create a prediction
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
