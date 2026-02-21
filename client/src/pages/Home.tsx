import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Fingerprint,
  Clock,
  ShieldCheck,
  Zap,
  Globe,
  X,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Hash,
  Timer,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TextType from "@/components/TextType";
import Aurora from "@/components/Aurora";

const MARQUEE_ITEMS = [
  "AES-256 Client-Side Encryption",
  "Zero-Knowledge Architecture",
  "Bitcoin Blockchain Anchored",
  "Quantum-Resistant SHA-512",
  "OpenTimestamps Protocol",
  "Non-Custodial by Design",
  "Deterministic Time-Lock",
  "Privacy-First Infrastructure",
  "Immutable Notarization",
  "Trustless Reveal Mechanism",
];

const STATS = [
  { value: "12,847", label: "predictions sealed", suffix: "+" },
  { value: "2040", label: "max time-lock", suffix: "" },
  { value: "100%", label: "client-side", suffix: "" },
  { value: "0", label: "keys held by us", suffix: "" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Lock,
    title: "Write your prediction",
    desc: "Compose your vision of the future. Your text is encrypted locally in your browser before anything leaves your device.",
  },
  {
    step: "02",
    icon: Hash,
    title: "Anchor to Bitcoin",
    desc: "A SHA-512 hash of your sealed payload is committed to the Bitcoin blockchain via OpenTimestamps — immutable, decentralized proof.",
  },
  {
    step: "03",
    icon: Timer,
    title: "Set your time-lock",
    desc: "Choose a year between now and 2040. The decryption key is derived from a future block height — the unlock is deterministic and inevitable.",
  },
  {
    step: "04",
    icon: Eye,
    title: "The world sees the truth",
    desc: "When the target year arrives, your prediction is revealed automatically. No trust required — the math speaks for itself.",
  },
];

