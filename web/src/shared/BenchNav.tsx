/**
 * The primary navigation, identical in every document. Each app is its own page, so these are
 * plain anchors rather than router links.
 */
import { useState } from "react";
import {
  IconAdmin,
  IconCrm,
  IconHome,
  IconLogout,
  IconMoon,
  IconRolodex,
  IconSpace,
  IconSun,
} from "./AppIcons";
import { currentTheme, toggleTheme, type Theme } from "./theme";
import { signOut, useSession } from "./auth";
import { BRAND } from "./brand";
import "./nav.css";

type AppKey = "home" | "crm" | "space" | "rolodex" | "admin";

/** Colour marks the active app and nothing else: one amber chip, wherever you are. An app is
    told apart by its glyph, which is what still works once there are more of them than there
    are brand colours. The admin panel is chrome, not an app, so it appears only to admins. */
const APPS: {
  key: AppKey;
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
}[] = [
  { key: "home", href: "/", label: "Home", Icon: IconHome },
  { key: "crm", href: "/crm/", label: "CRM", Icon: IconCrm },
  { key: "space", href: "/space/", label: "Space", Icon: IconSpace },
  { key: "rolodex", href: "/rolodex/", label: "Rolodex", Icon: IconRolodex },
];

export default function BenchNav({ active }: { active: AppKey }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const session = useSession();
  const links =
    session?.role === "admin"
      ? [
          ...APPS,
          { key: "admin", href: "/admin/", label: "Admin", Icon: IconAdmin },
        ]
      : APPS;
  return (
    <header className="bench-nav">
      <span className="bench-nav-brand">
        <BRAND.Mark size={21} />
        {BRAND.name}
      </span>
      <nav className="bench-nav-links" aria-label="Primary">
        {links.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            className="bench-nav-link"
            href={href}
            aria-current={key === active ? "page" : undefined}
          >
            <Icon size={16} />
            {label}
          </a>
        ))}
      </nav>
      <button
        type="button"
        className="bench-nav-theme"
        onClick={() => setTheme(toggleTheme())}
        aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      >
        {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>
      <button
        type="button"
        className="bench-nav-theme"
        onClick={() => void signOut()}
        aria-label="Sign out"
        title="Sign out"
      >
        <IconLogout size={16} />
      </button>
    </header>
  );
}
