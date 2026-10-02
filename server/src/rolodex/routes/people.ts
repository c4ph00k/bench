/** People and the connections between them. */
import { Router, type Response } from "express";
import type { Pool } from "pg";
import { createRepo } from "../db/index.js";
import { tenantIdOf } from "../../tenant.js";
import { filterPeople } from "../search.js";
import type { ConnectionKind, PersonInput } from "../types.js";
import { CIRCLES } from "../types.js";
import {
  badRequest,
  body,
  isOneOf,
  isText,
  notFound,
  optionalText,
} from "./validate.js";

const CONNECTION_KINDS: ConnectionKind[] = [
  "partner",
  "parent_child",
  "sibling",
  "colleague",
  "other",
];

export function peopleRouter(pool: Pool): Router {
  const router = Router();
  const repoOf = (res: Response) => createRepo(pool, tenantIdOf(res));

  router.get("/people", async (req, res) => {
    const repo = repoOf(res);
    const { search, circle, tag } = req.query;
    res.json(
      filterPeople(await repo.listPeople(), {
        query: typeof search === "string" ? search : undefined,
        circle: isOneOf(CIRCLES, circle) ? circle : undefined,
        tag: typeof tag === "string" ? tag : undefined,
      }),
    );
  });

  router.get("/people/:id", async (req, res) => {
    const repo = repoOf(res);
    const p = await repo.getPerson(Number(req.params.id));
    if (!p) return notFound(res);
    res.json({
      person: p,
      interactions: await repo.listInteractions(p.id),
      dates: await repo.listDates(p.id),
      facts: await repo.listFacts(p.id),
      news: await repo.listNews(p.id),
      reminders: await repo.listReminders(p.id),
      gifts: await repo.listGifts(p.id),
      connections: await repo.listConnections(p.id),
    });
  });

  router.post("/people", async (req, res) => {
    const repo = repoOf(res);
    const input = body(req);
    if (!isText(input.name)) return badRequest(res, "Name is required");
    res.status(201).json(
      await repo.createPerson({
        ...(input as Partial<PersonInput>),
        name: input.name.trim(),
      }),
    );
  });

  router.patch("/people/:id", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    // id and created_at belong to the record, not to the edit: drop them rather than trust them.
    const patch = body(req);
    delete patch.id;
    delete patch.created_at;
    res.json(await repo.updatePerson(id, patch));
  });

  router.delete("/people/:id", async (req, res) => {
    const repo = repoOf(res);
    if (!(await repo.deletePerson(Number(req.params.id)))) return notFound(res);
    res.json({ ok: true });
  });

  router.post("/people/:id/connections", async (req, res) => {
    const repo = repoOf(res);
    const a = Number(req.params.id);
    if (!(await repo.getPerson(a))) return notFound(res);
    const input = body(req);
    const b = Number(input.other_id);
    if (!b || !(await repo.getPerson(b)) || a === b)
      return badRequest(res, "A valid other person is required");
    if (!isOneOf(CONNECTION_KINDS, input.kind))
      return badRequest(res, "Invalid connection kind");
    res.status(201).json(
      await repo.createConnection(a, b, {
        kind: input.kind,
        a_is_parent: input.a_is_parent === true,
        label: optionalText(input.label),
        inverse_label: optionalText(input.inverse_label),
        note: optionalText(input.note),
      }),
    );
  });

  router.delete("/connections/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteConnection(Number(req.params.id)) });
  });

  return router;
}
