import { Link } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Cake,
  Clock3,
  Gift,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users2,
} from "lucide-react";
import { api, type PersonDetail } from "../../api";
import { CIRCLE_META } from "../../types";
import {
  currentAge,
  dateTypeLabel,
  daysUntil,
  nextOccurrence,
} from "../../dates";
import { Avatar } from "../Avatar";
import { EmptyState } from "../Modal";
import { fmtDate, monthShort, relativeDays, todayISO } from "../../format";

type AddWhat = "date" | "reminder" | "gift" | "connection";

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="detail-row">
      <span className="k row">
        <span className="detail-icon">{icon}</span>
        {label}
      </span>
      <span className="v">{value || "—"}</span>
    </div>
  );
}

/** Where the person's page keeps the durable things: who they are, dates, reminders, gifts, links. */
export default function PersonSide({
  detail,
  after,
  onAdd,
}: {
  detail: PersonDetail;
  after: () => Promise<void>;
  onAdd: (what: AddWhat) => void;
}) {
  const { person } = detail;
  const today = todayISO();
  const openReminders = detail.reminders.filter((r) => !r.done);
  const doneReminders = detail.reminders.filter((r) => r.done);
  const giftIdeas = detail.gifts.filter((g) => g.kind === "idea");

  // Gift ideas are worth surfacing only when an occasion for them is actually coming up.
  const soonest = detail.dates
    .map((d) => ({ date: d, occurrence: nextOccurrence(d, today) }))
    .sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date))
    .find(({ occurrence }) => daysUntil(occurrence.date, today) <= 30);

  return (
    <div className="person-col">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Details</h2>
        </div>
        <div className="card-body">
          <DetailRow
            icon={<Mail size={14} />}
            label="Email"
            value={person.email}
          />
          <DetailRow
            icon={<Phone size={14} />}
            label="Phone"
            value={person.phone}
          />
          <DetailRow
            icon={<MapPin size={14} />}
            label="City"
            value={person.city}
          />
          <DetailRow
            icon={<Clock3 size={14} />}
            label="Time zone"
            value={person.timezone}
          />
          <DetailRow
            icon={<Users2 size={14} />}
            label="Circle"
            value={CIRCLE_META[person.circle].label}
          />
          <DetailRow
            icon={<ArrowRight size={14} />}
            label="How we met"
            value={[
              person.how_met,
              person.met_where,
              person.met_on ? fmtDate(person.met_on) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Cake size={16} /> Important dates
          </h2>
          <button className="btn btn-sm" onClick={() => onAdd("date")}>
            <Plus size={13} /> Add date
          </button>
        </div>
        {detail.dates.length === 0 ? (
          <EmptyState icon={<Cake />}>
            No dates yet — birthdays, anniversaries, the works.
          </EmptyState>
        ) : (
          <div>
            {detail.dates.map((d) => {
              const occurrence = nextOccurrence(d, today);
              const age = currentAge(d, today);
              return (
                <div key={d.id} className="list-row">
                  <div className="date-pill">
                    <span className="mon">{monthShort(d.month)}</span>
                    <span className="day">{d.day}</span>
                  </div>
                  <div className="body">
                    <div className="strong">
                      {dateTypeLabel(d.type, d.label)}
                      {occurrence.milestone && (
                        <span className="badge status-due_soon milestone">
                          turns {occurrence.ageTurning} — milestone
                        </span>
                      )}
                    </div>
                    <div className="small muted">
                      {d.year ? `Born/started ${d.year} · ` : ""}
                      {age != null ? `${age} now, ` : ""}
                      next: {fmtDate(occurrence.date)} (
                      {relativeDays(occurrence.date)})
                    </div>
                  </div>
                  <button
                    className="icon-btn danger actions"
                    aria-label="Delete date"
                    onClick={() => {
                      void api.deleteDate(d.id).then(after);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Bell size={16} /> Reminders
          </h2>
          <button className="btn btn-sm" onClick={() => onAdd("reminder")}>
            <Plus size={13} /> Add reminder
          </button>
        </div>
        {openReminders.length === 0 ? (
          <EmptyState icon={<Bell />}>
            Nothing to do — set a reminder and it’ll appear on Today too.
          </EmptyState>
        ) : (
          <div>
            {openReminders.map((r) => (
              <div key={r.id} className="list-row">
                <button
                  className="reminder-check"
                  title="Mark done"
                  aria-label={`Mark done: ${r.text}`}
                  onClick={() => {
                    void api.setReminderDone(r.id, true).then(after);
                  }}
                />
                <div className="body">
                  <div className="strong">{r.text}</div>
                  <div
                    className={`small ${r.due_date < today ? "reminder-overdue" : "muted"}`}
                  >
                    due {fmtDate(r.due_date)} · {relativeDays(r.due_date)}
                  </div>
                </div>
                <button
                  className="icon-btn danger actions"
                  aria-label={`Delete reminder: ${r.text}`}
                  onClick={() => {
                    void api.deleteReminder(r.id).then(after);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {doneReminders.length > 0 && (
          <div className="card-body">
            <div className="small muted section-label">Done</div>
            {doneReminders.map((r) => (
              <div key={r.id} className="fact-row">
                <BadgeCheck size={13} className="done-tick" />
                <span className="reminder-done-text grow">{r.text}</span>
                <button
                  className="icon-btn danger"
                  aria-label={`Delete reminder: ${r.text}`}
                  onClick={() => {
                    void api.deleteReminder(r.id).then(after);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Gift size={16} /> Gifts
          </h2>
          <button className="btn btn-sm" onClick={() => onAdd("gift")}>
            <Plus size={13} /> Add gift
          </button>
        </div>
        {soonest && giftIdeas.length > 0 && (
          <div className="gift-surface">
            <div className="strong row">
              <Cake size={14} />{" "}
              {dateTypeLabel(soonest.date.type, soonest.date.label)}{" "}
              {relativeDays(soonest.occurrence.date)}
            </div>
            <div className="small gift-ideas">
              Gift ideas: {giftIdeas.map((g) => g.name).join(" · ")}
            </div>
          </div>
        )}
        {detail.gifts.length === 0 ? (
          <EmptyState icon={<Gift />}>
            No gifts recorded — ideas, things given, things received.
          </EmptyState>
        ) : (
          <div>
            {[...detail.gifts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((g) => (
                <div key={g.id} className="list-row">
                  <div className="body">
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`gift-kind gift-${g.kind}`}>
                        {g.kind}
                      </span>
                      <span className="strong">{g.name}</span>
                    </div>
                    <div className="small muted">
                      {g.occasion ? `${g.occasion} · ` : ""}
                      {fmtDate(g.date)}
                    </div>
                  </div>
                  {g.kind === "idea" && (
                    <button
                      className="btn btn-sm actions"
                      title="Mark as given"
                      onClick={() => {
                        void api
                          .updateGift(g.id, { kind: "given", date: todayISO() })
                          .then(after);
                      }}
                    >
                      Mark given
                    </button>
                  )}
                  <button
                    className="icon-btn danger actions"
                    aria-label={`Delete gift: ${g.name}`}
                    onClick={() => {
                      void api.deleteGift(g.id).then(after);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Link2 size={16} /> Connections
          </h2>
          <button className="btn btn-sm" onClick={() => onAdd("connection")}>
            <Plus size={13} /> Add connection
          </button>
        </div>
        {detail.connections.length === 0 ? (
          <EmptyState icon={<Link2 />}>
            No connections — link partners, family, colleagues.
          </EmptyState>
        ) : (
          <div>
            {detail.connections.map((c) => (
              <div key={c.id} className="list-row">
                <Avatar name={c.other_name} size="sm" />
                <div className="body">
                  <Link
                    to={`/people/${c.other_id}`}
                    className="connection-name"
                  >
                    {c.other_name}
                  </Link>
                  <div className="small muted">{c.description}</div>
                </div>
                <button
                  className="icon-btn danger actions"
                  aria-label={`Delete connection to ${c.other_name}`}
                  onClick={() => {
                    void api.deleteConnection(c.id).then(after);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {person.notes && (
        <div className="card card-pad">
          <h2 className="card-title notes-title">
            <StickyNote size={16} /> Notes
          </h2>
          <p className="muted person-notes">{person.notes}</p>
        </div>
      )}
    </div>
  );
}
