import { beforeEach, describe, expect, it } from 'vitest'
import {
  DB,
  openDb,
  createOrganization,
  createContact,
  listOrganizations,
  listContacts,
  createDeal,
  listDeals,
} from '../../src/crm/db.js'

let db: DB

beforeEach(() => {
  db = openDb(':memory:')
  createOrganization(db, { name: 'Northwind Logistics', industry: 'Transportation' })
  createOrganization(db, { name: 'Bluepeak Software', website: 'bluepeak.io', industry: 'Software' })
  createContact(db, { name: 'Maria Delgado', email: 'maria@northwind.com', status: 'customer' })
  createContact(db, { name: 'Jonas Lindqvist', email: 'jonas@bluepeak.io', status: 'qualified' })
  createContact(db, { name: 'Sam Okafor', email: 'sam@quarry.com', status: 'lead' })
  createDeal(db, { name: 'Enterprise upgrade', stage: 'Negotiation', value: 120000 })
  createDeal(db, { name: 'Loyalty program', stage: 'Qualified', value: 38000 })
})

describe('organization search', () => {
  it('matches by name, case-insensitively', () => {
    expect(listOrganizations(db, 'northwind').map((o) => o.name)).toEqual(['Northwind Logistics'])
  })

  it('matches by website and industry', () => {
    expect(listOrganizations(db, 'bluepeak.io')).toHaveLength(1)
    expect(listOrganizations(db, 'Transport')).toHaveLength(1)
  })

  it('returns nothing for a non-match', () => {
    expect(listOrganizations(db, 'zzz')).toHaveLength(0)
  })
})

describe('contact search and filter', () => {
  it('searches by name', () => {
    expect(listContacts(db, { q: 'maria' }).map((c) => c.name)).toEqual(['Maria Delgado'])
  })

  it('searches by email', () => {
    expect(listContacts(db, { q: 'bluepeak.io' }).map((c) => c.name)).toEqual(['Jonas Lindqvist'])
  })

  it('filters by status', () => {
    expect(listContacts(db, { status: 'lead' }).map((c) => c.name)).toEqual(['Sam Okafor'])
  })

  it('combines search and status filter', () => {
    expect(listContacts(db, { q: 'sam', status: 'customer' })).toHaveLength(0)
    expect(listContacts(db, { q: 'sam', status: 'lead' })).toHaveLength(1)
  })
})

describe('deal search', () => {
  it('searches by name', () => {
    expect(listDeals(db, { q: 'upgrade' }).map((d) => d.name)).toEqual(['Enterprise upgrade'])
  })
})
