import { BadgeCheck } from "lucide-react";

const PROFILE_URL = "https://giulioparrinello.it";

function openProfile() {
  window.open(PROFILE_URL, "_blank", "noopener,noreferrer");
}

// Cards are already wrapped in a wouter <Link> (an anchor), and nesting <a> in
// <a> is invalid HTML — so these are clickable <span role="link"> elements that
// open the profile manually and stop propagation so the card's own link doesn't
// also fire. Keyboard-accessible via Enter/Space.
function linkProps(label: string) {
  return {
    role: "link" as const,
    tabIndex: 0,
    "aria-label": label,
    title: "Verified · Giulio Parrinello",
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openProfile();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openProfile();
      }
    },
  };
}

// Standalone blue verified checkmark linking to giulioparrinello.it.
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      {...linkProps("Verified · Giulio Parrinello")}
      className={`inline-flex shrink-0 cursor-pointer text-[#1D9BF0] hover:opacity-80 transition-opacity ${className}`}
    >
      <BadgeCheck className="w-3.5 h-3.5" />
    </span>
  );
}

// Verified author = clickable name + badge, the whole thing linking to the
// profile. Used wherever a verified post's author is shown.
export function VerifiedAuthor({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      {...linkProps(`${name} — verified · giulioparrinello.it`)}
      className={`inline-flex items-center gap-1 cursor-pointer hover:underline ${className}`}
    >
      <span className="truncate">{name}</span>
      <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[#1D9BF0]" />
    </span>
  );
}
