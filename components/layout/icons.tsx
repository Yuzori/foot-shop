/** Lightweight inline icon set (no external icon dependency). */

type IconProps = { className?: string };

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" className={className} {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" className={className} {...common}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function BagIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" className={className} {...common}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" className={className} {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg width="22" height="22" className={className} {...common}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg width="22" height="22" className={className} {...common}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" className={className} {...common}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" className={className} {...common}>
      <path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <path d="M7 4H5a2 2 0 0 0 0 4h2M17 4h2a2 2 0 0 1 0 4h-2" />
      <path d="M12 7v3" />
    </svg>
  );
}
