import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Cake,
  History,
  LayoutDashboard,
  Phone,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { api, type StatsPayload, type TodayPayload } from "../api";
import type { PersonComputed, TimelineEntry } from "../types";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/Modal";
import { LogInteractionModal } from "../components/LogInteractionModal";
import InteractionIcon from "../components/InteractionIcon";
import ContactHero from "../components/today/ContactHero";
import TodayCharts from "../components/today/TodayCharts";
import { dateTypeLabel } from "../dates";
import {
  errorMessage,
  fmtDate,
  monthShort,
  relativeDays,
  INTERACTION_META,
} from "../format";
import { useStore, useToast } from "../store";

/** What a timeline entry did, in words. */
function entryVerb(entry: TimelineEntry): string {
  if (entry.kind === "news") return "news recorded";
  if (entry.kind === "reminder_done") return "reminder completed";
  return entry.interaction_type
    ? INTERACTION_META[entry.interaction_type].verb
    : "contact logged";
}

export default function Today() {
  const { people, refresh } = useStore();
  const toast = useToast();
  const [payload, setPayload] = useState<TodayPayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [logging, setLogging] = useState<PersonComputed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api.today(), api.stats()])
        .then(([t, s]) => {
          setPayload(t);
          setStats(s);
        })
        .catch((e: unknown) => {
          setError(errorMessage(e));
        }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.today(), api.stats()])
      .then(([t, s]) => {
        if (cancelled) return;
        setPayload(t);
        setStats(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [people.length]);

  const after = async () => {
    await Promise.all([load(), refresh()]);
  };

  if (error) return <div className="page">Couldn’t load Today: {error}</div>;
  if (!payload) return <div className="page muted">Loading…</div>;

  const overdue = payload.to_contact.filter((p) => p.status === "overdue");
  const peopleById = new Map(people.map((p) => [p.id, p]));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="icon-sq amber">
              <LayoutDashboard size={19} />
            </span>
            Today
          </h1>
          <p className="page-desc">
            {format(new Date(), "EEEE d MMMM yyyy")} — what needs your
            attention.
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-num red">{overdue.length}</div>
          <div className="stat-label">
            <Phone size={13} /> overdue to contact
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-num amber">
            {payload.to_contact.length - overdue.length}
          </div>
          <div className="stat-label">
            <History size={13} /> due within a week
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-num purple">{payload.upcoming_dates.length}</div>
          <div className="stat-label">
            <Cake size={13} /> dates in 30 days
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-num blue">{payload.reminders.length}</div>
          <div className="stat-label">
            <Bell size={13} /> reminders due
          </div>
        </div>
      </div>

      <ContactHero
        payload={payload}
        peopleById={peopleById}
        onLog={setLogging}
      />

      <div className="today-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Cake size={16} /> Dates coming up
            </h2>
            <Link to="/calendar" className="small card-link">
              Calendar →
            </Link>
          </div>
          {payload.upcoming_dates.length === 0 ? (
            <EmptyState icon={<Cake />}>
              No birthdays or important dates in the next 30 days.
            </EmptyState>
          ) : (
            payload.upcoming_dates.slice(0, 7).map((e) => (
              <Link
                key={`${e.id}-${e.date}`}
                to={`/people/${e.person_id}`}
                className="upcoming-item"
              >
                <div className="date-pill">
                  <span className="mon">
                    {monthShort(Number(e.date.slice(5, 7)))}
                  </span>
                  <span className="day">{Number(e.date.slice(8, 10))}</span>
                </div>
                <Avatar
                  name={e.person_name}
                  photo={peopleById.get(e.person_id)?.photo}
                  size="sm"
                />
                <div className="grow">
                  <div className="strong">
                    {e.person_name}
                    {e.milestone && (
                      <span className="badge status-due_soon milestone">
                        turns {e.age_turning}
                      </span>
                    )}
                  </div>
                  <div className="small muted">
                    {dateTypeLabel(e.type, e.label)}
                    {e.age_turning != null && !e.milestone
                      ? ` · turns ${e.age_turning}`
                      : ""}
                  </div>
                </div>
                <span className="small muted">
                  {relativeDays(e.date, payload.today)}
                </span>
              </Link>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Bell size={16} /> Reminders
            </h2>
          </div>
          {payload.reminders.length === 0 ? (
            <EmptyState icon={<Bell />}>
              No reminders due — nothing on your list.
            </EmptyState>
          ) : (
            payload.reminders.slice(0, 7).map((r) => (
              <div key={r.id} className="list-row">
                <button
                  className="reminder-check"
                  title="Mark done"
                  aria-label={`Mark done: ${r.text}`}
                  onClick={() => {
                    void api
                      .setReminderDone(r.id, true)
                      .then(after)
                      .then(() => toast("Reminder done — nice"));
                  }}
                />
                <div className="body">
                  <div className="strong">{r.text}</div>
                  <div className="small muted">
                    <Link to={`/people/${r.person_id}`}>{r.person_name}</Link> ·
                    due {fmtDate(r.due_date)} ·{" "}
                    <span
                      className={r.overdue ? "reminder-overdue" : undefined}
                    >
                      {r.due_today
                        ? "today"
                        : relativeDays(r.due_date, payload.today)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <TodayCharts stats={stats} />

        <div className="card span2">
          <div className="card-header">
            <h2 className="card-title">
              <History size={16} /> Recent activity
            </h2>
            <Link to="/timeline" className="small card-link">
              Full timeline →
            </Link>
          </div>
          {payload.recent.length === 0 ? (
            <EmptyState icon={<Sparkles />}>
              Nothing logged yet — record an interaction and it’ll show up here.
            </EmptyState>
          ) : (
            <div className="feed">
              {payload.recent.slice(0, 8).map((e) => (
                <div key={e.id} className="feed-item">
                  <Avatar
                    name={e.person_name}
                    photo={peopleById.get(e.person_id)?.photo}
                  />
                  <div className="feed-body">
                    <div className="feed-top">
                      <Link
                        className="feed-person"
                        to={`/people/${e.person_id}`}
                      >
                        {e.person_name}
                      </Link>
                      <span className="feed-type">{entryVerb(e)}</span>
                      <span className="feed-date">
                        {fmtDate(e.date)} ·{" "}
                        {relativeDays(e.date, payload.today)}
                      </span>
                    </div>
                    {e.text && <div className="feed-text">{e.text}</div>}
                  </div>
                  <div className="feed-icon kind-interaction">
                    <InteractionIcon type={e.interaction_type} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {logging && (
        <LogInteractionModal
          person={logging}
          onClose={() => setLogging(null)}
          onSaved={() => void after()}
        />
      )}
    </div>
  );
}
