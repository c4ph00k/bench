/** CRM API: organizations, contacts, deals and activities. Mounted at /api/crm. */
import { Router } from "express";
import * as db from "./db.js";

const num = (v: unknown) => (v === undefined ? undefined : Number(v));

export function crmRouter(conn: db.DB): Router {
  const router = Router();

  // Organizations
  router.get("/organizations", (req, res) =>
    res.json(db.listOrganizations(conn, req.query.q as string | undefined)),
  );
  router.post("/organizations", (req, res) =>
    res
      .status(201)
      .json(db.createOrganization(conn, req.body as db.OrganizationInput)),
  );
  router.get("/organizations/:id", (req, res) => {
    const org = db.getOrganization(conn, Number(req.params.id));
    if (!org) return res.status(404).json({ error: "Not found" });
    res.json(org);
  });
  router.put("/organizations/:id", (req, res) =>
    res.json(
      db.updateOrganization(
        conn,
        Number(req.params.id),
        req.body as db.OrganizationInput,
      ),
    ),
  );
  router.delete("/organizations/:id", (req, res) => {
    db.deleteOrganization(conn, Number(req.params.id));
    res.status(204).end();
  });

  // Contacts
  router.get("/contacts", (req, res) =>
    res.json(
      db.listContacts(conn, {
        q: req.query.q as string | undefined,
        status: req.query.status as string | undefined,
        organization_id: num(req.query.organization_id),
      }),
    ),
  );
  router.post("/contacts", (req, res) =>
    res.status(201).json(db.createContact(conn, req.body as db.ContactInput)),
  );
  router.get("/contacts/:id", (req, res) => {
    const contact = db.getContact(conn, Number(req.params.id));
    if (!contact) return res.status(404).json({ error: "Not found" });
    res.json(contact);
  });
  router.put("/contacts/:id", (req, res) =>
    res.json(
      db.updateContact(
        conn,
        Number(req.params.id),
        req.body as db.ContactInput,
      ),
    ),
  );
  router.delete("/contacts/:id", (req, res) => {
    db.deleteContact(conn, Number(req.params.id));
    res.status(204).end();
  });

  // Deals
  router.get("/deals", (req, res) =>
    res.json(
      db.listDeals(conn, {
        q: req.query.q as string | undefined,
        stage: req.query.stage as string | undefined,
        organization_id: num(req.query.organization_id),
        contact_id: num(req.query.contact_id),
      }),
    ),
  );
  router.post("/deals", (req, res) =>
    res.status(201).json(db.createDeal(conn, req.body as db.DealInput)),
  );
  router.get("/deals/:id", (req, res) => {
    const deal = db.getDeal(conn, Number(req.params.id));
    if (!deal) return res.status(404).json({ error: "Not found" });
    res.json(deal);
  });
  router.put("/deals/:id", (req, res) =>
    res.json(
      db.updateDeal(conn, Number(req.params.id), req.body as db.DealInput),
    ),
  );
  // The board sends where the card was dropped; without an index the deal joins the end of its column.
  router.patch("/deals/:id/stage", (req, res) => {
    const { stage, index } = req.body as {
      stage: db.DealStage;
      index?: number;
    };
    res.json(db.moveDeal(conn, Number(req.params.id), stage, index));
  });
  router.delete("/deals/:id", (req, res) => {
    db.deleteDeal(conn, Number(req.params.id));
    res.status(204).end();
  });

  // Activities
  router.get("/activities", (req, res) =>
    res.json(
      db.listActivities(conn, {
        contact_id: num(req.query.contact_id),
        deal_id: num(req.query.deal_id),
        limit: num(req.query.limit),
      }),
    ),
  );
  router.post("/activities", (req, res) =>
    res.status(201).json(db.createActivity(conn, req.body as db.ActivityInput)),
  );
  router.patch("/activities/:id", (req, res) =>
    res.json(
      db.updateActivity(
        conn,
        Number(req.params.id),
        req.body as Partial<db.ActivityInput>,
      ),
    ),
  );
  router.delete("/activities/:id", (req, res) => {
    db.deleteActivity(conn, Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
