/** Everything recorded against a person: interactions, dates, facts, news, reminders and gifts. */
import { Router } from "express";
import type { Repo } from "../db/index.js";
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

export function logRouter(repo: Repo): Router {
  const router = Router();

  router.post("/people/:id/interactions", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { type, date, notes } = body(req);
    if (!isOneOf(INTERACTION_TYPES, type))
      return badRequest(res, "Invalid interaction type");
    if (!isISODate(date))
      return badRequest(res, "A valid date (yyyy-mm-dd) is required");
    res
      .status(201)
      .json(repo.createInteraction(id, type, date, optionalText(notes)));
  });

  router.delete("/interactions/:id", (req, res) => {
    res.json({ ok: repo.deleteInteraction(Number(req.params.id)) });
  });

  router.post("/people/:id/dates", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { type, label, month, day, year } = body(req);
    if (!isOneOf(DATE_TYPES, type)) return badRequest(res, "Invalid date type");
    if (!inRange(month, 1, 12) || !inRange(day, 1, 31))
      return badRequest(res, "Invalid month/day");
    if (year != null && !Number.isInteger(year))
      return badRequest(res, "Invalid year");
    // createDate rejects an impossible day for the month, such as 31 February.
    try {
      res.status(201).json(
        repo.createDate(id, type, optionalText(label), {
          month,
          day,
          year: typeof year === "number" ? year : null,
        }),
      );
    } catch (e) {
      badRequest(res, (e as Error).message);
    }
  });

  router.delete("/dates/:id", (req, res) => {
    res.json({ ok: repo.deleteDate(Number(req.params.id)) });
  });

  router.post("/people/:id/facts", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { text } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    res.status(201).json(repo.createFact(id, text.trim()));
  });

  router.delete("/facts/:id", (req, res) => {
    res.json({ ok: repo.deleteFact(Number(req.params.id)) });
  });

  router.post("/people/:id/news", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { text, date } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    res
      .status(201)
      .json(
        repo.createNews(id, text.trim(), isISODate(date) ? date : todayISO()),
      );
  });

  router.delete("/news/:id", (req, res) => {
    res.json({ ok: repo.deleteNews(Number(req.params.id)) });
  });

  router.post("/people/:id/reminders", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { text, due_date } = body(req);
    if (!isText(text)) return badRequest(res, "Text is required");
    if (!isISODate(due_date))
      return badRequest(res, "A valid due date (yyyy-mm-dd) is required");
    res.status(201).json(repo.createReminder(id, text.trim(), due_date));
  });

  router.patch("/reminders/:id", (req, res) => {
    const updated = repo.setReminderDone(
      Number(req.params.id),
      body(req).done === true,
    );
    if (!updated) return notFound(res);
    res.json(updated);
  });

  router.delete("/reminders/:id", (req, res) => {
    res.json({ ok: repo.deleteReminder(Number(req.params.id)) });
  });

  router.post("/people/:id/gifts", (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getPerson(id)) return notFound(res);
    const { name, kind, occasion, date } = body(req);
    if (!isText(name)) return badRequest(res, "Name is required");
    if (!isOneOf(GIFT_KINDS, kind)) return badRequest(res, "Invalid gift kind");
    res
      .status(201)
      .json(
        repo.createGift(
          id,
          name.trim(),
          kind,
          optionalText(occasion),
          isISODate(date) ? date : todayISO(),
        ),
      );
  });

  router.patch("/gifts/:id", (req, res) => {
    const { kind, occasion, date } = body(req);
    const updated = repo.updateGift(Number(req.params.id), {
      ...(isOneOf(GIFT_KINDS, kind) && { kind }),
      ...(occasion !== undefined && { occasion: optionalText(occasion) }),
      ...(isISODate(date) && { date }),
    });
    if (!updated) return notFound(res);
    res.json(updated);
  });

  router.delete("/gifts/:id", (req, res) => {
    res.json({ ok: repo.deleteGift(Number(req.params.id)) });
  });

  return router;
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
