/** CRM API: organizations, contacts, deals and activities. Mounted at /api/crm. */
import { Router } from "express";
import * as db from "./db.js";
import { tenantIdOf } from "../tenant.js";
import { requestDb } from "../db/rls.js";

const num = (v: unknown) => (v === undefined ? undefined : Number(v));

export function crmRouter(): Router {
  const router = Router();
  const tenant = tenantIdOf;

  // Organizations
  router.get("/organizations", async (req, res) => {
    res.json(
      await db.listOrganizations(
        requestDb(res),
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
          requestDb(res),
          tenant(res),
          req.body as db.OrganizationInput,
        ),
      );
  });
  router.get("/organizations/:id", async (req, res) => {
    const org = await db.getOrganization(
      requestDb(res),
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
        requestDb(res),
        tenant(res),
        Number(req.params.id),
        req.body as db.OrganizationInput,
      ),
    );
  });
  router.delete("/organizations/:id", async (req, res) => {
    await db.deleteOrganization(
      requestDb(res),
      tenant(res),
      Number(req.params.id),
    );
    res.status(204).send();
  });

  // Contacts
  router.get("/contacts", async (req, res) => {
    res.json(
      await db.listContacts(requestDb(res), tenant(res), {
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
        await db.createContact(
          requestDb(res),
          tenant(res),
          req.body as db.ContactInput,
        ),
      );
  });
  router.get("/contacts/:id", async (req, res) => {
    const contact = await db.getContact(
      requestDb(res),
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
        requestDb(res),
        tenant(res),
        Number(req.params.id),
        req.body as db.ContactInput,
      ),
    );
  });
  router.delete("/contacts/:id", async (req, res) => {
    await db.deleteContact(requestDb(res), tenant(res), Number(req.params.id));
    res.status(204).send();
  });

  // Deals
  router.get("/deals", async (req, res) => {
    res.json(
      await db.listDeals(requestDb(res), tenant(res), {
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
      .json(
        await db.createDeal(
          requestDb(res),
          tenant(res),
          req.body as db.DealInput,
        ),
      );
  });
  router.get("/deals/:id", async (req, res) => {
    const deal = await db.getDeal(
      requestDb(res),
      tenant(res),
      Number(req.params.id),
    );
    if (!deal) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(deal);
  });
  router.put("/deals/:id", async (req, res) => {
    res.json(
      await db.updateDeal(
        requestDb(res),
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
      await db.moveDeal(
        requestDb(res),
        tenant(res),
        Number(req.params.id),
        stage,
        index,
      ),
    );
  });
  router.delete("/deals/:id", async (req, res) => {
    await db.deleteDeal(requestDb(res), tenant(res), Number(req.params.id));
    res.status(204).send();
  });

  // Activities
  router.get("/activities", async (req, res) => {
    res.json(
      await db.listActivities(requestDb(res), tenant(res), {
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
          requestDb(res),
          tenant(res),
          req.body as db.ActivityInput,
        ),
      );
  });
  router.patch("/activities/:id", async (req, res) => {
    res.json(
      await db.updateActivity(
        requestDb(res),
        tenant(res),
        Number(req.params.id),
        req.body as Partial<db.ActivityInput>,
      ),
    );
  });
  router.delete("/activities/:id", async (req, res) => {
    await db.deleteActivity(requestDb(res), tenant(res), Number(req.params.id));
    res.status(204).send();
  });

  return router;
}
