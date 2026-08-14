import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import { Activity, Contact, Deal, Organization } from "../types";
import DealForm from "../components/DealForm";
import ConfirmDialog from "../components/ConfirmDialog";
import ActivityForm from "../components/ActivityForm";
import ActivityTimeline from "../components/ActivityTimeline";
import { StageChip, formatDate, formatMoney } from "../components/Chips";

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logging, setLogging] = useState(false);
  const { data: deal, reload } = useFetch<Deal>(`/api/crm/deals/${id}`);
  const { data: activities, reload: reloadActivities } = useFetch<Activity[]>(
    `/api/crm/activities?deal_id=${id}`,
  );
  const { data: orgs } = useFetch<Organization[]>("/api/crm/organizations");
  const { data: contacts } = useFetch<Contact[]>("/api/crm/contacts");
  const org = orgs?.find((o) => o.id === deal?.organization_id);
  const contact = contacts?.find((c) => c.id === deal?.contact_id);

  if (!deal) return null;

  async function remove() {
    await api.delete(`/api/crm/deals/${id}`);
    void navigate("/deals");
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/deals">Deals</Link> / {deal.name}
      </div>
      <div className="page-header">
        <div>
          <h1>{deal.name}</h1>
          <p className="page-sub">
            {formatMoney(deal.value)}
            {org ? ` · ${org.name}` : ""}
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
            <dt>Stage</dt>
            <dd>
              <StageChip stage={deal.stage} />
            </dd>
            <dt>Value</dt>
            <dd>{formatMoney(deal.value)}</dd>
            <dt>Close date</dt>
            <dd>{formatDate(deal.close_date)}</dd>
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
            <dt>Primary contact</dt>
            <dd>
              {contact ? (
                <Link className="entity-link" to={`/contacts/${contact.id}`}>
                  {contact.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </div>
        <div className="card">
          <h2>Activity</h2>
          <ActivityTimeline
            activities={activities ?? []}
            onChanged={reloadActivities}
          />
        </div>
      </div>
      {logging && (
        <ActivityForm
          dealId={deal.id}
          onSaved={reloadActivities}
          onClose={() => setLogging(false)}
        />
      )}
      {editing && (
        <DealForm
          existing={deal}
          organizations={orgs ?? []}
          contacts={contacts ?? []}
          onSaved={reload}
          onClose={() => setEditing(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete deal"
          message={`Delete "${deal.name}"? This cannot be undone.`}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
