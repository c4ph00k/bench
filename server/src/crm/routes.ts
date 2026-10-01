/** CRM API: organizations, contacts, deals and activities. Mounted at /api/crm. */
import { Router } from "express";
import type { Pool } from "pg";
import * as db from "./db.js";
import { tenantIdOf } from "../tenant.js";

const num = (v: unknown) => (v === undefined ? undefined : Number(v));

export function crmRouter(pool: Pool): Router {
  const router = Router();
  const tenant = tenantIdOf;

  // Organizations
  router.get("/organizations", async (req, res) => {
    res.json(
      await db.listOrganizations(
        pool,
        tenant(res),
        req.query.q as string | undefined,
      ),
    );
  });
  router.post("/organizations", async (req, res) => {
    res
      .status(201)
      .json(
        await db.createOrganization(
          pool,
          tenant(res),
          req.body as db.OrganizationInput,
        ),
      );
  });
  router.get("/organizations/:id", async (req, res) => {
    const org = await db.getOrganization(
      pool,
      tenant(res),
      Number(req.params.id),
    );
    if (!org) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(org);
  });
  router.put("/organizations/:id", async (req, res) => {
    res.json(
      await db.updateOrganization(
        pool,
        tenant(res),
        Number(req.params.id),
        req.body as db.OrganizationInput,
      ),
    );
  });
  router.delete("/organizations/:id", async (req, res) => {
    await db.deleteOrganization(pool, tenant(res), Number(req.params.id));
    res.status(204).end();
  });

  // Contacts
  router.get("/contacts", async (req, res) => {
    res.json(
      await db.listContacts(pool, tenant(res), {
        q: req.query.q as string | undefined,
        status: req.query.status as string | undefined,
        organization_id: num(req.query.organization_id),
      }),
    );
  });
  router.post("/contacts", async (req, res) => {
    res
      .status(201)
      .json(
        await db.createContact(pool, tenant(res), req.body as db.ContactInput),
      );
  });
  router.get("/contacts/:id", async (req, res) => {
    const contact = await db.getContact(
      pool,
      tenant(res),
      Number(req.params.id),
    );
    if (!contact) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(contact);
  });
  router.put("/contacts/:id", async (req, res) => {
    res.json(
      await db.updateContact(
        pool,
        tenant(res),
        Number(req.params.id),
        req.body as db.ContactInput,
      ),
    );
  });
  router.delete("/contacts/:id", async (req, res) => {
    await db.deleteContact(pool, tenant(res), Number(req.params.id));
    res.status(204).end();
  });

  // Deals
  router.get("/deals", async (req, res) => {
    res.json(
      await db.listDeals(pool, tenant(res), {
        q: req.query.q as string | undefined,
        stage: req.query.stage as string | undefined,
        organization_id: num(req.query.organization_id),
        contact_id: num(req.query.contact_id),
      }),
    );
  });
  router.post("/deals", async (req, res) => {
    res
      .status(201)
      .json(await db.createDeal(pool, tenant(res), req.body as db.DealInput));
  });
  router.get("/deals/:id", async (req, res) => {
    const deal = await db.getDeal(pool, tenant(res), Number(req.params.id));
    if (!deal) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(deal);
  });
  router.put("/deals/:id", async (req, res) => {
    res.json(
      await db.updateDeal(
        pool,
        tenant(res),
        Number(req.params.id),
        req.body as db.DealInput,
      ),
    );
  });
  // The board sends where the card was dropped; without an index the deal joins the end of its column.
  router.patch("/deals/:id/stage", async (req, res) => {
    const { stage, index } = req.body as {
      stage: db.DealStage;
      index?: number;
    };
    res.json(
      await db.moveDeal(pool, tenant(res), Number(req.params.id), stage, index),
    );
  });
  router.delete("/deals/:id", async (req, res) => {
    await db.deleteDeal(pool, tenant(res), Number(req.params.id));
    res.status(204).end();
  });

  // Activities
  router.get("/activities", async (req, res) => {
    res.json(
      await db.listActivities(pool, tenant(res), {
        contact_id: num(req.query.contact_id),
        deal_id: num(req.query.deal_id),
        limit: num(req.query.limit),
      }),
    );
  });
  router.post("/activities", async (req, res) => {
    res
      .status(201)
      .json(
        await db.createActivity(
          pool,
          tenant(res),
          req.body as db.ActivityInput,
        ),
      );
  });
  router.patch("/activities/:id", async (req, res) => {
    res.json(
      await db.updateActivity(
        pool,
        tenant(res),
        Number(req.params.id),
        req.body as Partial<db.ActivityInput>,
      ),
    );
  });
  router.delete("/activities/:id", async (req, res) => {
    await db.deleteActivity(pool, tenant(res), Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
