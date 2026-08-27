/**
 * One icon per app, shared by the navigation strip and by each app's own brand block so the same
 * glyph identifies an app wherever you are.
 *
 * Stroke icons sit on the same 24 grid as CRM's Icons.tsx and take their colour from the text
 * around them. The Novhora mark is the company logo reduced to strokes: two pillars with two
 * diagonals crossing between them, one woven over the other.
 */

interface IconProps {
  size?: number;
}

function Stroke({
  size = 18,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
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

/** The Novhora mark: two pillars with two diagonals crossing between them, one woven over the
    other - the company logo (logo/Novhora_logo_*.jpg) reduced to strokes. */
export const NovhoraMark = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M18.8 5.2 14 10M10 14 5.2 18.8" />
    <path d="M5.2 5.2v13.6M18.8 5.2v13.6" />
    <path d="M5.2 5.2l13.6 13.6" />
  </Stroke>
);

export const IconHome = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </Stroke>
);

/** A contact card, not the briefcase or the pair of people - those name pages inside the CRM. */
export const IconCrm = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <circle cx="8.5" cy="10.5" r="2.25" />
    <path d="M5.5 16.25a3 3 0 0 1 6 0" />
    <path d="M14.5 10h4M14.5 14h4" />
  </Stroke>
);

export const IconSpace = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
    <path d="m3 12.5 9 4.5 9-4.5" />
    <path d="m3 17 9 4.5 9-4.5" />
  </Stroke>
);

/** A rolodex card, notched where the spindle passes through it - the thing itself, rather
    than another address book that would look like the CRM's contact card. */
export const IconRolodex = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4.5 19.5V8.5h4.6q2.9 3.7 5.8 0h4.6v11" />
    <path d="M2.5 19.5h19" />
    <path d="M8.5 13h7M8.5 16.2h4.5" />
  </Stroke>
);

export const IconSun = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Stroke>
);

export const IconMoon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
  </Stroke>
);

/** A door with an arrow out of it - leaving, not arriving. */
export const IconLogout = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h8" />
    <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
  </Stroke>
);

/** Two people under one roof, the panel that manages users, not the contact cards elsewhere. */
export const IconAdmin = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.4a3.25 3.25 0 0 1 0 5.2" />
    <path d="M15.8 14.7a5.5 5.5 0 0 1 4.7 5.3" />
  </Stroke>
);
