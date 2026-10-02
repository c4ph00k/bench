/** Bringing people in from a CSV or vCard file: parse, remap the columns, then apply. */
import { Router } from "express";
import { createRepo, type Repo } from "../db/index.js";
import { requestDb } from "../../db/rls.js";
import { tenantIdOf } from "../../tenant.js";
import {
  applyMapping,
  checkDuplicates,
  parseCSV,
  parseVCard,
  type DuplicateCheck,
  type ParsedPerson,
} from "../import.js";
import { badRequest, body, isText } from "./validate.js";

type Existing = { id: number; name: string; email: string | null }[];

const listExisting = async (repo: Repo): Promise<Existing> =>
  (await repo.listPeople()).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
  }));

const withDuplicates = (people: ParsedPerson[], existing: Existing) =>
  people.map((person, index) => ({
    index,
    person,
    duplicate: checkDuplicates(person, existing),
  }));

export function importRouter(): Router {
  const router = Router();

  router.post("/parse", async (req, res) => {
    const repo = createRepo(requestDb(res), tenantIdOf(res));
    const { filename, content } = body(req);
    if (!isText(content)) return badRequest(res, "A file is required");
    const existing = await listExisting(repo);

    const name = typeof filename === "string" ? filename : "";
    if (/\.vcf$/i.test(name) || /^BEGIN:VCARD/im.test(content.trim())) {
      return res.json({
        format: "vcf",
        rows: withDuplicates(parseVCard(content), existing),
      });
    }

    const parsed = parseCSV(content);
    const { people, skipped } = applyMapping(
      parsed,
      parsed.suggestedMapping ?? {},
    );
    res.json({
      format: "csv",
      headers: parsed.headers,
      raw_rows: parsed.rows,
      suggested_mapping: parsed.suggestedMapping,
      rows: withDuplicates(people, existing),
      skipped,
    });
  });

  /** Re-run a CSV through a mapping the user corrected by hand. */
  router.post("/remap", async (req, res) => {
    const repo = createRepo(requestDb(res), tenantIdOf(res));
    const { headers, raw_rows, mapping } = body(req);
    if (
      !Array.isArray(headers) ||
      !Array.isArray(raw_rows) ||
      typeof mapping !== "object" ||
      mapping === null
    ) {
      return badRequest(res, "Invalid remap request");
    }
    const { people } = applyMapping(
      {
        format: "csv",
        headers: headers as string[],
        rows: raw_rows as Record<string, string>[],
        people: [],
        suggestedMapping: null,
      },
      mapping as Record<string, string>,
    );
    res.json({ rows: withDuplicates(people, await listExisting(repo)) });
  });

  router.post("/apply", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const db = requestDb(res);
    const { people } = body(req);
    if (!Array.isArray(people) || people.length === 0)
      return badRequest(res, "No people to import");

    const existing = await listExisting(createRepo(db, tenantId));
    const created: { id: number; name: string }[] = [];
    const skipped: DuplicateCheck[] = [];

    // A savepoint inside the request's transaction: a half-imported address book is worse than a
    // failed import, and this rolls back only the import, not the whole request.
    await db.query("SAVEPOINT import_apply");
    try {
      const repo = createRepo(db, tenantId);
      for (const p of people as ParsedPerson[]) {
        const duplicate = checkDuplicates(p, existing);
        if (duplicate.isDuplicate) {
          skipped.push(duplicate);
          continue;
        }
        const person = await repo.createPerson({
          name: p.name,
          email: p.email,
          phone: p.phone,
          job_title: p.job_title,
          company: p.company,
          city: p.city,
          notes: p.notes,
          tags: ["imported"],
        });
        created.push({ id: person.id, name: person.name });
        existing.push({
          id: person.id,
          name: person.name,
          email: person.email,
        });
        await addBirthday(repo, person.id, p.birthday);
      }
      await db.query("RELEASE SAVEPOINT import_apply");
    } catch (error) {
      await db.query("ROLLBACK TO SAVEPOINT import_apply");
      throw error;
    }
    res.status(201).json({ created, skipped: skipped.length });
  });

  return router;
}

/** vCard dates come as 1993-04-11 or as --04-11 when the year is unknown. */
async function addBirthday(
  repo: Repo,
  personId: number,
  birthday: string | null,
) {
  if (!birthday) return;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (full) {
    await repo.createDate(personId, "birthday", null, {
      month: Number(full[2]),
      day: Number(full[3]),
      year: Number(full[1]),
    });
    return;
  }
  const noYear = /^--(\d{2})-(\d{2})$/.exec(birthday);
  if (noYear)
    await repo.createDate(personId, "birthday", null, {
      month: Number(noYear[1]),
      day: Number(noYear[2]),
      year: null,
    });
}
