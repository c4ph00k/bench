/**
 * The primary navigation, identical in all four documents. Each app is its own page, so these
 * are plain anchors rather than router links.
 */
import { useState } from "react";
import {
  BenchMark,
  IconCrm,
  IconGroove,
  IconHome,
  IconLogout,
  IconMoon,
  IconRolodex,
  IconSpace,
  IconSun,
} from "./AppIcons";
import { currentTheme, toggleTheme, type Theme } from "./theme";
import { signOut } from "./auth";
import "./nav.css";

type AppKey = "home" | "crm" | "space" | "rolodex" | "groove";

/** Colour marks the active app and nothing else: one amber chip, wherever you are. An app is
    told apart by its glyph, which is what still works once there are more of them than there
    are brand colours. */
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
  { key: "groove", href: "/groove/", label: "Groove", Icon: IconGroove },
];

export default function BenchNav({ active }: { active: AppKey }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  return (
    <header className="bench-nav">
      <span className="bench-nav-brand">
        <BenchMark size={21} />
        Bench
      </span>
      <nav className="bench-nav-links" aria-label="Primary">
        {APPS.map(({ key, href, label, Icon }) => (
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
