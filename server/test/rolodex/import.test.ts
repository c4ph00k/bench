import { describe, it, expect } from "vitest";
import {
  parseCSV,
  applyMapping,
  parseVCard,
  checkDuplicates,
} from "../../src/rolodex/import.js";

const CSV = `Name,Email Address,Phone,Company,Title,City,Birthday,Notes
Nora Feldman,nora@example.com,+49 30 555,Feldman Studio,Illustrator,Berlin,1993-04-11,Met at the fair
Owen Clarke,owen@example.com,,Hartley PR,Press,Manchester,,
Maya Chen,maya@example.com,,,,,,`;

describe("CSV parsing", () => {
  it("parses rows with headers", () => {
    const parsed = parseCSV(CSV);
    expect(parsed.headers).toContain("Name");
    expect(parsed.rows).toHaveLength(3);
  });

  it("suggests a mapping from common header names", () => {
    const parsed = parseCSV(CSV);
    expect(parsed.suggestedMapping?.Name).toBe("name");
    expect(parsed.suggestedMapping?.["Email Address"]).toBe("email");
    expect(parsed.suggestedMapping?.Company).toBe("company");
    expect(parsed.suggestedMapping?.Title).toBe("job_title");
    expect(parsed.suggestedMapping?.City).toBe("city");
    expect(parsed.suggestedMapping?.Birthday).toBe("birthday");
  });

  it("applies the mapping and skips rows without a name", () => {
    const parsed = parseCSV(CSV);
    const { people, skipped } = applyMapping(parsed, parsed.suggestedMapping!);
    expect(skipped).toBe(0);
    expect(people[0]).toMatchObject({
      name: "Nora Feldman",
      email: "nora@example.com",
      company: "Feldman Studio",
      job_title: "Illustrator",
      city: "Berlin",
      birthday: "1993-04-11",
      notes: "Met at the fair",
    });
    expect(people[1].phone).toBeNull();
  });

  it("normalizes US-style and day-first birthdays", () => {
    const csv = `Name,Birthday\nA,04/11/1993\nB,25/12/1990\nC,1990-12-25T00:00:00Z\nD,not-a-date`;
    const parsed = parseCSV(csv);
    const { people } = applyMapping(parsed, parsed.suggestedMapping!);
    expect(people.map((p) => p.birthday)).toEqual([
      "1993-04-11",
      "1990-12-25",
      "1990-12-25",
      null,
    ]);
  });

  it("applies a custom mapping", () => {
    const csv = `Who,Org\nAda,Analytical Engines`;
    const parsed = parseCSV(csv);
    const { people } = applyMapping(parsed, { Who: "name", Org: "company" });
    expect(people[0]).toMatchObject({
      name: "Ada",
      company: "Analytical Engines",
    });
  });
});

describe("vCard parsing", () => {
  const VCF = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Ada Lovelace",
    "N:Lovelace;Ada;;;",
    "EMAIL:ada@example.com",
    "TEL:+44 20 7000 0000",
    "ORG:Analytical Engines;Math",
    "TITLE:Founder",
    "ADR:;;12 Piccadilly;London;;;UK",
    "BDAY:1980-12-10",
    "NOTE:First programmer",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:4.0",
    "FN:Grace Hopper",
    "N:Hopper;Grace;;;",
    "EMAIL:grace@example.com",
    "BDAY:--12-09",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:No Contact Info",
    "END:VCARD",
  ].join("\r\n");

  it("parses names, contact details, org, address and birthday", () => {
    const people = parseVCard(VCF);
    expect(people).toHaveLength(3);
    expect(people[0]).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+44 20 7000 0000",
      company: "Analytical Engines",
      job_title: "Founder",
      city: "London",
      birthday: "1980-12-10",
      notes: "First programmer",
    });
  });

  it("falls back to N when FN is missing and handles partial birthdays", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "BDAY:--03-15",
      "END:VCARD",
    ].join("\r\n");
    const people = parseVCard(vcf);
    expect(people[0]).toMatchObject({
      name: "Ada Lovelace",
      birthday: "--03-15",
    });
  });

  it("accepts LF-only line endings and version 4.0", () => {
    const people = parseVCard(VCF.replace(/\r\n/g, "\n"));
    expect(people).toHaveLength(3);
    expect(people[1].name).toBe("Grace Hopper");
  });

  it("returns empty for unparseable input rather than throwing", () => {
    expect(parseVCard("complete garbage")).toEqual([]);
  });
});

describe("duplicate detection", () => {
  const existing = [
    { id: 1, name: "Maya Chen", email: "maya@example.com" },
    { id: 2, name: "Sam Okafor", email: "sam@example.com" },
  ];

  it("matches by email, case-insensitively", () => {
    const d = checkDuplicates(
      { name: "Different Name", email: "MAYA@example.com" } as never,
      existing,
    );
    expect(d.isDuplicate).toBe(true);
    expect(d.duplicateOfId).toBe(1);
    expect(d.reason).toBe("email");
  });

  it("matches by exact name when email is absent", () => {
    const d = checkDuplicates(
      { name: "sam okafor", email: null } as never,
      existing,
    );
    expect(d.isDuplicate).toBe(true);
    expect(d.reason).toBe("name");
  });

  it("does not flag new people", () => {
    const d = checkDuplicates(
      { name: "Nora Feldman", email: "nora@example.com" } as never,
      existing,
    );
    expect(d.isDuplicate).toBe(false);
  });
});
