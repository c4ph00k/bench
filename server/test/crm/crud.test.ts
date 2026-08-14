import { beforeEach, describe, expect, it } from 'vitest'
import {
  DB,
  openDb,
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
  deleteOrganization,
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  createDeal,
  getDeal,
  listDeals,
  updateDeal,
  deleteDeal,
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
  deleteActivity,
} from '../../src/crm/db.js'

let db: DB

beforeEach(() => {
  db = openDb(':memory:')
})

describe('organizations CRUD', () => {
  it('creates and reads an organization', () => {
    const org = createOrganization(db, { name: 'Acme Corp', website: 'acme.com', industry: 'Manufacturing' })
    expect(org.id).toBeGreaterThan(0)
    expect(getOrganization(db, org.id)).toMatchObject({ name: 'Acme Corp', website: 'acme.com' })
  })

  it('lists organizations', () => {
    createOrganization(db, { name: 'Beta' })
    createOrganization(db, { name: 'Alpha' })
    expect(listOrganizations(db).map((o) => o.name)).toEqual(['Alpha', 'Beta'])
  })

  it('updates an organization', () => {
    const org = createOrganization(db, { name: 'Acme Corp' })
    updateOrganization(db, org.id, { name: 'Acme Inc', industry: 'Retail' })
    expect(getOrganization(db, org.id)).toMatchObject({ name: 'Acme Inc', industry: 'Retail' })
  })

  it('deletes an organization', () => {
    const org = createOrganization(db, { name: 'Acme Corp' })
    deleteOrganization(db, org.id)
    expect(getOrganization(db, org.id)).toBeUndefined()
  })
})

describe('contacts CRUD', () => {
  it('creates and reads a contact', () => {
    const org = createOrganization(db, { name: 'Acme Corp' })
    const contact = createContact(db, {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      status: 'lead',
      organization_id: org.id,
    })
    expect(getContact(db, contact.id)).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      status: 'lead',
      organization_id: org.id,
    })
  })

  it('updates a contact', () => {
    const contact = createContact(db, { name: 'Jane Doe', status: 'lead' })
    updateContact(db, contact.id, { name: 'Jane Doe', status: 'customer', phone: '555-0100' })
    expect(getContact(db, contact.id)).toMatchObject({ status: 'customer', phone: '555-0100' })
  })

  it('deletes a contact', () => {
    const contact = createContact(db, { name: 'Jane Doe', status: 'lead' })
    deleteContact(db, contact.id)
    expect(getContact(db, contact.id)).toBeUndefined()
  })

  it('lists contacts filtered by status', () => {
    createContact(db, { name: 'A', status: 'lead' })
    createContact(db, { name: 'B', status: 'customer' })
    expect(listContacts(db, { status: 'customer' }).map((c) => c.name)).toEqual(['B'])
  })
})

describe('deals CRUD', () => {
  it('creates and reads a deal', () => {
    const org = createOrganization(db, { name: 'Acme Corp' })
    const deal = createDeal(db, { name: 'Big deal', stage: 'New', value: 50000, organization_id: org.id })
    expect(getDeal(db, deal.id)).toMatchObject({ name: 'Big deal', stage: 'New', value: 50000 })
  })

  it('updates a deal', () => {
    const deal = createDeal(db, { name: 'Big deal', stage: 'New', value: 50000 })
    updateDeal(db, deal.id, { name: 'Bigger deal', stage: 'Proposal', value: 75000, close_date: '2026-09-01' })
    expect(getDeal(db, deal.id)).toMatchObject({ name: 'Bigger deal', stage: 'Proposal', value: 75000 })
  })

  it('deletes a deal', () => {
    const deal = createDeal(db, { name: 'Big deal', stage: 'New', value: 50000 })
    deleteDeal(db, deal.id)
    expect(getDeal(db, deal.id)).toBeUndefined()
  })

  it('lists deals by stage', () => {
    createDeal(db, { name: 'A', stage: 'New', value: 1 })
    createDeal(db, { name: 'B', stage: 'Won', value: 2 })
    expect(listDeals(db, { stage: 'Won' }).map((d) => d.name)).toEqual(['B'])
  })
})

describe('activities CRUD', () => {
  it('creates and reads an activity', () => {
    const contact = createContact(db, { name: 'Jane Doe', status: 'lead' })
    const activity = createActivity(db, { type: 'call', contact_id: contact.id, description: 'Intro call' })
    expect(getActivity(db, activity.id)).toMatchObject({
      type: 'call',
      contact_id: contact.id,
      description: 'Intro call',
      done: 0,
    })
    expect(activity.occurred_at).toBeTruthy()
  })

  it('updates an activity', () => {
    const activity = createActivity(db, { type: 'note', description: 'Draft' })
    updateActivity(db, activity.id, { description: 'Final', due_date: '2026-08-01' })
    expect(getActivity(db, activity.id)).toMatchObject({ description: 'Final', due_date: '2026-08-01' })
  })

  it('deletes an activity', () => {
    const activity = createActivity(db, { type: 'note', description: 'Temp' })
    deleteActivity(db, activity.id)
    expect(getActivity(db, activity.id)).toBeUndefined()
  })

  it('lists activities newest first', () => {
    createActivity(db, { type: 'note', description: 'Old', occurred_at: '2026-01-01 10:00:00' })
    createActivity(db, { type: 'note', description: 'New', occurred_at: '2026-06-01 10:00:00' })
    expect(listActivities(db).map((a) => a.description)).toEqual(['New', 'Old'])
  })
})
