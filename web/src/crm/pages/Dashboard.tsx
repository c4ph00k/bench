import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import { useFetch } from '../hooks'
import { Activity, Contact, Deal, OPEN_STAGES, STAGE_COLOR, isOpen, sumExpected, sumValue } from '../types'
import { formatDate, formatDateTime, formatMoney } from '../components/Chips'

const CHART_BLUE = '#1b86b8'
const CHART_PURPLE = '#753991'

function lastSixMonths(): { key: string; label: string }[] {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    })
  }
  return months
}

const tooltipStyle = {
  border: '1px solid #d4d8de',
  borderRadius: 6,
  fontSize: 13,
}

function MonthlyBarChart({
  data,
  dataKey,
  fill,
  money,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  fill: string
  money?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: money ? 8 : -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e5e8ec" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickFormatter={money ? (v: number) => `$${v >= 1000 ? `${v / 1000}k` : v}` : undefined}
          width={money ? 52 : undefined}
        />
        <Tooltip
          cursor={{ fill: '#f2f4f6' }}
          contentStyle={tooltipStyle}
          formatter={(value) => [money ? formatMoney(Number(value)) : value, money ? 'Revenue' : 'Deals won']}
        />
        <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const { data: deals } = useFetch<Deal[]>('/api/crm/deals')
  const { data: contacts } = useFetch<Contact[]>('/api/crm/contacts')
  const { data: activities, reload: reloadActivities } = useFetch<Activity[]>('/api/crm/activities')

  const contactName = useMemo(() => new Map((contacts ?? []).map((c) => [c.id, c.name])), [contacts])
  const dealName = useMemo(() => new Map((deals ?? []).map((d) => [d.id, d.name])), [deals])

  const monthly = useMemo(() => {
    const months = lastSixMonths()
    return months.map((m) => {
      const won = (deals ?? []).filter((d) => d.stage === 'Won' && d.close_date?.startsWith(m.key))
      const open = (deals ?? []).filter((d) => isOpen(d) && d.close_date?.startsWith(m.key))
      return {
        label: m.label,
        deals: won.length,
        revenue: sumValue(won),
        expected: sumExpected(open),
      }
    })
  }, [deals])

  const openDeals = useMemo(() => (deals ?? []).filter(isOpen), [deals])
  const expectedRevenue = useMemo(() => sumExpected(openDeals), [openDeals])

  /**
   * A sales funnel counts what has reached at least each stage, not what is sitting in it, so the
   * shape narrows as deals drop out. Lost deals leave the funnel entirely.
   */
  const funnel = useMemo(() => {
    const stages = [...OPEN_STAGES, 'Won' as const]
    const live = (deals ?? []).filter((d) => d.stage !== 'Lost')
    return stages.map((stage, i) => {
      const reached = live.filter((d) => stages.indexOf(d.stage) >= i)
      return {
        name: stage,
        value: sumValue(reached),
        count: reached.length,
        fill: STAGE_COLOR[stage],
      }
    })
  }, [deals])

  const today = new Date().toISOString().slice(0, 10)
  const tasks = useMemo(
    () =>
      (activities ?? [])
        .filter((a) => a.due_date && !a.done)
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
    [activities]
  )
  const overdue = tasks.filter((t) => t.due_date! < today)
  const upcoming = tasks.filter((t) => t.due_date! >= today)
  const recent = (activities ?? []).slice(0, 8)

  async function toggleDone(task: Activity) {
    await api.patch(`/api/crm/activities/${task.id}`, { done: true })
    reloadActivities()
  }

  function relatedLink(a: Activity) {
    if (a.contact_id && contactName.has(a.contact_id))
      return (
        <Link className="entity-link" to={`/contacts/${a.contact_id}`}>
          {contactName.get(a.contact_id)}
        </Link>
      )
    if (a.deal_id && dealName.has(a.deal_id))
      return (
        <Link className="entity-link" to={`/deals/${a.deal_id}`}>
          {dealName.get(a.deal_id)}
        </Link>
      )
    return null
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
          <div className="stat-value" data-testid="dash-total">{formatMoney(sumValue(openDeals))}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Expected revenue</div>
          <div className="stat-value accent" data-testid="dash-expected">{formatMoney(expectedRevenue)}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Deals won (6 mo)</div>
          <div className="stat-value">{monthly.reduce((s, m) => s + m.deals, 0)}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Revenue won (6 mo)</div>
          <div className="stat-value">{formatMoney(monthly.reduce((s, m) => s + m.revenue, 0))}</div>
        </div>
      </div>
      <div className="dash-grid">
        <div className="card">
          <h2>Deals won per month</h2>
          <MonthlyBarChart data={monthly} dataKey="deals" fill={CHART_BLUE} />
        </div>
        <div className="card">
          <h2>Expected vs actual revenue</h2>
          <p className="card-sub">Won revenue against the weighted value of deals closing that month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e5e8ec" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                width={52}
              />
              <Tooltip
                cursor={{ fill: '#f2f4f6' }}
                contentStyle={tooltipStyle}
                formatter={(value, name) => [formatMoney(Number(value)), name === 'revenue' ? 'Actual' : 'Expected']}
              />
              <Legend
                formatter={(value) => (value === 'revenue' ? 'Actual' : 'Expected')}
                wrapperStyle={{ fontSize: 12, color: '#6b7280' }}
              />
              <Bar dataKey="revenue" fill={CHART_PURPLE} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expected" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Revenue funnel</h2>
          <p className="card-sub">Value that has reached at least each stage, lost deals excluded</p>
          {funnel.length === 0 ? (
            <p className="muted">No open deals to chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <FunnelChart margin={{ top: 8, right: 96, left: 96, bottom: 8 }}>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, _name, item) => [
                    `${formatMoney(Number(value))} · ${item?.payload?.count ?? 0} deals`,
                    item?.payload?.name ?? '',
                  ]}
                />
                <Funnel dataKey="value" data={funnel} isAnimationActive={false} lastShapeType="rectangle">
                  {funnel.map((row) => (
                    <Cell key={row.name} fill={row.fill} />
                  ))}
                  <LabelList
                    position="right"
                    dataKey="name"
                    stroke="none"
                    fill="#454c58"
                    fontSize={12}
                    offset={12}
                  />
                  <LabelList
                    position="left"
                    dataKey="value"
                    stroke="none"
                    fill="#454c58"
                    fontSize={12}
                    offset={12}
                    formatter={(v: unknown) => formatMoney(Number(v))}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h2>Follow-ups</h2>
          {tasks.length === 0 && <p className="muted">Nothing due. Nice work.</p>}
          <div className="task-list">
            {[...overdue, ...upcoming].map((t) => (
              <div key={t.id} className="task-item">
                <input type="checkbox" checked={false} onChange={() => toggleDone(t)} aria-label={`Mark done: ${t.description}`} />
                <div style={{ flex: 1 }}>
                  <div>{t.description}</div>
                  <div className="timeline-meta">
                    <span className={`due-chip${t.due_date! < today ? ' overdue' : ''}`}>
                      {t.due_date! < today ? 'Overdue: ' : 'Due '}
                      {formatDate(t.due_date)}
                    </span>
                    {relatedLink(t)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Recent activity</h2>
          <div className="feed-list">
            {recent.map((a) => (
              <div key={a.id} className="feed-item">
                <div className={`activity-icon ${a.type}`}>{a.type.slice(0, 1)}</div>
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
      </div>
    </>
  )
}
