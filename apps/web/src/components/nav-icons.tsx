import type { ReactNode } from 'react';

type NavIconProps = { className?: string; active?: boolean };

// Drawn on one 24px grid: rounded field markings, generous gaps and
// currentColor so both themes and navigation states share the same artwork.
function IconFrame({
  className,
  active = false,
  children,
}: NavIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {active && <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" stroke="none" />}
      {children}
    </svg>
  );
}

export function FindGameIcon(props: NavIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.2 15.2 5 5M5 10.5h11M10.5 4v13" />
      <circle cx="10.5" cy="10.5" r="2.3" />
    </IconFrame>
  );
}

export function MyGamesIcon(props: NavIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M7.5 3v4M16.5 3v4M3.5 10h17" />
      <circle cx="12" cy="15.5" r="3.3" />
      <path d="m12 13.8 1.6 1.2-.6 1.9h-2l-.6-1.9Z" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function CreateGameIcon(props: NavIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h3v6H3M21 9h-3v6h3M12 4v3M12 17v3" />
      <path d="M9 12h6M12 9v6" strokeWidth="2.2" />
    </IconFrame>
  );
}

export function NotificationsIcon(props: NavIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M9.5 20a2.8 2.8 0 0 0 5 0M12 3V2M5 17h14c-1.5-1.8-2-3.7-2-7a5 5 0 0 0-10 0c0 3.3-.5 5.2-2 7Z" />
      <path d="M9.5 13.5a6 6 0 0 1 5 0" />
    </IconFrame>
  );
}

export function PlayerProfileIcon(props: NavIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="6" r="3" />
      <path d="m8 12-4 2 2 4 2-1v4h8v-4l2 1 2-4-4-2M9 12l3 3 3-3" />
    </IconFrame>
  );
}
