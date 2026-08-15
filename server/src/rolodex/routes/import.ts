/** Bringing people in from a CSV or vCard file: parse, remap the columns, then apply. */
import { Router } from "express";
import type { Repo } from "../db/index.js";
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

const listExisting = (repo: Repo): Existing =>
  repo.listPeople().map((p) => ({ id: p.id, name: p.name, email: p.email }));

const withDuplicates = (people: ParsedPerson[], existing: Existing) =>
  people.map((person, index) => ({
    index,
    person,
    duplicate: checkDuplicates(person, existing),
  }));

export function importRouter(repo: Repo): Router {
  const router = Router();

  router.post("/parse", (req, res) => {
    const { filename, content } = body(req);
    if (!isText(content)) return badRequest(res, "A file is required");
    const existing = listExisting(repo);

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
  router.post("/remap", (req, res) => {
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
    res.json({ rows: withDuplicates(people, listExisting(repo)) });
  });

  router.post("/apply", (req, res) => {
    const { people } = body(req);
    if (!Array.isArray(people) || people.length === 0)
      return badRequest(res, "No people to import");

    const existing = listExisting(repo);
    const created: { id: number; name: string }[] = [];
    const skipped: DuplicateCheck[] = [];
    // One transaction: a half-imported address book is worse than a failed import.
    repo.db.transaction(() => {
      for (const p of people as ParsedPerson[]) {
        const duplicate = checkDuplicates(p, existing);
        if (duplicate.isDuplicate) {
          skipped.push(duplicate);
          continue;
        }
        const person = repo.createPerson({
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
        addBirthday(repo, person.id, p.birthday);
      }
    })();
    res.status(201).json({ created, skipped: skipped.length });
  });

  return router;
}

/** vCard dates come as 1993-04-11 or as --04-11 when the year is unknown. */
function addBirthday(repo: Repo, personId: number, birthday: string | null) {
  if (!birthday) return;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (full) {
    repo.createDate(personId, "birthday", null, {
      month: Number(full[2]),
      day: Number(full[3]),
      year: Number(full[1]),
    });
    return;
  }
  const noYear = /^--(\d{2})-(\d{2})$/.exec(birthday);
  if (noYear)
    repo.createDate(personId, "birthday", null, {
      month: Number(noYear[1]),
      day: Number(noYear[2]),
      year: null,
    });
}
