import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Lock,
  Fingerprint,
  Clock,
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
  Hash,
  Eye,
  ChevronDown,
  ChevronRight,
  Search,
  ThumbsUp,
  ThumbsDown,
  User,
} from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import i18next from "i18next";
import TextType from "@/components/TextType";
import Aurora from "@/components/Aurora";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { api, type PublicPrediction } from "@/lib/api";

// ─── Voter fingerprint ────────────────────────────────────────────────────────
function getVoterFingerprint(): string {
  let fp = localStorage.getItem("yst_voter_fp");
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem("yst_voter_fp", fp);
  }
  return fp;
}

// ─── Format datetime ──────────────────────────────────────────────────────────
function formatDateDisplay(p: PublicPrediction): string {
  if (p.target_datetime) {
    return new Date(p.target_datetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  if (p.target_year) return String(p.target_year);
  return i18next.t("home.noDate");
}

function formatTsaTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const MARQUEE_ITEMS = [
  "drand IBE Timelock Encryption",
  "Zero-Knowledge Architecture",
  "Bitcoin Blockchain Anchored",
  "Arweave Permanent Storage",
  "OpenTimestamps Protocol",
  "Non-Custodial by Design",
  "Mathematically Enforced Time-Lock",
  "Privacy-First Infrastructure",
  "Immutable Notarization",
  "Trustless Reveal Mechanism",
];

const STATIC_STATS = [
  { labelKey: "home.stats.maxTimelock", value: "2040", suffix: "" },
  { labelKey: "home.stats.clientSide", value: "100%", suffix: "" },
  { labelKey: "home.stats.keysHeld", value: "0", suffix: "" },
];

// title/desc live in the i18n dictionaries under home.protocol.stepN;
// crypto labels and hex fragments are terminal-style decoration, kept English.
const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Lock,
    key: "step1",
    cryptoLabel: "MODE SELECT",
    cryptoStatus: "privacy-first",
    hexFragment: "mode...set",
    barWidth: "25%",
  },
  {
    step: "02",
    icon: Hash,
    key: "step2",
    cryptoLabel: "SHA-256 + Arweave",
    cryptoStatus: "stored forever",
    hexFragment: "a3f9...e12b",
    barWidth: "72%",
  },
  {
    step: "03",
    icon: ShieldCheck,
    key: "step3",
    cryptoLabel: "OTS + RFC 3161",
    cryptoStatus: "BTC pending…",
    hexFragment: "9b1e...c3a0",
    barWidth: "91%",
  },
  {
    step: "04",
    icon: Fingerprint,
    key: "step4",
    cryptoLabel: "RSA-PSS 2048",
    cryptoStatus: "Sig valid ✓",
    hexFragment: "d1a5...7f3e",
    barWidth: "100%",
  },
];

// --- Waitlist Form ---
function WaitlistForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? t("common.error"));
      } else {
        setSubmitted(true);
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-8 shadow-sm text-center flex flex-col items-center gap-5">
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
            {t("home.waitlist.kicker")}
          </p>
          <h3 className="text-xl font-bold tracking-tight text-[#111111]">
            {t("home.waitlist.title")}
          </h3>
          <p className="text-sm text-[#666666]">
            {t("home.waitlist.subtitle")}
          </p>
        </div>
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-green-600 font-mono text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t("home.waitlist.success")}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="flex flex-col w-full max-w-sm gap-2"
            >
              <div className="flex w-full gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("home.waitlist.emailPlaceholder")}
                required
                className="flex-1 h-11 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-4 text-sm text-[#111111] placeholder:text-[#BBBBBB] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-11 px-5 rounded-full bg-[#111111] text-white text-sm font-medium hover:bg-[#222222] transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    {t("home.waitlist.join")} <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              </div>
              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Prediction card with like/dislike ───────────────────────────────────────
