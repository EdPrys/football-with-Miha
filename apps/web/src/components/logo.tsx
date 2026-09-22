// Ball-on-arc mark. Uses currentColor + the theme's --primary so it
// follows light/dark automatically instead of needing separate assets.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M10 66 Q50 34 90 66"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="50" cy="38" r="17" fill="var(--primary)" />
      <path d="M50 26 L60 33 L56 45 L44 45 L40 33 Z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
