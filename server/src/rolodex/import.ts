import Papa from "papaparse";
import VCARD from "vcf";

export interface ParsedPerson {
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  city: string | null;
  birthday: string | null; // yyyy-mm-dd or partial
  notes: string | null;
}

type CsvRow = Record<string, string | undefined>;

export interface ImportParseResult {
  format: "csv" | "vcf";
  headers: string[];
  rows: CsvRow[];
  people: ParsedPerson[];
  suggestedMapping: Record<string, string> | null;
}

/** The fields a row can be mapped onto, and the order the preview shows them in. */
const PERSON_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "job_title", label: "Job title" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "birthday", label: "Birthday" },
  { key: "notes", label: "Notes" },
] as const;

const FIELD_KEYS = PERSON_FIELDS.map((f) => f.key) as readonly string[];

const HEADER_SYNONYMS: Record<string, string[]> = {
  name: [
    "name",
    "full name",
    "fullname",
    "fn",
    "display name",
    "given name",
    "first name",
  ],
  email: ["email", "e-mail", "email address", "mail", "emailaddress"],
  phone: [
    "phone",
    "phone number",
    "mobile",
    "cell",
    "tel",
    "telephone",
    "mobile phone",
  ],
  job_title: ["job title", "title", "role", "position", "job"],
  company: [
    "company",
    "organization",
    "organisation",
    "organisation name",
    "org",
    "employer",
    "company name",
  ],
  city: ["city", "town", "location", "home city", "address city"],
  birthday: [
    "birthday",
    "birth date",
    "birthdate",
    "bday",
    "dob",
    "date of birth",
  ],
  notes: ["notes", "note", "comment", "comments", "remarks"],
};

function suggestMappingForHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of FIELD_KEYS) {
    const synonyms = HEADER_SYNONYMS[field] ?? [field];
    const match = headers.find((h) => {
      const norm = h.trim().toLowerCase();
      return synonyms.some((s) => norm === s) || norm.includes(field);
    });
    if (match) mapping[match] = field;
  }
  return mapping;
}

export function parseCSV(text: string): ImportParseResult {
  // A ragged row has fewer cells than headers, so a cell can be missing entirely.
  const parsed = Papa.parse<CsvRow>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => (v ?? "").trim() !== ""),
  );
  return {
    format: "csv",
    headers,
    rows,
    people: [],
    suggestedMapping: suggestMappingForHeaders(headers),
  };
}

export function applyMapping(
  parsed: ImportParseResult,
  mapping: Record<string, string>,
): { people: ParsedPerson[]; skipped: number } {
  const people: ParsedPerson[] = [];
  let skipped = 0;
  for (const row of parsed.rows) {
    const mapped: Record<string, string | null> = {};
    for (const [header, field] of Object.entries(mapping)) {
      mapped[field] = (row[header] ?? "").trim() || null;
    }
    mapped.name ??= nameFromParts(row);
    if (!mapped.name) {
      skipped++;
      continue;
    }
    people.push({
      name: mapped.name,
      email: mapped.email ?? null,
      phone: mapped.phone ?? null,
      job_title: mapped.job_title ?? null,
      company: mapped.company ?? null,
      city: mapped.city ?? null,
      birthday: normalizeBirthday(mapped.birthday),
      notes: mapped.notes ?? null,
    });
  }
  return { people, skipped };
}

/** Exports that split the name across columns instead of carrying a full name. */
function nameFromParts(row: CsvRow): string | null {
  const first = (row["First Name"] ?? row["first name"] ?? "").trim();
  const last = (row["Last Name"] ?? row["last name"] ?? "").trim();
  return [first, last].filter(Boolean).join(" ") || null;
}

function normalizeBirthday(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO: yyyy-mm-dd (possibly with time)
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or mm/dd/yyyy — disambiguate: first number > 12 means day-first
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12)
      return `${m[3]}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    return `${m[3]}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }
  // yyyy (year only) or --mm-dd (vCard style)
  m = /^(\d{4})$/.exec(s);
  if (m) return s;
  m = /^--(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  return null;
}

/** ORG = Company;Department. Only the company is worth keeping here. */
function company(org: string | null): string | null {
  return org?.split(";")[0].trim() || null;
}

/**
 * One property's value, or null when the card does not carry it. `get` returns a single property
 * or an array of them, and a property built from jCard input hands back the whole
 * [field, params, type, value] tuple from valueOf() rather than just the value.
 */
function propValue(card: VCARD, propName: string): string | null {
  const got: VCARD.Property | VCARD.Property[] | undefined = card.get(propName);
  const entry = Array.isArray(got) ? got.at(0) : got;
  if (!entry) return null;
  const value: unknown = entry.valueOf();
  if (Array.isArray(value))
    return typeof value[3] === "string" ? value[3].trim() || null : null;
  return typeof value === "string" ? value.trim() || null : null;
}

export function parseVCard(text: string): ParsedPerson[] {
  // The parser wants CRLF line endings and only understands vCard 2.1/3.0;
  // the fields we read are the same in 4.0, so normalise before parsing.
  const normalized = text
    .replace(/\r?\n/g, "\r\n")
    .replace(/^VERSION:4(\.0)?$/gim, "VERSION:3.0");
  let cards: VCARD[];
  try {
    cards = VCARD.parse(normalized.trim());
  } catch {
    // A file the parser cannot read at all imports nobody, rather than failing the request.
    return [];
  }
  const people: ParsedPerson[] = [];
  for (const card of cards) {
    const name = propValue(card, "fn") ?? fullName(propValue(card, "n"));
    if (!name) continue;
    people.push({
      name,
      email: propValue(card, "email"),
      phone: propValue(card, "tel"),
      job_title: propValue(card, "title"),
      company: company(propValue(card, "org")),
      city: city(propValue(card, "adr")),
      birthday: normalizeBirthday(propValue(card, "bday")),
      notes: propValue(card, "note"),
    });
  }
  return people;
}

/** N = Family;Given;Middle;Prefix;Suffix, read back in the order people say it. */
function fullName(n: string | null): string | null {
  if (!n) return null;
  const parts = n.split(";");
  return (
    [parts[1], parts[2], parts[0]].filter(Boolean).join(" ").trim() || null
  );
}

/** ADR = POBox;Ext;Street;Locality;Region;PostalCode;Country. Locality is the city. */
function city(adr: string | null): string | null {
  return adr?.split(";")[3]?.trim() || null;
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  duplicateOfId: number | null;
  duplicateOfName: string | null;
  reason: "email" | "name" | null;
}

export function checkDuplicates(
  candidate: ParsedPerson,
  existing: { id: number; name: string; email: string | null }[],
): DuplicateCheck {
  if (candidate.email) {
    const email = candidate.email.toLowerCase();
    const hit = existing.find((p) => p.email?.toLowerCase() === email);
    if (hit)
      return {
        isDuplicate: true,
        duplicateOfId: hit.id,
        duplicateOfName: hit.name,
        reason: "email",
      };
  }
  const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const name = normName(candidate.name);
  const hit = existing.find((p) => normName(p.name) === name);
  if (hit)
    return {
      isDuplicate: true,
      duplicateOfId: hit.id,
      duplicateOfName: hit.name,
      reason: "name",
    };
  return {
    isDuplicate: false,
    duplicateOfId: null,
    duplicateOfName: null,
    reason: null,
  };
}
