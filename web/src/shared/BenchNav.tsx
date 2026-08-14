/**
 * The primary navigation, identical in all four documents. Each app is its own page, so these
 * are plain anchors rather than router links.
 */
import {
  BenchMark,
  IconCrm,
  IconGroove,
  IconHome,
  IconSpace,
} from "./AppIcons";
import "./nav.css";

type AppKey = "home" | "crm" | "space" | "groove";

/** The colour marks the active tab. White for the launcher keeps the three brand colours meaning
    "an app", which is also how the launcher cards read. Groove takes the lighter purple its own
    stylesheet already uses on dark; #753991 is a light-background colour and sinks into the strip. */
const APPS: {
  key: AppKey;
  href: string;
  label: string;
  color: string;
  Icon: (p: { size?: number }) => React.ReactElement;
}[] = [
  { key: "home", href: "/", label: "Home", color: "#ffffff", Icon: IconHome },
  { key: "crm", href: "/crm/", label: "CRM", color: "#209dd7", Icon: IconCrm },
  {
    key: "space",
    href: "/space/",
    label: "Space",
    color: "#ecad0a",
    Icon: IconSpace,
  },
  {
    key: "groove",
    href: "/groove/",
    label: "Groove",
    color: "#a066d8",
    Icon: IconGroove,
  },
];

export default function BenchNav({ active }: { active: AppKey }) {
  return (
    <header className="bench-nav">
      <span className="bench-nav-brand">
        <BenchMark size={21} />
        Bench
      </span>
      <nav className="bench-nav-links" aria-label="Primary">
        {APPS.map(({ key, href, label, color, Icon }) => (
          <a
            key={key}
            className="bench-nav-link"
            href={href}
            aria-current={key === active ? "page" : undefined}
            style={key === active ? { borderBottomColor: color } : undefined}
          >
            <Icon size={16} />
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
