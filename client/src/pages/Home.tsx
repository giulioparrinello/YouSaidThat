import { motion, AnimatePresence } from "framer-motion";
import { Lock, Fingerprint, Clock, ChevronRight, ShieldCheck, Zap, Globe, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextType from "@/components/TextType";

const typewriterText = [
  "Record your ideas about the future.",
  "Seal them with AES-256 encryption.",
  "Verify with cryptographic timestamps.",
  "Reveal them when the year arrives."
];

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] selection:bg-[#3B82F6]/20 relative overflow-hidden flex flex-col font-sans">
      {/* Background Motion Elements */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdib3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjMiIGN5PSIzIiByPSIxIiBmaWxsPSIjMTExMTExIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L2c+PC9zdmc+')] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_20%,transparent_100%)] opacity-60"></div>
        
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#6366F1] blur-[120px] mix-blend-multiply"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.1, 0.05]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#3B82F6] blur-[120px] mix-blend-multiply"
        />
      </div>

      {/* Security Banner */}
      <div className="relative z-20 w-full bg-[#111111] text-[#FAFAFA] py-2 px-4 overflow-hidden group">
        <motion.div 
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="flex whitespace-nowrap gap-8 text-[10px] font-mono tracking-widest uppercase opacity-50"
        >
          <span>AES-256 Client-side Encryption active</span>
          <span>•</span>
          <span>Zero-knowledge Architecture</span>
          <span>•</span>
          <span>Quantum-resistant Hashing (SHA-512)</span>
          <span>•</span>
          <span>OpenTimestamps Protocol</span>
          <span>•</span>
          <span>AES-256 Client-side Encryption active</span>
          <span>•</span>
          <span>Zero-knowledge Architecture</span>
          <span>•</span>
          <span>Quantum-resistant Hashing (SHA-512)</span>
          <span>•</span>
          <span>OpenTimestamps Protocol</span>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 w-full px-6 py-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-6 h-6 rounded bg-[#111111] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#FAFAFA]" />
          </div>
          <span className="font-semibold tracking-tight text-sm text-[#111111]">yousaidthat.org</span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="flex items-center gap-4"
        >
          <span className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-[#666666] border border-[#E5E5E5] px-2 py-0.5 rounded-full bg-white">
            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
            V.01-ALPHA-SECURE
          </span>
          <Button variant="ghost" className="text-sm text-[#666666] hover:text-[#111111] hover:bg-[#111111]/5 font-medium transition-colors">
            Sign In
          </Button>
        </motion.div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col justify-center items-center px-6 md:px-12 w-full max-w-7xl mx-auto pb-24">
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-4xl flex flex-col items-center text-center mt-12 md:mt-20"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] bg-[#6366F1]/5 px-3 py-1 rounded-full border border-[#6366F1]/10">
              The Trustless Future
            </span>
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-7xl lg:text-[88px] font-bold tracking-tighter leading-[1] text-balance mb-8"
          >
            Your Predictions. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#111111] via-[#111111] to-[#6366F1]">Your Proof.</span>
          </motion.h1>
          
          <motion.div 
            variants={itemVariants}
            className="h-[60px] md:h-[40px] flex items-center justify-center mb-12"
          >
            <TextType 
              text={typewriterText}
              className="text-lg md:text-xl text-[#666666] max-w-[600px] leading-relaxed font-normal"
              typingSpeed={75}
              deletingSpeed={50}
              pauseDuration={1500}
              cursorCharacter="_"
              cursorClassName="text-[#6366F1] ml-1 font-bold"
            />
          </motion.div>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative">
             <div className="absolute -top-8 left-1/2 -translate-x-1/2 sm:left-auto sm:right-[-40px] sm:top-[-20px] pointer-events-none">
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-white border border-[#E5E5E5] shadow-sm rounded-lg px-2 py-1 flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3 h-3 text-[#6366F1]" />
                  <span className="text-[9px] font-mono font-bold text-[#111111]">NON-CUSTODIAL</span>
                </motion.div>
             </div>

            <Button 
              size="lg" 
              className="w-full sm:w-auto rounded-full bg-[#111111] text-white hover:bg-[#222222] hover:-translate-y-0.5 transition-all duration-300 h-14 px-8 text-base shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] group overflow-hidden relative"
            >
              <span className="relative z-10 flex items-center">
                Create a Prediction
                <ChevronRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </span>
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto rounded-full border-[#E5E5E5] text-[#111111] hover:bg-white hover:border-[#111111] h-14 px-8 text-base transition-all duration-300 bg-transparent font-medium"
            >
              View Whitepaper
            </Button>
          </motion.div>
        </motion.div>

        {/* Demo Capsule Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 w-full max-w-sm group perspective-1000"
        >
          <div className="relative p-px rounded-3xl bg-gradient-to-b from-[#E5E5E5] to-transparent hover:from-[#6366F1]/40 transition-colors duration-700">
            <div className="absolute inset-0 bg-[#6366F1]/5 blur-3xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="relative bg-white rounded-[23px] p-8 shadow-sm border border-transparent backdrop-blur-xl flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#FAFAFA] flex items-center justify-center border border-[#F0F0F0] mb-2 relative group-hover:rotate-12 transition-transform duration-500">
                <Lock className="h-6 w-6 text-[#111111]" strokeWidth={1.5} />
                <motion.div 
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 border-2 border-[#6366F1] rounded-2xl"
                />
              </div>
              
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold font-mono">Encrypted Payload</div>
                <div className="font-mono text-[11px] text-[#666666] break-all leading-tight opacity-50 overflow-hidden h-8">
                  0x7A2F...9B1E4D...C3A0...F9E2...8B7C...D1A5
                </div>
                <div className="font-semibold text-[#111111] mt-4">Locked until 2040</div>
              </div>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent" />
              
              <div className="flex gap-2 justify-center flex-wrap">
                {["AI", "Energy", "Society"].map((keyword) => (
                  <span key={keyword} className="text-[9px] font-mono font-bold px-2 py-1 rounded-md bg-[#FAFAFA] text-[#111111] border border-[#E5E5E5] uppercase tracking-wider">
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

        {/* Divider */}
        <motion.div 
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
          className="w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent mt-32 mb-20 origin-center"
        />

        {/* Concept Section */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 text-left mb-20">
          {[
            {
              icon: Fingerprint,
              title: "Zero-Knowledge Encryption",
              desc: "Your predictions are sealed locally using AES-256. We don't hold the keys. We can't see your data."
            },
            {
              icon: ShieldCheck,
              title: "Immutable Notarization",
              desc: "Every entry is hashed and anchored to the Bitcoin blockchain via OpenTimestamps for permanent proof."
            },
            {
              icon: Clock,
              title: "Deterministic Reveal",
              desc: "A cryptographically enforced time-lock ensures your vision remains private until the exact block height reached."
            }
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="flex flex-col items-start gap-5 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center border border-[#E5E5E5] shadow-sm text-[#111111] group-hover:text-[#FAFAFA] group-hover:bg-[#111111] group-hover:border-[#111111] transition-all duration-500">
                <feature.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-xl tracking-tight">{feature.title}</h3>
                <p className="text-[#666666] leading-relaxed text-sm md:text-base">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Logos / Tech Section */}
        <motion.div 
           initial={{ opacity: 0 }}
           whileInView={{ opacity: 1 }}
           viewport={{ once: true }}
           className="w-full max-w-4xl flex flex-wrap justify-center items-center gap-12 opacity-30 grayscale contrast-125"
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
      <footer className="relative z-10 w-full py-12 border-t border-[#E5E5E5]/50 mt-auto bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-8 text-xs text-[#666666]">
          <div className="flex flex-col md:items-start items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#111111] tracking-tight text-sm">yousaidthat.org</span>
              <span className="opacity-50">© 2026</span>
            </div>
            <p className="max-w-[300px] text-center md:text-left opacity-70 leading-relaxed">
              An European project. The first trustless, privacy-first infrastructure for future-proof statements.
            </p>
            <div className="mt-2 text-[10px] opacity-60">
              By Giulio Parrinello
            </div>
          </div>
          
          <div className="flex flex-col md:items-end items-center gap-4">
             <div className="flex items-center gap-8">
              <a href="#" className="hover:text-[#111111] transition-colors font-medium">Documentation</a>
              <a href="#" className="hover:text-[#111111] transition-colors font-medium">Security Audit</a>
              <a href="#" className="hover:text-[#111111] transition-colors font-medium">GitHub</a>
            </div>
            <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
              Build: PANKO000 • Node-EU-Central
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}