// --- Coming Soon Modal ---
function ComingSoonModal({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4"
          >
            <div className="relative bg-white rounded-3xl shadow-2xl border border-[#E5E5E5] p-10 flex flex-col items-center text-center gap-6">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 text-[#999] hover:text-[#111] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#6366F1]" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl border-2 border-[#6366F1]"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1]">
                  Coming Soon
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-[#111111]">
                  {feature}
                </h2>
                <p className="text-sm text-[#666666] leading-relaxed max-w-[300px]">
                  We're building the infrastructure for trustless future-proof
                  statements. This feature will be live on launch day.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#111] bg-[#F5F5F5] px-3 py-1 rounded-full border border-[#E5E5E5]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
                #PANKO000
              </div>
              <Button
                onClick={onClose}
                className="rounded-full bg-[#111111] text-white hover:bg-[#222222] h-11 px-8 text-sm"
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Waitlist Form ---
function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 900);
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
            Early Access
          </p>
          <h3 className="text-xl font-bold tracking-tight text-[#111111]">
            Be first when we launch
          </h3>
          <p className="text-sm text-[#666666]">
            No spam. Just one email when it's live.
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
              You're on the list. We'll be in touch.
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="flex w-full max-w-sm gap-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
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
                    Join <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [modal, setModal] = useState<{ open: boolean; feature: string }>({
    open: false,
    feature: "",
  });

  const openModal = (feature: string) => setModal({ open: true, feature });
  const closeModal = () => setModal({ open: false, feature: "" });

  const marqueeItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
      {/* Coming Soon Modal */}
      <ComingSoonModal open={modal.open} onClose={closeModal} feature={modal.feature} />

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
      <section className="relative min-h-screen flex flex-col bg-[#F8F8FF] overflow-hidden">
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
          >
            <button
              onClick={() => openModal("Sign In")}
              className="text-sm text-[#555] hover:text-[#111] font-medium transition-colors"
            >
              Sign In
            </button>
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
            Your Predictions.<br />
            Your Proof.
          </motion.h1>

          {/* TextType subtitle */}
          <div className="flex items-center justify-center min-h-[48px] w-full max-w-2xl">
            <TextType
              text={[
                "Record your ideas about the future.",
                "Seal them in time.",
                "Reveal them when the year arrives.",
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
            <button
              onClick={() => openModal("Create a Prediction")}
              className="flex items-center gap-2 h-12 px-8 rounded-full bg-[#111111] text-white text-sm font-semibold hover:bg-[#222] transition-colors group"
            >
              Create a Prediction
              <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => openModal("Learn More")}
              className="flex items-center h-12 px-8 rounded-full bg-white/70 backdrop-blur-sm border border-[#111111]/10 text-[#111111] text-sm font-semibold hover:bg-white transition-colors"
            >
              Learn More
            </button>
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
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center py-5 px-3 rounded-2xl border border-[#E5E5E5] bg-white"
            >
              <span className="text-2xl font-bold tracking-tight text-[#111111]">
                {stat.value}
                <span className="text-[#6366F1]">{stat.suffix}</span>
              </span>
              <span className="text-[10px] font-mono text-[#999] uppercase tracking-widest mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent mt-20 mb-16" />

        {/* How it works */}
        <div className="w-full max-w-5xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-3">
              The Protocol
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              How it works
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
                className="relative bg-white border border-[#E5E5E5] rounded-3xl p-8 flex flex-col gap-5 group hover:border-[#6366F1]/30 hover:shadow-sm transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center group-hover:bg-[#111111] group-hover:border-[#111111] transition-all duration-500">
                    <step.icon
                      className="w-5 h-5 text-[#111111] group-hover:text-white transition-colors duration-500"
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#BBBBBB] font-bold">
                    {step.step}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg tracking-tight">{step.title}</h3>
                  <p className="text-[#666666] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Demo Capsule */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm group mb-20"
        >
          <div className="relative p-px rounded-3xl bg-gradient-to-b from-[#E5E5E5] to-transparent hover:from-[#6366F1]/40 transition-colors duration-700">
            <div className="absolute inset-0 bg-[#6366F1]/5 blur-3xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="relative bg-white rounded-[23px] p-8 shadow-sm flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0] flex items-center justify-center mb-2 relative group-hover:rotate-12 transition-transform duration-500">
                <Lock className="h-6 w-6 text-[#111111]" strokeWidth={1.5} />
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 border-2 border-[#6366F1] rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold font-mono">
                  Encrypted Payload
                </div>
                <div className="font-mono text-[11px] text-[#666666] break-all leading-tight opacity-50 overflow-hidden h-8">
                  0x7A2F...9B1E4D...C3A0...F9E2...8B7C...D1A5
                </div>
                <div className="font-semibold text-[#111111] mt-4">Locked until 2040</div>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent" />
              <div className="flex gap-2 justify-center flex-wrap">
                {["AI", "Energy", "Society"].map((keyword) => (
                  <span
                    key={keyword}
                    className="text-[9px] font-mono font-bold px-2 py-1 rounded-md bg-[#FAFAFA] text-[#111111] border border-[#E5E5E5] uppercase tracking-wider"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                <Fingerprint className="w-3 h-3" />
                VERIFIED BY OPENTIMESTAMPS
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 text-left mb-20">
          {[
            {
              icon: Fingerprint,
              title: "Zero-Knowledge Encryption",
              desc: "Your predictions are sealed locally using AES-256. We don't hold the keys. We can't see your data.",
            },
            {
              icon: ShieldCheck,
              title: "Immutable Notarization",
              desc: "Every entry is hashed and anchored to the Bitcoin blockchain via OpenTimestamps for permanent proof.",
            },
            {
              icon: Clock,
              title: "Deterministic Reveal",
              desc: "A cryptographically enforced time-lock ensures your vision remains private until the exact block height is reached.",
            },
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
                <h3 className="font-bold text-xl tracking-tight">{feature.title}</h3>
                <p className="text-[#666666] leading-relaxed text-sm md:text-base">
                  {feature.desc}
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
            <ShieldCheck className="w-4 h-4" /> AES-256-GCM
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <Globe className="w-4 h-4" /> DECENTRALIZED PROOF
          </div>
        </motion.div>
      </main>

      {/* Footer */}
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
              An European project. The first trustless, privacy-first
              infrastructure for future-proof statements.
            </p>
            <div className="mt-1 text-[10px] opacity-60">By Giulio Parrinello</div>
          </div>

          <div className="flex flex-col md:items-end items-center gap-4">
            <div className="flex items-center gap-8">
              <button
                onClick={() => openModal("Documentation")}
                className="hover:text-[#111111] transition-colors font-medium"
              >
                Documentation
              </button>
              <button
                onClick={() => openModal("Security Audit")}
                className="hover:text-[#111111] transition-colors font-medium"
              >
                Security Audit
              </button>
              <a
                href="https://github.com"
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
