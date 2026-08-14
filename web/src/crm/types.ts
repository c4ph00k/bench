export const DEAL_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const CONTACT_STATUSES = ['lead', 'qualified', 'customer'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const ACTIVITY_TYPES = ['note', 'call', 'email'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export interface Organization {
  id: number
  name: string
  website: string | null
  industry: string | null
  notes: string | null
  created_at: string
}

export interface Contact {
  id: number
  name: string
  email: string | null
  phone: string | null
  job_title: string | null
  organization_id: number | null
  status: ContactStatus
  created_at: string
}

export interface Deal {
  id: number
  name: string
  organization_id: number | null
  contact_id: number | null
  stage: DealStage
  value: number
  probability: number
  close_date: string | null
  created_at: string
}

/** Default win likelihood per stage; the server re-bases a deal on this when it moves. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  New: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
}

/** Stage colours, drawn from the app palette so the pipeline matches the rest of the UI. */
export const STAGE_COLOR: Record<DealStage, string> = {
  New: '#6b7280',
  Qualified: '#209dd7',
  Proposal: '#753991',
  Negotiation: '#ecad0a',
  Won: '#2f9e5f',
  Lost: '#c94f42',
}

/** Stages a deal can still be won from. */
export const OPEN_STAGES: DealStage[] = ['New', 'Qualified', 'Proposal', 'Negotiation']

export function isOpen(deal: Deal): boolean {
  return OPEN_STAGES.includes(deal.stage)
}

/** Value weighted by the odds of winning it. */
export function expectedValue(deal: Pick<Deal, 'value' | 'probability'>): number {
  return (deal.value * deal.probability) / 100
}

export function sumValue(deals: Deal[]): number {
  return deals.reduce((total, d) => total + d.value, 0)
}

export function sumExpected(deals: Deal[]): number {
  return deals.reduce((total, d) => total + expectedValue(d), 0)
}

export interface Activity {
  id: number
  type: ActivityType
  contact_id: number | null
  deal_id: number | null
  description: string
  occurred_at: string
  due_date: string | null
  done: 0 | 1
  created_at: string
}
