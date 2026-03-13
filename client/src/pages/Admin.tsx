import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { Link } from "wouter";
import { api, type AdminStatsResponse, type AdminPendingArweaveResponse } from "@/lib/api";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [pendingArweave, setPendingArweave] = useState<AdminPendingArweaveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async (adminSecret: string) => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, pendingData] = await Promise.all([
        api.admin.getStats(adminSecret),
        api.admin.getPendingArweave(adminSecret),
      ]);
      setStats(statsData);
      setPendingArweave(pendingData);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load admin data";
      setError(msg);
      if (msg.includes("Unauthorized") || msg.includes("401")) {
        setAuthed(false);
        setAuthError("Invalid admin secret.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      await api.admin.getStats(secret);
      setAuthed(true);
      fetchData(secret);
    } catch (err: any) {
      setAuthError(err?.message ?? "Authentication failed");
    }
  };

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => fetchData(secret), 30_000);
    return () => clearInterval(id);
  }, [authed, secret, fetchData]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await api.admin.retryArweave(secret, id);
      await fetchData(secret);
    } catch (err: any) {
      setError(err?.message ?? "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
        <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60">
          <Link href="/">
            <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
              yousaidthat.org
            </span>
          </Link>
        </nav>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[#6366F1]/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#6366F1]" />
              </div>
              <div>
                <p className="font-semibold">Admin Panel</p>
                <p className="text-[11px] text-[#999]">YouSaidThat.org</p>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Admin secret…"
                className="w-full h-11 rounded-full border border-[#E5E5E5] bg-white px-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                autoFocus
              />
              {authError && (
                <p className="text-xs text-red-600 px-2">{authError}</p>
              )}
              <button
                type="submit"
                disabled={!secret}
                className="w-full h-11 rounded-full bg-[#111] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#222] transition-colors"
              >
                Access Admin Panel
              </button>
            </form>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans">
      <nav className="w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-[#E5E5E5]/60 sticky top-0 bg-[#FAFAFA]/95 backdrop-blur z-20">
        <Link href="/">
          <span className="font-semibold text-sm tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            yousaidthat.org
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#999] uppercase tracking-wider">Admin Panel</span>
          <button
            onClick={() => fetchData(secret)}
            disabled={loading}
            className="h-8 px-3 rounded-full border border-[#E5E5E5] text-xs flex items-center gap-1.5 hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-1">
            Dashboard
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-[#666] mt-1">Auto-refreshes every 30 seconds.</p>
        </motion.div>

        {error && (
          <div className="flex items-start gap-2 p-4 rounded-2xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* ── Arweave Balance ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Arweave Wallet Balance</h2>
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 flex items-center justify-between">
            {stats ? (
              <>
                <div>
                  <p className="text-[10px] font-mono text-[#BBB] uppercase mb-1">AR Balance</p>
                  <p className="text-2xl font-bold font-mono">
                    {stats.arweaveBalance.ar} AR
                  </p>
                  <p className="text-[10px] font-mono text-[#999] mt-0.5">
                    {stats.arweaveBalance.winston} winston
                  </p>
                  {stats.arweaveAddress && (
                    <p className="text-[10px] font-mono text-[#BBB] mt-2 break-all">
                      {stats.arweaveAddress}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={`https://viewblock.io/arweave/address/${stats.arweaveAddress ?? ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#111] text-white text-xs font-medium hover:bg-[#222] transition-colors"
                  >
                    View on Explorer
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[#999]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            )}
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────────────── */}
        {stats && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#BBB] uppercase mb-2">Total Predictions</p>
                <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#BBB] uppercase mb-2">OTS Status</p>
                <div className="space-y-1.5">
                  {Object.entries(stats.otsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-[#666] capitalize">{status}</span>
                      <span className="text-xs font-mono font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#BBB] uppercase mb-2">Arweave Status</p>
                <div className="space-y-1.5">
                  {Object.entries(stats.arweaveByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-[#666] capitalize">{status}</span>
                      <span className="text-xs font-mono font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Arweave Issues ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Arweave Issues
            {pendingArweave && pendingArweave.total > 0 && (
              <span className="ml-2 text-sm font-mono text-amber-600">
                ({pendingArweave.total} pending/failed)
              </span>
            )}
          </h2>

          {!pendingArweave ? (
            <div className="flex items-center gap-2 text-[#999] p-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : pendingArweave.total === 0 ? (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-[#666]">No pending Arweave uploads.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                    <th className="text-left font-mono text-[#BBB] uppercase py-3 px-4">ID</th>
                    <th className="text-left font-mono text-[#BBB] uppercase py-3 px-4">Mode</th>
                    <th className="text-left font-mono text-[#BBB] uppercase py-3 px-4">Year</th>
                    <th className="text-left font-mono text-[#BBB] uppercase py-3 px-4">Status</th>
                    <th className="text-left font-mono text-[#BBB] uppercase py-3 px-4">Created</th>
                    <th className="text-right font-mono text-[#BBB] uppercase py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingArweave.predictions.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-[#F5F5F5] ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]/50"}`}
                    >
                      <td className="py-3 px-4 font-mono text-[#666]">{p.hash}</td>
                      <td className="py-3 px-4 capitalize text-[#444]">{p.mode.replace(/_/g, " ")}</td>
                      <td className="py-3 px-4 font-mono text-[#444]">{p.target_year}</td>
                      <td className="py-3 px-4">
                        {p.arweave_status === "pending" ? (
                          <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full w-fit">
                            <Clock className="w-2.5 h-2.5" />
                            pending
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full w-fit">
                            <XCircle className="w-2.5 h-2.5" />
                            failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#999]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRetry(p.id)}
                          disabled={retryingId === p.id}
                          className="h-7 px-3 rounded-full bg-[#111] text-white text-[10px] font-mono hover:bg-[#333] disabled:opacity-50 transition-colors flex items-center gap-1 ml-auto"
                        >
                          {retryingId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Quick Links ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Home", href: "/" },
              { label: "Community", href: "/community" },
              { label: "Verify", href: "/verify" },
              { label: "Create", href: "/create" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 text-center text-sm font-medium hover:border-[#6366F1]/30 hover:bg-[#6366F1]/5 transition-all cursor-pointer">
                  {link.label}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
