import { beforeEach, describe, expect, it } from 'vitest'
import {
  DB,
  openDb,
  createContact,
  createDeal,
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
} from '../../src/crm/db.js'

let db: DB

beforeEach(() => {
  db = openDb(':memory:')
})

describe('adding activities', () => {
  it('adds an activity to a contact and lists it on their timeline', () => {
    const contact = createContact(db, { name: 'Jane', status: 'lead' })
    createActivity(db, { type: 'call', contact_id: contact.id, description: 'Discovery call' })
    const timeline = listActivities(db, { contact_id: contact.id })
    expect(timeline).toHaveLength(1)
    expect(timeline[0]).toMatchObject({ type: 'call', description: 'Discovery call' })
  })

  it('adds an activity to a deal and lists it on the deal timeline', () => {
    const deal = createDeal(db, { name: 'Big deal', stage: 'Proposal', value: 1000 })
    createActivity(db, { type: 'email', deal_id: deal.id, description: 'Sent proposal' })
    expect(listActivities(db, { deal_id: deal.id })).toHaveLength(1)
  })

  it('orders a timeline newest first', () => {
    const contact = createContact(db, { name: 'Jane', status: 'lead' })
    createActivity(db, { type: 'note', contact_id: contact.id, description: 'First', occurred_at: '2026-06-01 09:00:00' })
    createActivity(db, { type: 'note', contact_id: contact.id, description: 'Second', occurred_at: '2026-06-15 09:00:00' })
    createActivity(db, { type: 'note', contact_id: contact.id, description: 'Third', occurred_at: '2026-06-30 09:00:00' })
    expect(listActivities(db, { contact_id: contact.id }).map((a) => a.description)).toEqual(['Third', 'Second', 'First'])
  })

  it('stores an optional due date so an activity doubles as a task', () => {
    const activity = createActivity(db, { type: 'note', description: 'Follow up', due_date: '2026-07-10' })
    expect(getActivity(db, activity.id)).toMatchObject({ due_date: '2026-07-10', done: 0 })
  })
})

describe('toggling task completion', () => {
  it('marks a task done and back to not-done', () => {
    const activity = createActivity(db, { type: 'call', description: 'Call back', due_date: '2026-07-10' })
    updateActivity(db, activity.id, { done: true })
    expect(getActivity(db, activity.id).done).toBe(1)
    updateActivity(db, activity.id, { done: false })
    expect(getActivity(db, activity.id).done).toBe(0)
  })

  it('keeps other fields intact when toggling', () => {
    const activity = createActivity(db, { type: 'email', description: 'Send recap', due_date: '2026-07-08' })
    updateActivity(db, activity.id, { done: true })
    expect(getActivity(db, activity.id)).toMatchObject({
      type: 'email',
      description: 'Send recap',
      due_date: '2026-07-08',
      done: 1,
    })
  })
})
