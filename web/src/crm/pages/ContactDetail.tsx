import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import { Activity, Contact, Deal, Organization } from "../types";
import ContactForm from "../components/ContactForm";
import ConfirmDialog from "../components/ConfirmDialog";
import ActivityForm from "../components/ActivityForm";
import ActivityTimeline from "../components/ActivityTimeline";
import { StageChip, StatusChip, formatMoney } from "../components/Chips";

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logging, setLogging] = useState(false);
  const { data: contact, reload } = useFetch<Contact>(
    `/api/crm/contacts/${id}`,
  );
  const { data: orgs } = useFetch<Organization[]>("/api/crm/organizations");
  const { data: deals } = useFetch<Deal[]>(`/api/crm/deals?contact_id=${id}`);
  const { data: activities, reload: reloadActivities } = useFetch<Activity[]>(
    `/api/crm/activities?contact_id=${id}`,
  );
  const org = orgs?.find((o) => o.id === contact?.organization_id);

  if (!contact) return null;

  async function remove() {
    await api.delete(`/api/crm/contacts/${id}`);
    navigate("/contacts");
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/contacts">Contacts</Link> / {contact.name}
      </div>
      <div className="page-header">
        <div>
          <h1>{contact.name}</h1>
          <p className="page-sub">
            {contact.job_title || "Contact"}
            {org ? ` at ${org.name}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setLogging(true)}>
            Log activity
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
      </div>
      <div className="detail-grid">
        <div className="card">
          <h2>Details</h2>
          <dl className="props">
            <dt>Status</dt>
            <dd>
              <StatusChip status={contact.status} />
            </dd>
            <dt>Email</dt>
            <dd>{contact.email || "—"}</dd>
            <dt>Phone</dt>
            <dd>{contact.phone || "—"}</dd>
            <dt>Job title</dt>
            <dd>{contact.job_title || "—"}</dd>
            <dt>Organization</dt>
            <dd>
              {org ? (
                <Link className="entity-link" to={`/organizations/${org.id}`}>
                  {org.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </div>
        <div className="card">
          <h2>Deals ({deals?.length ?? 0})</h2>
          {deals?.length ? (
            <div className="task-list">
              {deals.map((d) => (
                <div key={d.id} className="task-item">
                  <div style={{ flex: 1 }}>
                    <Link className="entity-link" to={`/deals/${d.id}`}>
                      {d.name}
                    </Link>
                    <div className="muted">{formatMoney(d.value)}</div>
                  </div>
                  <StageChip stage={d.stage} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No deals yet.</p>
          )}
        </div>
        <div className="card full">
          <h2>Activity</h2>
          <ActivityTimeline
            activities={activities ?? []}
            onChanged={reloadActivities}
          />
        </div>
      </div>
      {logging && (
        <ActivityForm
          contactId={contact.id}
          onSaved={reloadActivities}
          onClose={() => setLogging(false)}
        />
      )}
      {editing && (
        <ContactForm
          existing={contact}
          organizations={orgs ?? []}
          onSaved={reload}
          onClose={() => setEditing(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete contact"
          message={`Delete "${contact.name}"? This cannot be undone.`}
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
