import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api, query } from "../api";
import { useFetch } from "../hooks";
import {
  Contact,
  DEAL_STAGES,
  Deal,
  Organization,
  expectedValue,
  sumExpected,
  sumValue,
} from "../types";
import DataTable from "../components/DataTable";
import DealForm from "../components/DealForm";
import ConfirmDialog from "../components/ConfirmDialog";
import { StageChip, formatDate, formatMoney } from "../components/Chips";
import { IconPlus, IconSearch } from "../components/Icons";

export default function Deals() {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const navigate = useNavigate();
  const { data, reload } = useFetch<Deal[]>(
    "/api/crm/deals" + query({ q, stage }),
  );
  const { data: orgs } = useFetch<Organization[]>("/api/crm/organizations");
  const { data: contacts } = useFetch<Contact[]>("/api/crm/contacts");
  const deals = useMemo(() => data ?? [], [data]);
  const orgName = useMemo(
    () => new Map((orgs ?? []).map((o) => [o.id, o.name])),
    [orgs],
  );
  const contactName = useMemo(
    () => new Map((contacts ?? []).map((c) => [c.id, c.name])),
    [contacts],
  );

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Deal",
        cell: (c) => <strong>{c.getValue<string>()}</strong>,
      },
      {
        accessorKey: "organization_id",
        header: "Organization",
        cell: (c) =>
          orgName.get(c.getValue<number>()) ?? (
            <span className="cell-empty">—</span>
          ),
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: (c) => <StageChip stage={c.row.original.stage} />,
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: (c) => (
          <span className="cell-money">
            {formatMoney(c.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "probability",
        header: "Probability",
        cell: (c) => {
          const p = c.getValue<number>();
          return (
            <span className="prob">
              <span className="prob-bar">
                <span className="prob-fill" style={{ width: `${p}%` }} />
              </span>
              <span className="prob-num">{p}%</span>
            </span>
          );
        },
      },
      {
        id: "expected",
        header: "Expected",
        accessorFn: (d) => expectedValue(d),
        cell: (c) => (
          <span className="cell-money">
            {formatMoney(c.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "close_date",
        header: "Close date",
        cell: (c) => formatDate(c.getValue<string>()),
      },
      {
        accessorKey: "contact_id",
        header: "Contact",
        cell: (c) =>
          contactName.get(c.getValue<number>()) ?? (
            <span className="cell-empty">—</span>
          ),
      },
    ],
    [orgName, contactName],
  );

  const remove = async () => {
    if (!deleting) return;
    await api.delete(`/api/crm/deals/${deleting.id}`);
    setDeleting(null);
    reload();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Deals</h1>
          <p className="page-sub">The potential sales you're working on</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <IconPlus size={16} />
          Add deal
        </button>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <IconSearch size={15} />
          <input
            className="search-input"
            type="search"
            placeholder="Search deals…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          aria-label="Filter by stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        data={deals}
        columns={columns}
        noun="deal"
        rowLabel={(d) => d.name}
        onRowClick={(d) => navigate(`/deals/${d.id}`)}
        onEdit={(d) => setEditing(d)}
        onDelete={(d) => setDeleting(d)}
        emptyMessage={
          q || stage ? "No deals match these filters." : "No deals yet."
        }
        summary={
          <>
            Total {formatMoney(sumValue(deals))} · Expected{" "}
            {formatMoney(sumExpected(deals))}
          </>
        }
      />
      {adding && (
        <DealForm
          organizations={orgs ?? []}
          contacts={contacts ?? []}
          onSaved={reload}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <DealForm
          existing={editing}
          organizations={orgs ?? []}
          contacts={contacts ?? []}
          onSaved={reload}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete deal"
          message={`Delete ${deleting.name}? This cannot be undone.`}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
