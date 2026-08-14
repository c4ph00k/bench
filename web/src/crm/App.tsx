import { NavLink, Route, Routes } from "react-router";
import {
  IconContacts,
  IconDashboard,
  IconDeals,
  IconHome,
  IconOrganizations,
  IconPipeline,
} from "./components/Icons";
import Dashboard from "./pages/Dashboard";
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Deals from "./pages/Deals";
import DealDetail from "./pages/DealDetail";
import Pipeline from "./pages/Pipeline";

const NAV = [
  { to: "/", label: "Dashboard", end: true, Icon: IconDashboard },
  { to: "/organizations", label: "Organizations", Icon: IconOrganizations },
  { to: "/contacts", label: "Contacts", Icon: IconContacts },
  { to: "/deals", label: "Deals", Icon: IconDeals },
  { to: "/pipeline", label: "Pipeline", Icon: IconPipeline },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="home-link" href="/" aria-label="Home">
          <IconHome size={14} />
          Home
        </a>
        <div className="brand">
          <span className="brand-mark" />
          Personal CRM
        </div>
        <nav>
          {NAV.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/deals/:id" element={<DealDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
        </Routes>
      </main>
    </div>
  );
}
