import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center font-sans">
      <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#6366F1] mb-4">
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-[#111] mb-2">
        {t("notFound.title")}
      </h1>
      <p className="text-sm text-[#666] mb-8 max-w-sm">
        {t("notFound.desc")}
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <span className="h-10 px-6 rounded-full bg-[#111] text-white text-sm font-medium flex items-center gap-1.5 hover:bg-[#222] transition-colors cursor-pointer">
            {t("notFound.goHome")}
          </span>
        </Link>
        <Link href="/create">
          <span className="h-10 px-6 rounded-full border border-[#E5E5E5] text-sm font-medium flex items-center gap-1.5 hover:bg-[#F5F5F5] transition-colors cursor-pointer">
            {t("notFound.create")} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
