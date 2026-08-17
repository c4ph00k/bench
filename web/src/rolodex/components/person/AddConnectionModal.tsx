import { useState } from "react";
import { Link2 } from "lucide-react";
import { api } from "../../api";
import type { ConnectionKind, PersonComputed } from "../../types";
import { Modal } from "../Modal";
import { Field, FieldGroup } from "../Field";

const KIND_OPTIONS: { value: ConnectionKind; label: string }[] = [
  { value: "partner", label: "Partner of" },
  { value: "parent_child", label: "Parent / child of" },
  { value: "sibling", label: "Sibling of" },
  { value: "colleague", label: "Colleague of" },
  { value: "other", label: "Other" },
];

/** A free-text connection reads from one side only, so each side gets its own wording. */
function sideLabel(text: string, otherName: string): string {
  return text.trim()
    ? `${text.trim()} ${otherName}`
    : `Connected to ${otherName}`;
}

export default function AddConnectionModal({
  person,
  people,
  onClose,
  onSaved,
}: {
  person: PersonComputed;
  people: PersonComputed[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const others = people.filter((p) => p.id !== person.id);
  const [otherId, setOtherId] = useState<number | "">("");
  const [kind, setKind] = useState<ConnectionKind>("partner");
  const [aIsParent, setAIsParent] = useState(true);
  const [label, setLabel] = useState("");
  const [inverseLabel, setInverseLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherName = others.find((p) => p.id === otherId)?.name ?? "";

  const save = async () => {
    if (!otherId) {
      setError("Pick a person to connect");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.addConnection(person.id, {
        other_id: otherId,
        kind,
        a_is_parent: kind === "parent_child" ? aIsParent : false,
        label: kind === "other" ? sideLabel(label, otherName) : null,
        inverse_label:
          kind === "other" ? sideLabel(inverseLabel, person.name) : null,
        note: kind === "colleague" && note.trim() ? note.trim() : null,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const firstName = person.name.split(" ")[0];
  return (
    <Modal
      title={`Connect ${firstName} to someone`}
      icon={<Link2 size={17} className="modal-icon blue" />}
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
            Save connection
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Person" wide>
          <select
            value={otherId}
            onChange={(e) => setOtherId(Number(e.target.value) || "")}
          >
            <option value="">— choose —</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Relationship" wide>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConnectionKind)}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        {kind === "parent_child" && otherId !== "" && (
          <FieldGroup label="Who is the parent?" wide>
            <div className="row" style={{ gap: 14 }}>
              <label className="row radio-option">
                <input
                  type="radio"
                  name="parent"
                  checked={aIsParent}
                  onChange={() => setAIsParent(true)}
                />
                {person.name} is the parent
              </label>
              <label className="row radio-option">
                <input
                  type="radio"
                  name="parent"
                  checked={!aIsParent}
                  onChange={() => setAIsParent(false)}
                />
                {otherName} is the parent
              </label>
            </div>
          </FieldGroup>
        )}
        {kind === "colleague" && (
          <Field label="Where? (optional)" wide>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="at Fabrikam, years ago"
            />
          </Field>
        )}
        {kind === "other" && (
          <>
            <Field label={`On ${firstName}’s page`}>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`e.g. “Introduced me to” ${otherName || "…"}`}
              />
            </Field>
            <Field
              label={`On ${otherName ? otherName.split(" ")[0] : "their"}’s page`}
            >
              <input
                value={inverseLabel}
                onChange={(e) => setInverseLabel(e.target.value)}
                placeholder={`e.g. “Introduced me to” ${firstName}`}
              />
            </Field>
          </>
        )}
      </div>
      <div className="hint modal-hint">
        Connections appear on both people’s pages, reading correctly from each
        side.
      </div>
    </Modal>
  );
}