function PredictionCard({ p, fingerprint }: { p: PublicPrediction; fingerprint: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{
    likes: number;
    dislikes: number;
    my_vote: "like" | "dislike" | null;
  }>({
    likes: p.likes_count,
    dislikes: p.dislikes_count,
    my_vote: p.my_vote,
  });

  const handleVote = useCallback(async (vote_type: "like" | "dislike") => {
    const prev = { ...optimistic };
    // Optimistic update
    const isToggleOff = optimistic.my_vote === vote_type;
    setOptimistic((s) => {
      const next = { ...s };
      if (isToggleOff) {
        next[vote_type === "like" ? "likes" : "dislikes"] = Math.max(0, next[vote_type === "like" ? "likes" : "dislikes"] - 1);
        next.my_vote = null;
      } else {
        if (s.my_vote) {
          next[s.my_vote === "like" ? "likes" : "dislikes"] = Math.max(0, next[s.my_vote === "like" ? "likes" : "dislikes"] - 1);
        }
        next[vote_type === "like" ? "likes" : "dislikes"] += 1;
        next.my_vote = vote_type;
      }
      return next;
    });

    try {
      const result = await api.voteOnPrediction(p.id, { vote_type, fingerprint });
      setOptimistic({ likes: result.likes, dislikes: result.dislikes, my_vote: result.my_vote });
      queryClient.invalidateQueries({ queryKey: ["public-predictions"] });
    } catch {
      setOptimistic(prev); // revert on error
    }
  }, [optimistic, p.id, fingerprint, queryClient]);

  const dateDisplay = formatDateDisplay(p);

  return (
    <Link href={`/p/${p.id}`}>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-2.5 hover:border-[#6366F1]/30 transition-colors flex flex-col cursor-pointer"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {p.author_name ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#6366F1] truncate">
              <User className="w-2.5 h-2.5 shrink-0" />
              {p.author_name}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-[#CCC]">
              {p.content ? "" : `${p.hash_preview}…`}
            </span>
          )}
        </div>
        <span
          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${
            p.ots_status === "confirmed"
              ? "text-green-600 bg-green-50 border-green-100"
              : "text-amber-600 bg-amber-50 border-amber-100"
          }`}
        >
          {p.ots_status === "confirmed" ? "BTC ✓" : t("common.status.pending")}
        </span>
      </div>

      {/* Content */}
      {p.content ? (
        <p className="text-xs text-[#444] leading-relaxed line-clamp-2 flex-1">
          {p.content}
        </p>
      ) : (
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-sm font-bold text-[#111]">{dateDisplay}</span>
          <span className="text-[10px] text-[#CCC]">·</span>
          <span className="text-[10px] text-[#999] capitalize">
            {p.mode.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {/* Date display */}
      <p className="text-[10px] font-mono text-[#BBB]">
        {p.content ? t("home.about", { date: dateDisplay }) : ""}
      </p>

      {/* Keywords */}
      {p.keywords && p.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.keywords.map((k) => (
            <span
              key={k}
              className="px-2 py-0.5 bg-[#F5F5F5] rounded-full text-[10px] font-mono text-[#666]"
            >
              {k}
            </span>
          ))}
        </div>
      )}

      {/* Retroactivity badge */}
      {p.is_retroactive && p.timestamp_utc && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100">
          <ShieldCheck className="w-3 h-3 text-indigo-500 shrink-0" />
          <span className="text-[9px] font-mono text-indigo-600">
            {t("home.retro", { ts: formatTsaTimestamp(p.timestamp_utc) })}
          </span>
        </div>
      )}

      {/* Like/dislike */}
      <div className="flex items-center gap-2 pt-1 mt-auto border-t border-[#F5F5F5]" onClick={(e) => e.preventDefault()}>
        <button
          onClick={() => handleVote("like")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            optimistic.my_vote === "like"
              ? "bg-green-50 text-green-600 border border-green-200"
              : "text-[#999] hover:text-green-600 hover:bg-green-50"
          }`}
        >
          <ThumbsUp className="w-3 h-3" />
          <span className="font-mono">{optimistic.likes}</span>
        </button>
        <button
          onClick={() => handleVote("dislike")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            optimistic.my_vote === "dislike"
              ? "bg-red-50 text-red-500 border border-red-200"
              : "text-[#999] hover:text-red-500 hover:bg-red-50"
          }`}
        >
          <ThumbsDown className="w-3 h-3" />
          <span className="font-mono">{optimistic.dislikes}</span>
        </button>
        <span className="ml-auto text-[9px] font-mono text-[#DDD]">
          {p.hash_preview}…
        </span>
      </div>
    </motion.div>
    </Link>
  );
}

// ─── Public Predictions Feed ──────────────────────────────────────────────────
function PublicFeed() {
  const { t } = useTranslation();
  const fingerprint = getVoterFingerprint();
  const { data, isLoading } = useQuery({
    queryKey: ["public-predictions"],
    queryFn: () => api.getPublicPredictions({ limit: 6, fingerprint }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-white border border-[#E5E5E5] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data?.predictions?.length) return null;

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
          {t("home.feed.title")}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/community">
            <span className="text-xs text-[#6366F1] hover:text-[#4F46E5] transition-colors cursor-pointer flex items-center gap-1 font-medium">
              {t("home.feed.viewAll")} <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
          <Link href="/verify">
            <span className="text-xs text-[#999] hover:text-[#111] transition-colors cursor-pointer flex items-center gap-1">
              <Search className="w-3 h-3" /> {t("home.feed.verifyHash")}
            </span>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.predictions.map((p: PublicPrediction) => (
          <PredictionCard key={p.id} p={p} fingerprint={fingerprint} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    staleTime: 60_000,
  });

  const STATS = [
    {
      value: statsData ? statsData.total.toLocaleString("en-US") : "—",
      labelKey: "home.stats.sealed",
      suffix: statsData ? "+" : "",
    },
    ...STATIC_STATS,
  ];

  const marqueeItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">

      {/* ─── TOP SCROLLING TICKER ─── */}
      <div className="relative z-20 w-full bg-[#111111] text-white py-2 overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="flex whitespace-nowrap gap-0"
        >
          {marqueeItems.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-6 px-8 text-[10px] font-mono tracking-[0.2em] uppercase text-white/50">
              {item}
              <span className="text-[#6366F1] opacity-60">◆</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col bg-[#FAFAFA] overflow-hidden">
        {/* Aurora background */}
        <div className="absolute inset-0 z-0">
          <Aurora
            colorStops={["#5227FF", "#7cff67", "#5227FF", "#816a6a"]}
            amplitude={2}
            blend={0.55}
          />
        </div>

        {/* Nav */}
        <nav className="relative z-10 w-full px-8 py-6 md:px-12 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <span className="font-semibold text-base md:text-lg text-[#111111] tracking-tight">
              yousaidthat.org
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="flex items-center gap-4"
          >
            <Link href="/verify">
              <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
                {t("common.nav.verify")}
              </span>
            </Link>
            <Link href="/seal">
              <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
                {t("common.nav.sealPdf")}
              </span>
            </Link>
            <Link href="/unlock">
              <span className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors cursor-pointer">
                {t("common.nav.unlock")}
              </span>
            </Link>
            <Link href="/create">
              <button className="h-8 px-4 rounded-full bg-[#111111] text-white text-xs font-semibold hover:bg-[#222] transition-colors">
                {t("common.nav.create")}
              </button>
            </Link>
            <LanguageSwitcher />
          </motion.div>
        </nav>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center gap-7 pb-16">

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-7xl lg:text-[88px] font-bold tracking-tighter leading-[1.05] text-[#111111]"
          >
            {t("home.hero.title1")}<br />
            {t("home.hero.title2")}
          </motion.h1>

          {/* TextType subtitle */}
          <div className="flex items-center justify-center min-h-[48px] w-full max-w-2xl">
            <TextType
              key={t("home.hero.type1")}
              text={[
                t("home.hero.type1"),
                t("home.hero.type2"),
                t("home.hero.type3"),
              ]}
              typingSpeed={75}
              pauseDuration={1500}
              showCursor
              cursorCharacter="_"
              deletingSpeed={50}
              cursorBlinkDuration={0.5}
              className="text-xl md:text-2xl font-normal text-center"
              cursorClassName="text-[#6366F1]"
              textColors={["#444444", "#444444", "#444444"]}
            />
          </div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/create">
              <button className="flex items-center gap-2 h-12 px-8 rounded-full bg-[#111111] text-white text-sm font-semibold hover:bg-[#222] transition-colors group">
                {t("home.hero.ctaCreate")}
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
            <Link href="/unlock">
              <button className="flex items-center h-12 px-8 rounded-full bg-white/70 backdrop-blur-sm border border-[#111111]/10 text-[#111111] text-sm font-semibold hover:bg-white transition-colors">
                {t("home.hero.ctaUnlock")}
              </button>
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex justify-center pb-8">
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-[#111111]/25"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>
      </section>

      {/* ─── REST OF PAGE ─── */}
      <main className="flex flex-col items-center px-6 md:px-12 w-full max-w-7xl mx-auto pb-24">

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-20 w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map((stat, i) => {
            const isSealed = stat.labelKey === "home.stats.sealed";
            const content = (
              <>
                <span className="text-2xl font-bold tracking-tight text-[#111111]">
                  {stat.value}
                  <span className="text-[#6366F1]">{stat.suffix}</span>
                </span>
                <span className="text-[10px] font-mono text-[#999] uppercase tracking-widest mt-1">
                  {t(stat.labelKey)}
                </span>
              </>
            );
            return isSealed ? (
              <Link
                key={i}
                href="/community"
                className="flex flex-col items-center text-center py-5 px-3 rounded-2xl border border-[#E5E5E5] bg-white cursor-pointer hover:border-[#6366F1] transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div
                key={i}
                className="flex flex-col items-center text-center py-5 px-3 rounded-2xl border border-[#E5E5E5] bg-white"
              >
                {content}
              </div>
            );
          })}
        </motion.div>

        {/* Divider */}
        <div className="w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent mt-20 mb-16" />

        {/* Two Modes */}
        <div className="w-full max-w-4xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-3">
              {t("home.modes.kicker")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t("home.modes.title")}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mode 1: Proof of Existence */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white border border-[#E5E5E5] rounded-3xl p-8 flex flex-col gap-5"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#111]" strokeWidth={1.5} />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#999] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-1 rounded-full">
                  {t("home.modes.poe.badge")}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight mb-2">
                  {t("home.modes.poe.title")}
                </h3>
                <p className="text-sm text-[#666] leading-relaxed">
                  <Trans i18nKey="home.modes.poe.desc" components={{ b: <strong /> }} />
                </p>
              </div>
              <ul className="space-y-2 mt-auto">
                {[
                  t("home.modes.poe.f1"),
                  t("home.modes.poe.f2"),
                  t("home.modes.poe.f3"),
                  t("home.modes.poe.f4"),
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-[#555]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/create">
                <button className="w-full h-11 rounded-full border border-[#E5E5E5] text-sm font-medium hover:bg-[#F5F5F5] transition-colors flex items-center justify-center gap-2">
                  {t("home.modes.poe.cta")} <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </motion.div>

            {/* Mode 2: Sealed Prediction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-[#111111] text-white rounded-3xl p-8 flex flex-col gap-5"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 bg-white/10 border border-white/10 px-2 py-1 rounded-full">
                  {t("home.modes.sealed.badge")}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight mb-2">
                  {t("home.modes.sealed.title")}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {t("home.modes.sealed.desc")}
                </p>
              </div>
              <ul className="space-y-2 mt-auto">
                {[
                  t("home.modes.sealed.f1"),
                  t("home.modes.sealed.f2"),
                  t("home.modes.sealed.f3"),
                  t("home.modes.sealed.f4"),
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-white/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/create">
                <button className="w-full h-11 rounded-full bg-white text-[#111] text-sm font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2">
                  {t("home.modes.sealed.cta")} <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* How it works */}
        <div className="w-full max-w-5xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-3">
              {t("home.protocol.kicker")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t("home.protocol.title")}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {HOW_IT_WORKS.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="relative bg-white border border-[#E5E5E5] rounded-3xl p-8 flex flex-col gap-5 group hover:border-[#6366F1]/30 hover:shadow-sm transition-all duration-300 overflow-hidden"
              >
                {/* Corner glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#6366F1]/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                {/* Scanning line on hover */}
                <motion.div
                  style={{ top: "10%" }}
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366F1]/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100"
                  animate={{ top: ["10%", "90%", "10%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: idx * 0.8 }}
                />

                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center group-hover:bg-[#111111] group-hover:border-[#111111] transition-all duration-500 relative">
                    <step.icon
                      className="w-5 h-5 text-[#111111] group-hover:text-white transition-colors duration-500"
                      strokeWidth={1.5}
                    />
                    <motion.div
                      animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.4, 0.8] }}
                      transition={{ duration: 3, repeat: Infinity, delay: idx * 0.6 }}
                      className="absolute inset-0 border border-[#6366F1]/30 rounded-2xl pointer-events-none"
                    />
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono text-[#BBBBBB] font-bold">{step.step}</span>
                    <span className="text-[9px] font-mono text-[#6366F1]/50 uppercase tracking-widest">{step.cryptoLabel}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-lg tracking-tight">{t(`home.protocol.${step.key}.title`)}</h3>
                  <p className="text-[#666666] text-sm leading-relaxed">{t(`home.protocol.${step.key}.desc`)}</p>
                </div>

                {/* Crypto footer */}
                <div className="mt-auto pt-4 border-t border-[#F5F5F5] space-y-2.5">
                  {/* Progress bar */}
                  <div className="h-0.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      whileInView={{ width: step.barWidth }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: idx * 0.15 + 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full bg-gradient-to-r from-[#6366F1]/60 to-[#6366F1] rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: idx * 0.4 }}
                        className="w-1.5 h-1.5 rounded-full bg-green-400"
                      />
                      <span className="text-[9px] font-mono text-[#999] uppercase tracking-wider">{step.cryptoStatus}</span>
                    </div>
                    <motion.span
                      animate={{ opacity: [0.25, 0.6, 0.25] }}
                      transition={{ duration: 3.5, repeat: Infinity, delay: idx * 0.5 }}
                      className="text-[9px] font-mono text-[#CCCCCC]"
                    >
                      {step.hexFragment}
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Public Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-5xl mb-16"
        >
          <PublicFeed />
        </motion.div>

        {/* Features */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 text-left mb-20">
          {[
            { icon: Fingerprint, key: "f1" },
            { icon: ShieldCheck, key: "f2" },
            { icon: Clock, key: "f3" },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="flex flex-col items-start gap-5 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E5E5] shadow-sm flex items-center justify-center text-[#111111] group-hover:bg-[#111111] group-hover:text-white group-hover:border-[#111111] transition-all duration-500">
                <feature.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-xl tracking-tight">{t(`home.features.${feature.key}.title`)}</h3>
                <p className="text-[#666666] leading-relaxed text-sm md:text-base">
                  {t(`home.features.${feature.key}.desc`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Waitlist */}
        <WaitlistForm />

        {/* Tech logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="w-full max-w-4xl flex flex-wrap justify-center items-center gap-12 opacity-25 grayscale mt-20"
        >
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <Zap className="w-4 h-4" /> BITCOIN ANCHORED
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <ShieldCheck className="w-4 h-4" /> DRAND IBE TIMELOCK
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <Globe className="w-4 h-4" /> ARWEAVE PERMANENT
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <Globe className="w-4 h-4" /> DECENTRALIZED PROOF
          </div>
        </motion.div>
      </main>

      <footer className="w-full py-12 border-t border-[#E5E5E5]/50 bg-white/50 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-8 text-xs text-[#666666]">
          <div className="flex flex-col md:items-start items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#111111] tracking-tight text-sm">
                yousaidthat.org
              </span>
              <span className="opacity-50">© 2026</span>
            </div>
            <p className="max-w-[300px] text-center md:text-left opacity-70 leading-relaxed">
              {t("common.footer.tagline")}
            </p>
            <div className="mt-1 text-[10px] opacity-60">
              {t("common.footer.by")}{" "}
              <a
                href="https://giulioparrinello.it"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-100 underline underline-offset-2 transition-opacity"
              >
                Giulio Parrinello
              </a>
            </div>
          </div>

          <div className="flex flex-col md:items-end items-center gap-4">
            <div className="flex items-center gap-8">
              <Link href="/docs">
                <span className="hover:text-[#111111] transition-colors font-medium cursor-pointer">
                  {t("common.footer.documentation")}
                </span>
              </Link>
              <Link href="/security-audit">
                <span className="hover:text-[#111111] transition-colors font-medium cursor-pointer">
                  {t("common.footer.securityAudit")}
                </span>
              </Link>
              <Link href="/privacy">
                <span className="hover:text-[#111111] transition-colors font-medium cursor-pointer">
                  {t("common.footer.privacy")}
                </span>
              </Link>
              <a
                href="https://github.com/giulioparrinello/YouSaidThat"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111111] transition-colors font-medium"
              >
                GitHub
              </a>
            </div>
            <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
              Build: PANKO000 · Node-EU-Central
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
