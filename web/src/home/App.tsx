/** Launcher: one card per app. Plain anchors - each app is its own document. */
import { useEffect } from "react";
import BenchNav from "../shared/BenchNav";
import { redirectTo, useSession } from "../shared/auth";
import { BRAND } from "../shared/brand";
import { IconAdmin, IconCrm, IconRolodex, IconSpace } from "../shared/AppIcons";

interface AppCard {
  href: string;
  name: string;
  tagline: string;
  detail: string;
  facts: string[];
  Icon: (p: { size?: number }) => React.ReactElement;
}

const APPS: AppCard[] = [
  {
    href: "/crm/",
    name: "CRM",
    tagline: "Deals, and the people behind them",
    detail:
      "Organizations, contacts and a drag-and-drop pipeline, with a dashboard that adds up what is actually in play.",
    facts: ["Pipeline", "Dashboard", "Activities"],
    Icon: IconCrm,
  },
  {
    href: "/space/",
    name: "Space",
    tagline: "Everything you know, in one place",
    detail:
      "Pages and blocks that nest as deep as you like, databases with table, board and list views, and search across the lot.",
    facts: ["Pages", "Databases", "Search"],
    Icon: IconSpace,
  },
  {
    href: "/rolodex/",
    name: "Rolodex",
    tagline: "The people in your life, kept close",
    detail:
      "Who you are due to contact, what is going on with them, birthdays coming up, and a timeline of every conversation.",
    facts: ["Check-ins", "Circles", "Calendar"],
    Icon: IconRolodex,
  },
];

export default function App() {
  const session = useSession();
  // In production the server redirects before this document is served at all; under `npm run dev`
  // the page comes from Vite, so the launcher checks the session itself - and sends a user holding
  // a temporary password to the page that replaces it before the apps open.
  useEffect(() => {
    if (session === null) redirectTo("/login");
    else if (session?.mustChangePassword) redirectTo("/change-password");
  }, [session]);

  const adminCard: AppCard = {
    href: "/admin/",
    name: "Admin",
    tagline: "The people who can sign in",
    detail:
      "Add, edit and remove users, give admin or user roles, and reset a password for the next sign-in.",
    facts: ["Users", "Roles", "Reset password"],
    Icon: IconAdmin,
  };
  const cards = session?.role === "admin" ? [...APPS, adminCard] : APPS;

  return (
    <>
      <BenchNav active="home" />
      <div className="home">
        <header className="home-header">
          <p className="home-eyebrow">Local-first · one login · no cloud</p>
          <h1>{BRAND.name}</h1>
          <p className="home-lede">
            Three apps, one server, one machine. Your data lives in SQLite files
            on this disk and goes nowhere else.
          </p>
        </header>

        <div className="home-grid">
          {cards.map((app) => (
            <a className="home-card" href={app.href} key={app.href}>
              <app.Icon size={104} />
              <div className="home-card-body">
                <h2>{app.name}</h2>
                <p className="home-tagline">{app.tagline}</p>
                <p className="home-detail">{app.detail}</p>
                <ul className="home-facts">
                  {app.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <span className="home-open">
                Open
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h13M12 5.5 18.5 12 12 18.5" />
                </svg>
              </span>
            </a>
          ))}
        </div>

        <footer className="home-footer">
          <span>
            <strong>npm run dev</strong> · API on 8100, Vite on 8101
          </span>
          <span>SQLite in ./data</span>
        </footer>
      </div>
    </>
  );
}
