import { Clock3, MapPin, Megaphone, Pencil, Phone } from "lucide-react";
import type { PersonComputed } from "../../types";
import { CIRCLE_META } from "../../types";
import { Avatar } from "../Avatar";
import { CircleChip, StatusBadge } from "../Chips";
import { fmtDate, localTimeIn, relativeDays } from "../../format";

/** How often you mean to be in touch with this person, and why. */
function cadenceText(person: PersonComputed): string {
  if (person.checkins_off) return "Check-ins are off for this person";
  const { label, cadenceDescription } = CIRCLE_META[person.circle];
  const base = `${label} circle · check in ${cadenceDescription.toLowerCase()}`;
  return person.cadence_override_days
    ? `${base} (overridden: every ${person.cadence_override_days} days)`
    : base;
}

/** The one line under the chips that says where the check-in clock stands. */
function dueText(person: PersonComputed): string {
  if (person.status === "overdue" && person.next_due)
    return ` · was due ${fmtDate(person.next_due)} (${relativeDays(person.next_due)})`;
  if (person.status === "due_soon" && person.next_due)
    return ` · due ${fmtDate(person.next_due)}`;
  if (person.status === "snoozed" && person.snoozed_until)
    return ` · snoozed until ${fmtDate(person.snoozed_until)}`;
  return "";
}

export default function PersonHeader({
  person,
  onLog,
  onEdit,
}: {
  person: PersonComputed;
  onLog: () => void;
  onEdit: () => void;
}) {
  const localTime = localTimeIn(person.timezone);
  const cadence = cadenceText(person);
  return (
    <>
      <div className="person-head">
        <Avatar name={person.name} photo={person.photo} size="xl" />
        <div className="person-head-main">
          <h1 className="person-name">{person.name}</h1>
          <div className="person-sub">
            {person.job_title && <span>{person.job_title}</span>}
            {person.company && (
              <span>
                {person.job_title ? " at " : ""}
                <strong>{person.company}</strong>
              </span>
            )}
            {(person.job_title || person.company) &&
              (person.city || localTime) && <span>·</span>}
            {person.city && (
              <span className="row" style={{ gap: 4 }}>
                <MapPin size={13} /> {person.city}
              </span>
            )}
            {localTime && (
              <span
                className="row"
                style={{ gap: 4 }}
                title={`Their time zone: ${person.timezone}`}
              >
                <Clock3 size={13} /> {localTime} their time
              </span>
            )}
          </div>
          <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
            <StatusBadge status={person.status} title={cadence} />
            <CircleChip circle={person.circle} />
            {person.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {cadence}
            {dueText(person)}
          </div>
        </div>
        <div className="person-actions">
          <button className="btn btn-blue" onClick={onLog}>
            <Phone size={15} /> Log interaction
          </button>
          <button className="btn" onClick={onEdit}>
            <Pencil size={15} /> Edit
          </button>
        </div>
      </div>

      {person.status === "snoozed" && person.snoozed_until && (
        <div className="snooze-banner">
          <Clock3 size={15} />
          Snoozed until {fmtDate(person.snoozed_until)} — they won’t nudge you
          on Today until then.
        </div>
      )}

      {person.latest_news && (
        <div className="news-banner">
          <Megaphone size={17} />
          <div>
            <div className="text">{person.latest_news.text}</div>
            <div className="when">
              Latest news · {fmtDate(person.latest_news.date)} ·{" "}
              {relativeDays(person.latest_news.date)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
