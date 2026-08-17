import { Link } from "react-router";
import { Phone } from "lucide-react";
import type { ToContactRow, TodayPayload } from "../../api";
import type { PersonComputed } from "../../types";
import { Avatar } from "../Avatar";
import { CIRCLE_LABEL, relativeDays } from "../../format";

/** The one line under the heading: who is worst, or that there is nobody to chase. */
function summary(payload: TodayPayload): string {
  if (payload.to_contact.length === 0)
    return "everyone is in touch — go enjoy your day";
  const top = payload.to_contact[0];
  if (top.status === "overdue")
    return top.overdue_days
      ? `most overdue: ${top.name} · ${top.overdue_days} days`
      : `most overdue: ${top.name} · never contacted`;
  const overdue = payload.to_contact.filter((p) => p.status === "overdue");
  return `${overdue.length} overdue · ${payload.to_contact.length - overdue.length} due soon`;
}

function urgency(row: ToContactRow, today: string): string {
  if (row.status !== "overdue")
    return `due ${relativeDays(row.next_due, today)}`;
  return row.overdue_days > 0
    ? `${row.overdue_days} days overdue`
    : "never contacted";
}

const SHOWN = 8;

/** The dark panel at the top of Today: who to contact, most overdue first. */
export default function ContactHero({
  payload,
  peopleById,
  onLog,
}: {
  payload: TodayPayload;
  peopleById: Map<number, PersonComputed>;
  onLog: (person: PersonComputed) => void;
}) {
  return (
    <div className="hero">
      <div className="hero-head">
        <h2 className="hero-title">
          <Phone size={18} />
          Who to contact
        </h2>
        <div className="hero-count">{summary(payload)}</div>
      </div>
      {payload.to_contact.length === 0 ? (
        <div className="hero-empty">
          Nobody needs your attention right now. Everyone’s inside their
          check-in window — have a look at the{" "}
          <Link to="/circles">Circles board</Link> if you fancy getting ahead.
        </div>
      ) : (
        <div className="hero-list">
          {payload.to_contact.slice(0, SHOWN).map((row) => {
            const person = peopleById.get(row.id);
            return (
              <div key={row.id} className="hero-row">
                <Link className="who" to={`/people/${row.id}`}>
                  <Avatar name={row.name} photo={row.photo} />
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="name">{row.name}</span>
                      <span className="chip hero-chip">
                        {CIRCLE_LABEL[row.circle]}
                      </span>
                    </div>
                    <div className="meta">
                      {row.last_contacted
                        ? `last contacted ${relativeDays(row.last_contacted, payload.today)}`
                        : "never contacted"}
                      {row.latest_news ? ` · ${row.latest_news.text}` : ""}
                    </div>
                  </div>
                </Link>
                <div
                  className={`hero-urgency ${row.status === "overdue" ? "overdue" : "due"}`}
                >
                  {urgency(row, payload.today)}
                </div>
                {person && (
                  <button
                    className="btn btn-sm btn-amber"
                    onClick={() => onLog(person)}
                  >
                    <Phone size={13} /> Log contact
                  </button>
                )}
              </div>
            );
          })}
          {payload.to_contact.length > SHOWN && (
            <div className="hero-more">
              <Link to="/people">
                and {payload.to_contact.length - SHOWN} more →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
