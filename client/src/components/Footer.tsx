import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
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
  );
}
