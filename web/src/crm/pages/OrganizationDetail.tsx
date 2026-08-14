import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import { Contact, Deal, Organization } from "../types";
import OrganizationForm from "../components/OrganizationForm";
import ConfirmDialog from "../components/ConfirmDialog";
import { ContactList, DealList } from "../components/RelatedLists";
import PageHeader from "../components/PageHeader";
import { IconOrganizations } from "../components/Icons";

function OrganizationFacts({ org }: { org: Organization }) {
  return (
    <dl className="props">
      <dt>Website</dt>
      <dd>{org.website || "—"}</dd>
      <dt>Industry</dt>
      <dd>{org.industry || "—"}</dd>
      <dt>Notes</dt>
      <dd>{org.notes || "—"}</dd>
    </dl>
  );
}

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
    void navigate("/organizations");
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/organizations">Organizations</Link> / {org.name}
      </div>
      <PageHeader
        icon={<IconOrganizations size={20} />}
        title={org.name}
        sub={org.industry || "Organization"}
      >
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
      </PageHeader>
      <div className="detail-grid">
        <div className="card full">
          <h2>Details</h2>
          <OrganizationFacts org={org} />
        </div>
        <div className="card">
          <h2>Contacts ({contacts?.length ?? 0})</h2>
          <ContactList contacts={contacts ?? []} />
        </div>
        <div className="card">
          <h2>Deals ({deals?.length ?? 0})</h2>
          <DealList deals={deals ?? []} />
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
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
