/** Inline stroke icons. One consistent 24-grid, sized by font-size so they sit with their labels. */

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 18,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" />
  </Svg>
);

export const IconOrganizations = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" />
    <path d="M13 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10" />
    <path d="M8 9h2M8 13h2M8 17h2M16 14h1M16 17h1" />
  </Svg>
);

export const IconContacts = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5" />
    <path d="M17.5 14.5a5 5 0 0 1 3 4.5" />
  </Svg>
);

export const IconDeals = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="7" width="19" height="13" rx="2" />
    <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
    <path d="M2.5 12h19" />
    <path d="M11 12h2" />
  </Svg>
);

export const IconPipeline = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="4.5" height="16" rx="1.5" />
    <rect x="9.75" y="4" width="4.5" height="11" rx="1.5" />
    <rect x="16.5" y="4" width="4.5" height="7" rx="1.5" />
  </Svg>
);

export const IconForecast = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17.5 9 11l4 4 8-8" />
    <path d="M15 7h6v6" />
  </Svg>
);

export const IconWon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5.5H4.5V7a3.5 3.5 0 0 0 3 3.4" />
    <path d="M17 5.5h2.5V7a3.5 3.5 0 0 1-3 3.4" />
    <path d="M12 14v3.5M8.5 20.5h7" />
  </Svg>
);

export const IconRevenue = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v10" />
    <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5" />
  </Svg>
);

export const IconNote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.5h8L19 8v12.5H6Z" />
    <path d="M13.5 3.5V8H19" />
    <path d="M9 12h6M9 16h4" />
  </Svg>
);

export const IconCall = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 3.5 10 8l-2 2a11 11 0 0 0 6 6l2-2 4.5 2.5-1 3a2 2 0 0 1-2 1.2C10.5 20.2 3.8 13.5 3.3 6.5a2 2 0 0 1 1.2-2Z" />
  </Svg>
);

export const IconEmail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
    <path d="M13.5 6.5 17 10" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5" />
    <path d="M10.5 10.5v7M13.5 10.5v7" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4 4" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
