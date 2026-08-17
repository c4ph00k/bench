import { NavLink, Route, Routes } from "react-router";
import {
  CalendarDays,
  History,
  LayoutDashboard,
  Users,
  UsersRound,
} from "lucide-react";
import BenchNav from "../shared/BenchNav";
import { IconRolodex } from "../shared/AppIcons";
import StoreProvider from "./StoreProvider";
import Today from "./pages/Today";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import Circles from "./pages/Circles";
import CalendarPage from "./pages/CalendarPage";
import TimelinePage from "./pages/TimelinePage";

const NAV = [
  { to: "/", label: "Today", end: true, Icon: LayoutDashboard },
  { to: "/people", label: "People", Icon: Users },
  { to: "/circles", label: "Circles", Icon: UsersRound },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/timeline", label: "Timeline", Icon: History },
];

function Shell() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <IconRolodex size={19} />
          Rolodex
        </div>
        <nav>
          {NAV.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          Runs on your machine.
          <br />
          No accounts, no cloud.
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<PersonDetail />} />
          <Route path="/circles" element={<Circles />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <BenchNav active="rolodex" />
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </>
  );
}
