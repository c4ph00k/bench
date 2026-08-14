import { useMemo } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import {
  Activity,
  Contact,
  Deal,
  Organization,
  isOpen,
  monthRange,
  monthlyRevenue,
  pipelineFunnel,
  sumExpected,
  sumValue,
  topOrganizations,
  winLoss,
} from "../types";
import {
  RevenueChart,
  RevenueFunnel,
  TopOrganizations,
  WinRateDonut,
} from "../components/DashboardCharts";
import { formatDate, formatDateTime, formatMoney } from "../format";

/** Six months behind and six ahead: what landed, then what is forecast to. */
const MONTHS_BACK = 5;
const MONTHS_FORWARD = 6;

export default function Dashboard() {
  const { data: deals } = useFetch<Deal[]>("/api/crm/deals");
  const { data: contacts } = useFetch<Contact[]>("/api/crm/contacts");
  const { data: orgs } = useFetch<Organization[]>("/api/crm/organizations");
  const { data: activities, reload: reloadActivities } = useFetch<Activity[]>(
    "/api/crm/activities",
  );

  const contactName = useMemo(
    () => new Map((contacts ?? []).map((c) => [c.id, c.name])),
    [contacts],
  );
  const dealName = useMemo(
    () => new Map((deals ?? []).map((d) => [d.id, d.name])),
    [deals],
  );
  const orgName = useMemo(
    () => new Map((orgs ?? []).map((o) => [o.id, o.name])),
    [orgs],
  );

  const months = useMemo(
    () => monthRange(new Date(), MONTHS_BACK, MONTHS_FORWARD),
    [],
  );
  const monthly = useMemo(
    () => monthlyRevenue(deals ?? [], months),
    [deals, months],
  );
  // The tiles say "6 mo" and mean it, so they read the trailing slice rather than the whole range.
  const trailing = monthly.slice(0, MONTHS_BACK + 1);

  const openDeals = useMemo(() => (deals ?? []).filter(isOpen), [deals]);
  const expectedRevenue = useMemo(() => sumExpected(openDeals), [openDeals]);

  const funnel = useMemo(
    () => pipelineFunnel(deals ?? [], months[0].key),
    [deals, months],
  );
  const rate = useMemo(
    () => winLoss(deals ?? [], months[0].key),
    [deals, months],
  );
  const byOrg = useMemo(
    () => topOrganizations(deals ?? [], orgName, 5),
    [deals, orgName],
  );

  const today = new Date().toISOString().slice(0, 10);
  const tasks = useMemo(
    () =>
      (activities ?? [])
        .filter((a) => a.due_date && !a.done)
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
    [activities],
  );
  const overdue = tasks.filter((t) => t.due_date! < today);
  const upcoming = tasks.filter((t) => t.due_date! >= today);
  const recent = (activities ?? []).slice(0, 8);

  async function toggleDone(task: Activity) {
    await api.patch(`/api/crm/activities/${task.id}`, { done: true });
    reloadActivities();
  }

  function relatedLink(a: Activity) {
    if (a.contact_id && contactName.has(a.contact_id))
      return (
        <Link className="entity-link" to={`/contacts/${a.contact_id}`}>
          {contactName.get(a.contact_id)}
        </Link>
      );
    if (a.deal_id && dealName.has(a.deal_id))
      return (
        <Link className="entity-link" to={`/deals/${a.deal_id}`}>
          {dealName.get(a.deal_id)}
        </Link>
      );
    return null;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">How your sales are going at a glance</p>
        </div>
      </div>
      <div className="stat-row">
        <div className="card stat-tile">
          <div className="stat-label">Open deals</div>
          <div className="stat-value">{openDeals.length}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Pipeline value</div>
          <div className="stat-value" data-testid="dash-total">
            {formatMoney(sumValue(openDeals))}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Expected revenue</div>
          <div className="stat-value accent" data-testid="dash-expected">
            {formatMoney(expectedRevenue)}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Deals won (6 mo)</div>
          <div className="stat-value">
            {trailing.reduce((s, m) => s + m.won, 0)}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Revenue won (6 mo)</div>
          <div className="stat-value">
            {formatMoney(trailing.reduce((s, m) => s + m.actual, 0))}
          </div>
        </div>
      </div>
      <div className="dash-grid">
        <div className="card">
          <h2>Revenue and deal volume</h2>
          <p className="card-sub">
            Won revenue behind today, the weighted pipeline ahead of it, and the
            number of deals closing each month.
          </p>
          <RevenueChart data={monthly} />
        </div>
        <div className="card">
          <h2>Revenue funnel</h2>
          <p className="card-sub">
            Value at or past each stage: the open pipeline plus the last six
            months of wins. Lost deals are excluded.
          </p>
          <RevenueFunnel data={funnel} />
        </div>
        <div className="card">
          <h2>Win rate</h2>
          <p className="card-sub">
            Deals closed in the last six months, won against lost.
          </p>
          {rate.won + rate.lost === 0 ? (
            <p className="muted">Nothing has closed in the last six months.</p>
          ) : (
            <WinRateDonut data={rate} />
          )}
        </div>
        <div className="card">
          <h2>Top organizations</h2>
          <p className="card-sub">Where the open pipeline is concentrated.</p>
          {byOrg.length === 0 ? (
            <p className="muted">No open deals against an organization.</p>
          ) : (
            <TopOrganizations data={byOrg} />
          )}
        </div>
        <div className="card">
          <h2>Recent activity</h2>
          <div className="feed-list">
            {recent.map((a) => (
              <div key={a.id} className="feed-item">
                <div className={`activity-icon ${a.type}`}>
                  {a.type.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div>{a.description}</div>
                  <div className="timeline-meta">
                    <span>{formatDateTime(a.occurred_at)}</span>
                    {relatedLink(a)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Follow-ups</h2>
          {tasks.length === 0 && (
            <p className="muted">Nothing due. Nice work.</p>
          )}
          <div className="task-list">
            {[...overdue, ...upcoming].map((t) => (
              <div key={t.id} className="task-item">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => void toggleDone(t)}
                  aria-label={`Mark done: ${t.description}`}
                />
                <div style={{ flex: 1 }}>
                  <div>{t.description}</div>
                  <div className="timeline-meta">
                    <span
                      className={`due-chip${t.due_date! < today ? " overdue" : ""}`}
                    >
                      {t.due_date! < today ? "Overdue: " : "Due "}
                      {formatDate(t.due_date)}
                    </span>
                    {relatedLink(t)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
