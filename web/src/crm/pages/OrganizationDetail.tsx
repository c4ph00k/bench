import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import { Contact, Deal, Organization } from "../types";
import OrganizationForm from "../components/OrganizationForm";
import ConfirmDialog from "../components/ConfirmDialog";
import { StageChip, StatusChip, formatMoney } from "../components/Chips";

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: org, reload } = useFetch<Organization>(
    `/api/crm/organizations/${id}`,
  );
  const { data: contacts } = useFetch<Contact[]>(
    `/api/crm/contacts?organization_id=${id}`,
  );
  const { data: deals } = useFetch<Deal[]>(
    `/api/crm/deals?organization_id=${id}`,
  );

  if (!org) return null;

  async function remove() {
    await api.delete(`/api/crm/organizations/${id}`);
    navigate("/organizations");
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/organizations">Organizations</Link> / {org.name}
      </div>
      <div className="page-header">
        <div>
          <h1>{org.name}</h1>
          <p className="page-sub">{org.industry || "Organization"}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
      </div>
      <div className="detail-grid">
        <div className="card full">
          <h2>Details</h2>
          <dl className="props">
            <dt>Website</dt>
            <dd>{org.website || "—"}</dd>
            <dt>Industry</dt>
            <dd>{org.industry || "—"}</dd>
            <dt>Notes</dt>
            <dd>{org.notes || "—"}</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Contacts ({contacts?.length ?? 0})</h2>
          {contacts?.length ? (
            <div className="task-list">
              {contacts.map((c) => (
                <div key={c.id} className="task-item">
                  <div style={{ flex: 1 }}>
                    <Link className="entity-link" to={`/contacts/${c.id}`}>
                      {c.name}
                    </Link>
                    <div className="muted">{c.job_title || c.email || ""}</div>
                  </div>
                  <StatusChip status={c.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No contacts yet.</p>
          )}
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
      </div>
      {editing && (
        <OrganizationForm
          existing={org}
          onSaved={reload}
          onClose={() => setEditing(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete organization"
          message={`Delete "${org.name}"? Its contacts and deals will be kept but unlinked.`}
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
