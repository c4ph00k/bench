/** Everything recorded against a person: interactions, dates, facts, news, reminders and gifts. */
import { Router, type Response } from "express";
import type { Pool } from "pg";
import { createRepo } from "../db/index.js";
import { tenantIdOf } from "../../tenant.js";
import { todayISO } from "../dates.js";
import type { GiftKind } from "../types.js";
import { DATE_TYPES, INTERACTION_TYPES } from "../types.js";
import {
  badRequest,
  body,
  isISODate,
  isOneOf,
  isText,
  notFound,
  optionalText,
} from "./validate.js";

const GIFT_KINDS: GiftKind[] = ["idea", "given", "received"];

export function logRouter(pool: Pool): Router {
  const router = Router();
  const repoOf = (res: Response) => createRepo(pool, tenantIdOf(res));

  router.post("/people/:id/interactions", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { type, date, notes } = body(req);
    if (!isOneOf(INTERACTION_TYPES, type))
      return badRequest(res, "Invalid interaction type");
    if (!isISODate(date))
      return badRequest(res, "A valid date (yyyy-mm-dd) is required");
    res
      .status(201)
      .json(await repo.createInteraction(id, type, date, optionalText(notes)));
  });

  router.delete("/interactions/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteInteraction(Number(req.params.id)) });
  });

  router.post("/people/:id/dates", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { type, label, month, day, year } = body(req);
    if (!isOneOf(DATE_TYPES, type)) return badRequest(res, "Invalid date type");
    if (!inRange(month, 1, 12) || !inRange(day, 1, 31))
      return badRequest(res, "Invalid month/day");
    if (year != null && !Number.isInteger(year))
      return badRequest(res, "Invalid year");
    // createDate rejects an impossible day for the month, such as 31 February.
    try {
      res.status(201).json(
        await repo.createDate(id, type, optionalText(label), {
          month,
          day,
          year: typeof year === "number" ? year : null,
        }),
      );
    } catch (e) {
      badRequest(res, (e as Error).message);
    }
  });

  router.delete("/dates/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteDate(Number(req.params.id)) });
  });

  router.post("/people/:id/facts", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { text } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    res.status(201).json(await repo.createFact(id, text.trim()));
  });

  router.delete("/facts/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteFact(Number(req.params.id)) });
  });

  router.post("/people/:id/news", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { text, date } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    res
      .status(201)
      .json(
        await repo.createNews(
          id,
          text.trim(),
          isISODate(date) ? date : todayISO(),
        ),
      );
  });

  router.delete("/news/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteNews(Number(req.params.id)) });
  });

  router.post("/people/:id/reminders", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { text, due_date } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    if (!isISODate(due_date))
      return badRequest(res, "A valid due date (yyyy-mm-dd) is required");
    res.status(201).json(await repo.createReminder(id, text.trim(), due_date));
  });

  router.patch("/reminders/:id", async (req, res) => {
    const repo = repoOf(res);
    const updated = await repo.setReminderDone(
      Number(req.params.id),
      body(req).done === true,
    );
    if (!updated) return notFound(res);
    res.json(updated);
  });

  router.delete("/reminders/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteReminder(Number(req.params.id)) });
  });

  router.post("/people/:id/gifts", async (req, res) => {
    const repo = repoOf(res);
    const id = Number(req.params.id);
    if (!(await repo.getPerson(id))) return notFound(res);
    const { name, kind, occasion, date } = body(req);
    if (!isText(name)) return badRequest(res, "Name is required");
    if (!isOneOf(GIFT_KINDS, kind)) return badRequest(res, "Invalid gift kind");
    res
      .status(201)
      .json(
        await repo.createGift(
          id,
          name.trim(),
          kind,
          optionalText(occasion),
          isISODate(date) ? date : todayISO(),
        ),
      );
  });

  router.patch("/gifts/:id", async (req, res) => {
    const repo = repoOf(res);
    const { kind, occasion, date } = body(req);
    const updated = await repo.updateGift(Number(req.params.id), {
      ...(isOneOf(GIFT_KINDS, kind) && { kind }),
      ...(occasion !== undefined && { occasion: optionalText(occasion) }),
      ...(isISODate(date) && { date }),
    });
    if (!updated) return notFound(res);
    res.json(updated);
  });

  router.delete("/gifts/:id", async (req, res) => {
    const repo = repoOf(res);
    res.json({ ok: await repo.deleteGift(Number(req.params.id)) });
  });

  return router;
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
