/** People and the connections between them. */
import { Router } from "express";
import type { Repo } from "../db/index.js";
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

export function peopleRouter(repo: Repo): Router {
  const router = Router();

  router.get("/people", (req, res) => {
    const { search, circle, tag } = req.query;
    res.json(
      filterPeople(repo.listPeople(), {
        query: typeof search === "string" ? search : undefined,
        circle: isOneOf(CIRCLES, circle) ? circle : undefined,
        tag: typeof tag === "string" ? tag : undefined,
      }),
    );
  });

  router.get("/people/:id", (req, res) => {
    const p = repo.getPerson(Number(req.params.id));
    if (!p) return notFound(res);
    res.json({
      person: p,
      interactions: repo.listInteractions(p.id),
      dates: repo.listDates(p.id),
      facts: repo.listFacts(p.id),
      news: repo.listNews(p.id),
      reminders: repo.listReminders(p.id),
      gifts: repo.listGifts(p.id),
      connections: repo.listConnections(p.id),
    });
  });

  router.post("/people", (req, res) => {
    const input = body(req);
    if (!isText(input.name)) return badRequest(res, "Name is required");
    res.status(201).json(
      repo.createPerson({
        ...(input as Partial<PersonInput>),
        name: input.name.trim(),
      }),
    );
  });

  router.patch("/people/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    // id and created_at belong to the record, not to the edit: drop them rather than trust them.
    const patch = body(req);
    delete patch.id;
    delete patch.created_at;
    res.json(repo.updatePerson(id, patch));
  });

  router.delete("/people/:id", (req, res) => {
    if (!repo.deletePerson(Number(req.params.id))) return notFound(res);
    res.json({ ok: true });
  });

  router.post("/people/:id/connections", (req, res) => {
    const a = Number(req.params.id);
    if (!repo.getPerson(a)) return notFound(res);
    const input = body(req);
    const b = Number(input.other_id);
    if (!b || !repo.getPerson(b) || a === b)
      return badRequest(res, "A valid other person is required");
    if (!isOneOf(CONNECTION_KINDS, input.kind))
      return badRequest(res, "Invalid connection kind");
    res.status(201).json(
      repo.createConnection(a, b, {
        kind: input.kind,
        a_is_parent: input.a_is_parent === true,
        label: optionalText(input.label),
        inverse_label: optionalText(input.inverse_label),
        note: optionalText(input.note),
      }),
    );
  });

  router.delete("/connections/:id", (req, res) => {
    res.json({ ok: repo.deleteConnection(Number(req.params.id)) });
  });

  return router;
}
