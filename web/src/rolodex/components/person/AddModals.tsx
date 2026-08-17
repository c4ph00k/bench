/** The quick-add modals on a person's page: news, a fact, a reminder, a gift. */
import { useState } from "react";
import { Bell, Gift, Megaphone, Sparkles } from "lucide-react";
import { api } from "../../api";
import type { GiftKind, PersonComputed } from "../../types";
import { Modal } from "../Modal";
import { Field } from "../Field";
import { todayISO } from "../../format";

interface AddProps {
  personId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Shared footer: cancel, then a save that is disabled until the form has something in it. */
function SaveFooter({
  label,
  disabled,
  onSave,
  onClose,
}: {
  label: string;
  disabled: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="btn" onClick={onClose}>
        Cancel
      </button>
      <button
        className="btn btn-primary"
        disabled={disabled || busy}
        onClick={() => {
          setBusy(true);
          void onSave().finally(() => {
            setBusy(false);
          });
        }}
      >
        {label}
      </button>
    </>
  );
}

export function AddNewsModal({
  person,
  onClose,
  onSaved,
}: Omit<AddProps, "personId"> & { person: PersonComputed }) {
  const [text, setText] = useState("");
  const save = async () => {
    await api.addNews(person.id, text.trim());
    await onSaved();
    onClose();
  };
  return (
    <Modal
      title={`Record news about ${person.name.split(" ")[0]}`}
      icon={<Megaphone size={17} className="modal-icon purple" />}
      onClose={onClose}
      footer={
        <SaveFooter
          label="Save news"
          disabled={!text.trim()}
          onSave={save}
          onClose={onClose}
        />
      }
    >
      <Field
        label="What’s new with them?"
        hint="The newest piece of news becomes their “latest news”, shown here and in the People table."
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Started at Figma. Moved to Berlin. Second baby due in March…"
        />
      </Field>
    </Modal>
  );
}

export function AddFactModal({ personId, onClose, onSaved }: AddProps) {
  const [text, setText] = useState("");
  const save = async () => {
    await api.addFact(personId, text.trim());
    await onSaved();
    onClose();
  };
  return (
    <Modal
      title="Add a fact worth remembering"
      icon={<Sparkles size={17} className="modal-icon amber" />}
      onClose={onClose}
      footer={
        <SaveFooter
          label="Save fact"
          disabled={!text.trim()}
          onSave={save}
          onClose={onClose}
        />
      }
    >
      <Field
        label="Fact"
        hint="Small and durable — unlike news, facts don’t go stale."
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Allergic to shellfish. Partner is Sam. Supports Arsenal."
        />
      </Field>
    </Modal>
  );
}

export function AddReminderModal({ personId, onClose, onSaved }: AddProps) {
  const [text, setText] = useState("");
  const [due, setDue] = useState(todayISO());
  const save = async () => {
    await api.addReminder(personId, text.trim(), due);
    await onSaved();
    onClose();
  };
  return (
    <Modal
      title="Set a reminder"
      icon={<Bell size={17} className="modal-icon blue" />}
      onClose={onClose}
      footer={
        <SaveFooter
          label="Save reminder"
          disabled={!text.trim() || !due}
          onSave={save}
          onClose={onClose}
        />
      }
    >
      <div className="form-grid">
        <Field label="What needs doing?" wide>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Book a table for her birthday"
          />
        </Field>
        <Field
          label="Due date"
          wide
          hint="Reminders due or overdue show up on Today."
        >
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function AddGiftModal({ personId, onClose, onSaved }: AddProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GiftKind>("idea");
  const [occasion, setOccasion] = useState("");
  const save = async () => {
    await api.addGift(personId, {
      name: name.trim(),
      kind,
      occasion: occasion.trim() || null,
      date: todayISO(),
    });
    await onSaved();
    onClose();
  };
  return (
    <Modal
      title="Add a gift"
      icon={<Gift size={17} className="modal-icon purple" />}
      onClose={onClose}
      footer={
        <SaveFooter
          label="Save gift"
          disabled={!name.trim()}
          onSave={save}
          onClose={onClose}
        />
      }
    >
      <div className="form-grid">
        <Field label="What?" wide>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ceramic ramen bowl set"
          />
        </Field>
        <Field label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GiftKind)}
          >
            <option value="idea">Idea (not given yet)</option>
            <option value="given">Given to them</option>
            <option value="received">Received from them</option>
          </select>
        </Field>
        <Field label="Occasion">
          <input
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Birthday"
          />
        </Field>
      </div>
    </Modal>
  );
}
