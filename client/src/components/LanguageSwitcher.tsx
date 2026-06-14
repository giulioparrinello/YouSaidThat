import { Fragment } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

// Minimal EN / IT language switch. Switching navigates the URL rather than
// just toggling client state: English lives on the bare path, Italian under a
// "/it" prefix. `location` here is already base-stripped by the parent Router,
// so we navigate with an absolute ("~") path to cross the language boundary.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const [location, navigate] = useLocation();
  const current = i18n.language?.startsWith("it") ? "it" : "en";

  const switchTo = (lng: "en" | "it") => {
    if (lng === current) return;
    const path = location === "/" ? "" : location;
    navigate(lng === "it" ? `~/it${path}` : `~${path || "/"}`);
  };

  return (
    <div
      className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ${className}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "it"] as const).map((lng, i) => (
        <Fragment key={lng}>
          {i > 0 && <span className="opacity-30">/</span>}
          <button
            onClick={() => switchTo(lng)}
            aria-pressed={current === lng}
            className={`transition-opacity ${
              current === lng
                ? "text-[#111111] font-semibold opacity-100"
                : "opacity-50 hover:opacity-100"
            }`}
          >
            {lng}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
