import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ConfirmEmail() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    fetch(`/api/email-confirm/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-[#6366F1] mx-auto mb-4" />
            <p className="text-sm text-[#666]">Confirming your reminder…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle className="w-10 h-10 text-[#22C55E] mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Reminder confirmed</h1>
            <p className="text-sm text-[#666] mb-6">
              You're all set. We'll send you a delivery notification on your chosen date.
            </p>
            <Link href="/">
              <span className="text-sm text-[#6366F1] hover:underline cursor-pointer">
                ← Back to YouSaidThat
              </span>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-10 h-10 text-[#EF4444] mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Link not valid</h1>
            <p className="text-sm text-[#666] mb-6">
              This confirmation link is invalid, already used, or has expired.
            </p>
            <Link href="/">
              <span className="text-sm text-[#6366F1] hover:underline cursor-pointer">
                ← Back to YouSaidThat
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
