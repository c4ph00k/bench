import { openDb, type Repo } from "../../src/rolodex/db/index.js";

export function testRepo(): Repo {
  return openDb(":memory:");
}

export function makePerson(
  repo: Repo,
  name = "Test Person",
  extra: Record<string, unknown> = {},
) {
  return repo.createPerson({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    tags: [],
    ...extra,
  });
}
