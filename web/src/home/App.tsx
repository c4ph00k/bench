/** Launcher: one card per app. Plain anchors - each app is its own document. */

interface AppCard {
  href: string;
  name: string;
  tagline: string;
  detail: string;
  color: string;
}

const APPS: AppCard[] = [
  {
    href: "/crm/",
    name: "CRM",
    tagline: "Personal sales CRM",
    detail:
      "Organizations, contacts, deals, a drag-and-drop pipeline and a dashboard.",
    color: "var(--blue)",
  },
  {
    href: "/space/",
    name: "Space",
    tagline: "Personal knowledge manager",
    detail:
      "Pages and blocks, databases with table, board and list views, quick search.",
    color: "var(--amber)",
  },
  {
    href: "/groove/",
    name: "Groove",
    tagline: "Browser groovebox",
    detail:
      "Four synth units, one transport, a master DJ filter. All Web Audio, no samples.",
    color: "var(--purple)",
  },
];

export default function App() {
  return (
    <div className="home">
      <header className="home-header">
        <h1>Bench</h1>
        <p>
          Three local-first apps, one server. Everything runs on this machine.
        </p>
      </header>
      <div className="home-grid">
        {APPS.map((app) => (
          <a
            className="home-card"
            href={app.href}
            key={app.href}
            style={{ borderTopColor: app.color }}
          >
            <h2 style={{ color: app.color }}>{app.name}</h2>
            <p className="home-tagline">{app.tagline}</p>
            <p className="home-detail">{app.detail}</p>
            <span className="home-open">Open</span>
          </a>
        ))}
      </div>
    </div>
  );
}
