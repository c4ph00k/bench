/** The read-only views: today, the calendar, the timeline and the charts behind them. */
import { Router, type Response } from "express";
import { format } from "date-fns";
import { createRepo, type Repo } from "../db/index.js";
import { requestDb } from "../../db/rls.js";
import { tenantIdOf } from "../../tenant.js";
import { CIRCLE_META } from "../cadence.js";
import { daysBetweenISO, todayISO } from "../dates.js";
import { datesInMonth, upcomingDates } from "../importantDates.js";
import type { Circle, PersonComputed } from "../types.js";

/** Dates further out than this are next month's problem. */
const UPCOMING_WINDOW_DAYS = 30;

/** How overdue a check-in is, in days. Never contacted sorts above everyone. */
function overdueRank(p: PersonComputed, today: string): number {
  if (p.last_contacted == null) return Number.MAX_SAFE_INTEGER;
  return p.next_due ? -daysBetweenISO(today, p.next_due) : 0;
}

export function dashboardRouter(): Router {
  const router = Router();
  const repoOf = (res: Response) => createRepo(requestDb(res), tenantIdOf(res));

  router.get("/today", async (req, res) => {
    const repo = repoOf(res);
    const today = todayISO();
    const toContact = (await repo.listPeople())
      .filter((p) => p.status === "overdue" || p.status === "due_soon")
      .sort(
        (a, b) =>
          overdueRank(b, today) - overdueRank(a, today) ||
          a.name.localeCompare(b.name),
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        circle: p.circle,
        photo: p.photo,
        status: p.status,
        last_contacted: p.last_contacted,
        next_due: p.next_due,
        latest_news: p.latest_news,
        overdue_days:
          p.status === "overdue" && p.next_due
            ? Math.max(0, -daysBetweenISO(today, p.next_due))
            : 0,
      }));
    res.json({
      today,
      to_contact: toContact,
      upcoming_dates: upcomingDates(
        await repo.listAllDates(),
        UPCOMING_WINDOW_DAYS,
      ),
      reminders: (await repo.listOpenReminders()).map((r) => ({
        ...r,
        overdue: r.due_date < today,
        due_today: r.due_date === today,
      })),
      recent: (await repo.timeline(null, null)).slice(0, 30),
    });
  });

  router.get("/calendar", async (req, res) => {
    const repo = repoOf(res);
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const all = await repo.listAllDates();
    res.json({
      year,
      month,
      events: datesInMonth(all, year, month),
      upcoming: upcomingDates(all, UPCOMING_WINDOW_DAYS),
    });
  });

  router.get("/timeline", async (req, res) => {
    const repo = repoOf(res);
    const { person, kind } = req.query;
    res.json(
      await repo.timeline(
        person ? Number(person) : null,
        typeof kind === "string" && kind !== "all" ? kind : null,
      ),
    );
  });

  router.get("/stats", async (req, res) => {
    const repo = repoOf(res);
    res.json({
      months: await interactionsByMonth(repo),
      circles: await byCircle(repo),
    });
  });

  router.get("/tags", async (req, res) => {
    const repo = repoOf(res);
    res.json(await repo.allTags());
  });

  return router;
}

/** Interactions per month for the last year, including the months with none. */
async function interactionsByMonth(repo: Repo) {
  const dates = await repo.interactionDates();
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = date.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = format(d, "yyyy-MM");
    return { key, label: format(d, "MMM yy"), count: counts.get(key) ?? 0 };
  });
}

async function byCircle(repo: Repo) {
  const people = await repo.listPeople();
  return (Object.keys(CIRCLE_META) as Circle[]).map((circle) => {
    const inCircle = people.filter((p) => p.circle === circle);
    const count = (status: PersonComputed["status"]) =>
      inCircle.filter((p) => p.status === status).length;
    return {
      circle,
      label: CIRCLE_META[circle].label,
      total: inCircle.length,
      in_touch: count("in_touch"),
      due_soon: count("due_soon"),
      overdue: count("overdue"),
      snoozed: count("snoozed"),
      off: count("off"),
    };
  });
}
