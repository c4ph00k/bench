import { useState } from "react";
import { Cake } from "lucide-react";
import { api } from "../../api";
import type { ImportantDateType } from "../../types";
import { DATE_TYPES } from "../../types";
import { Modal } from "../Modal";
import { Field } from "../Field";
import { DATE_TYPE_LABEL } from "../../format";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Why a year is optional: plenty of birthdays are known as a day and month and nothing more. */
export default function AddDateModal({
  personId,
  onClose,
  onSaved,
}: {
  personId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState<ImportantDateType>("birthday");
  const [label, setLabel] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const m = Number(month);
    const d = Number(day);
    if (!m || !d || d < 1 || d > 31) {
      setError("Please give a valid day and month");
      return;
    }
    const y = year ? Number(year) : null;
    if (y != null && (y < 1850 || y > 2100)) {
      setError("Year looks off — between 1850 and 2100 please");
      return;
    }
    setBusy(true);
    try {
      await api.addDate(personId, {
        type,
        label: label.trim() || null,
        month: m,
        day: d,
        year: y,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const labelHint =
    type === "child_birthday" || type === "other"
      ? "(e.g. child’s name)"
      : "(optional)";

  return (
    <Modal
      title="Add an important date"
      icon={<Cake size={17} className="modal-icon amber" />}
      onClose={onClose}
      footer={
        <>
          {error && <span className="form-error">{error}</span>}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={busy}
          >
            Save date
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ImportantDateType)}
          >
            {DATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DATE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Label ${labelHint}`}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={type === "child_birthday" ? "Louise" : ""}
          />
        </Field>
        <Field label="Day *">
          <input
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder="14"
          />
        </Field>
        <Field label="Month *">
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">—</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Year (optional)"
          hint="With a year we can show their age and flag milestone birthdays."
        >
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="1990"
          />
        </Field>
      </div>
    </Modal>
  );
}
