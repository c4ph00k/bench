import { useState } from "react";
import { CalendarDays, Phone } from "lucide-react";
import type { InteractionType, PersonComputed } from "../types";
import { INTERACTION_TYPES } from "../types";
import { api } from "../api";
import { Modal } from "./Modal";
import { Field, FieldGroup } from "./Field";
import InteractionIcon from "./InteractionIcon";
import { todayISO, INTERACTION_META } from "../format";
import { useToast } from "../store";

export function LogInteractionModal({
  person,
  onClose,
  onSaved,
}: {
  person: PersonComputed;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [type, setType] = useState<InteractionType>("call");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const firstName = person.name.split(" ")[0];

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.addInteraction(person.id, type, date, notes.trim());
      toast(
        `Logged a ${INTERACTION_META[type].label.toLowerCase()} with ${firstName} — the clock is reset`,
      );
      onSaved?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Log an interaction with ${firstName}`}
      icon={<Phone size={17} className="modal-icon blue" />}
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
            disabled={saving || !date}
          >
            {saving ? "Saving…" : "Save interaction"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FieldGroup label="Type">
          <div className="row wrap" style={{ gap: 6 }}>
            {INTERACTION_TYPES.map((t) => (
              <button
                key={t}
                className={`btn btn-sm${type === t ? " btn-blue" : ""}`}
                aria-pressed={type === t}
                onClick={() => setType(t)}
                type="button"
              >
                <InteractionIcon type={t} />
                {INTERACTION_META[t].label}
              </button>
            ))}
          </div>
        </FieldGroup>
        <Field label="Date">
          <div className="row">
            <CalendarDays size={15} className="muted-icon" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </Field>
        <Field label="What did you talk about?" wide>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes on the conversation — the little things worth remembering"
          />
        </Field>
      </div>
    </Modal>
  );
}
