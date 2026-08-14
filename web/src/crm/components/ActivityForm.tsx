import { FormEvent, useState } from "react";
import Modal from "./Modal";
import { api } from "../api";
import { ACTIVITY_TYPES, ActivityType } from "../types";

interface Props {
  contactId?: number;
  dealId?: number;
  onSaved: () => void;
  onClose: () => void;
}

export default function ActivityForm({
  contactId,
  dealId,
  onSaved,
  onClose,
}: Props) {
  const [form, setForm] = useState({
    type: "note" as ActivityType,
    description: "",
    due_date: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/crm/activities", {
      type: form.type,
      description: form.description,
      contact_id: contactId ?? null,
      deal_id: dealId ?? null,
      due_date: form.due_date || null,
    });
    onSaved();
    onClose();
  }

  return (
    <Modal title="Log activity" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="act-type">Type</label>
            <select
              id="act-type"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ActivityType })
              }
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="act-due">Follow-up due date (optional)</label>
            <input
              id="act-due"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="act-desc">Description</label>
          <textarea
            id="act-desc"
            rows={3}
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
