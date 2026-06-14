import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ConfirmEmail() {
  const { t } = useTranslation();
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
            <p className="text-sm text-[#666]">{t("confirmEmail.confirming")}</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle className="w-10 h-10 text-[#22C55E] mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">{t("confirmEmail.okTitle")}</h1>
            <p className="text-sm text-[#666] mb-6">
              {t("confirmEmail.okDesc")}
            </p>
            <Link href="/">
              <span className="text-sm text-[#6366F1] hover:underline cursor-pointer">
                {t("confirmEmail.backLink")}
              </span>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-10 h-10 text-[#EF4444] mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">{t("confirmEmail.errorTitle")}</h1>
            <p className="text-sm text-[#666] mb-6">
              {t("confirmEmail.errorDesc")}
            </p>
            <Link href="/">
              <span className="text-sm text-[#6366F1] hover:underline cursor-pointer">
                {t("confirmEmail.backLink")}
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
