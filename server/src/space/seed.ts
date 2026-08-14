import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

interface BlockSpec {
  type: string;
  [key: string]: unknown;
}

class Seeder {
  private positions = new Map<string | null, number>();

  constructor(private db: Database.Database) {}

  page(opts: {
    parent?: string | null;
    title: string;
    icon?: string;
    type?: string;
  }): string {
    const parent = opts.parent ?? null;
    const pos = this.positions.get(parent) ?? 0;
    this.positions.set(parent, pos + 1);
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO pages (id, parent_id, type, title, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, parent, opts.type ?? "page", opts.title, opts.icon ?? null, pos);
    return id;
  }

  blocks(pageId: string, specs: BlockSpec[]): void {
    const insert = this.db.prepare(
      "INSERT INTO blocks (id, page_id, type, content, position) VALUES (?, ?, ?, ?, ?)",
    );
    specs.forEach(({ type, ...content }, i) => {
      insert.run(randomUUID(), pageId, type, JSON.stringify(content), i);
    });
  }

  property(databaseId: string, name: string, type: string): string {
    const { pos } = this.db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = ?",
      )
      .get(databaseId) as { pos: number };
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO properties (id, database_id, name, type, position) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, databaseId, name, type, pos);
    return id;
  }

  options(
    propertyId: string,
    defs: [string, string][],
  ): Record<string, string> {
    const ids: Record<string, string> = {};
    defs.forEach(([name, color], i) => {
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO property_options (id, property_id, name, color, position) VALUES (?, ?, ?, ?, ?)",
        )
        .run(id, propertyId, name, color, i);
      ids[name] = id;
    });
    return ids;
  }

  row(
    databaseId: string,
    title: string,
    values: Record<string, unknown>,
  ): string {
    const { pos } = this.db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = ?",
      )
      .get(databaseId) as { pos: number };
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO pages (id, parent_id, type, title, position) VALUES (?, ?, 'row', ?, ?)",
      )
      .run(id, databaseId, title, pos);
    const insert = this.db.prepare(
      "INSERT INTO row_values (row_id, property_id, value) VALUES (?, ?, ?)",
    );
    for (const [propId, value] of Object.entries(values)) {
      if (value !== undefined) insert.run(id, propId, JSON.stringify(value));
    }
    return id;
  }

  view(
    databaseId: string,
    kind: string,
    config: Record<string, unknown>,
  ): void {
    this.db
      .prepare(
        "INSERT INTO views (database_id, kind, config) VALUES (?, ?, ?) ON CONFLICT(database_id, kind) DO UPDATE SET config = excluded.config",
      )
      .run(databaseId, kind, JSON.stringify(config));
  }
}

/** Populate a fresh database with the showcase workspace. No-op if pages exist. */
export function seedIfEmpty(db: Database.Database): void {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM pages").get() as {
    c: number;
  };
  if (c > 0) return;
  const s = new Seeder(db);

  const home = s.page({ title: "Home", icon: "🏠" });
  s.blocks(home, [
    { type: "heading1", text: "Welcome back, Ed" },
    {
      type: "paragraph",
      text: "This is your personal space: notes, plans and lists, all in one quiet place.",
    },
    {
      type: "callout",
      text: "Tip: press Enter for a new block, and type “/” anywhere to insert a different kind of block.",
    },
    { type: "divider" },
    { type: "heading3", text: "This week" },
    { type: "todo", text: "Water the balcony garden", checked: true },
    {
      type: "todo",
      text: "Book Kyoto ryokan before prices jump",
      checked: false,
    },
    { type: "todo", text: "Finish the slow tools draft", checked: false },
    { type: "quote", text: "Slow is smooth, smooth is fast." },
  ]);

  const projects = s.page({ title: "Projects", icon: "🗂️" });
  s.blocks(projects, [
    {
      type: "paragraph",
      text: "Anything with an outcome and more than one step lives here.",
    },
    { type: "bulleted", text: "Balcony Garden — summer crop underway" },
    { type: "bulleted", text: "Home Lab Rebuild — waiting on parts" },
    { type: "bulleted", text: "Writing — one essay at a time" },
  ]);

  const garden = s.page({
    parent: projects,
    title: "Balcony Garden",
    icon: "🌱",
  });
  s.blocks(garden, [
    { type: "heading2", text: "The plan" },
    {
      type: "paragraph",
      text: "Six containers, southern exposure, drip line off the outside tap. Keep it low-effort: herbs plus two tomato plants.",
    },
    { type: "bulleted", text: "Cherry tomatoes — two grow bags" },
    {
      type: "bulleted",
      text: "Basil, thyme, mint (mint stays in its own pot, it spreads)",
    },
    { type: "bulleted", text: "Chillies against the warm wall" },
    { type: "heading3", text: "Watering" },
    {
      type: "paragraph",
      text: "Mornings only. If leaves droop by evening, the drip rate is too low — nudge it up a notch.",
    },
  ]);

  const homelab = s.page({
    parent: projects,
    title: "Home Lab Rebuild",
    icon: "🖥️",
  });
  s.blocks(homelab, [
    { type: "heading2", text: "Goal" },
    {
      type: "paragraph",
      text: "Replace the ageing tower with a quiet mini PC cluster that idles under 30 watts.",
    },
    { type: "numbered", text: "Back everything up twice, verify one restore" },
    { type: "numbered", text: "Flatten and reinstall the router" },
    { type: "numbered", text: "Migrate services one at a time, oldest first" },
    { type: "heading3", text: "Bootstrap script" },
    {
      type: "code",
      text: "#!/usr/bin/env bash\nset -euo pipefail\nhostnamectl set-hostname node-01\napt update && apt install -y docker.io\ndocker run -d --restart=always --name whoami traefik/whoami",
    },
    {
      type: "callout",
      text: "Do not touch DNS until the second node is up. Learned this the hard way.",
    },
  ]);

  const parts = s.page({
    parent: homelab,
    title: "Parts Inventory",
    icon: "📦",
  });
  s.blocks(parts, [
    {
      type: "paragraph",
      text: "What has actually arrived, not what was ordered.",
    },
    { type: "todo", text: "Mini PC #1 (arrived, tested)", checked: true },
    { type: "todo", text: "Mini PC #2", checked: false },
    { type: "todo", text: "2.5G switch", checked: true },
    { type: "todo", text: "Short patch cables x6", checked: false },
  ]);

  const writing = s.page({ parent: projects, title: "Writing", icon: "✍️" });
  s.blocks(writing, [
    {
      type: "paragraph",
      text: "Drafts in progress. One piece at a time, shipped monthly.",
    },
  ]);

  const blog = s.page({
    parent: writing,
    title: "Blog: Slow Tools",
    icon: "📝",
  });
  s.blocks(blog, [
    { type: "heading2", text: "Thesis" },
    {
      type: "paragraph",
      text: "The best personal tools are boring: fast to open, obvious to use, and quiet about it. Speed of thought beats richness of feature.",
    },
    { type: "quote", text: "A tool is only yours once you stop noticing it." },
    { type: "heading3", text: "Outline" },
    { type: "numbered", text: "Why every note app eventually becomes a chore" },
    {
      type: "numbered",
      text: "The case for plain blocks over clever documents",
    },
    {
      type: "numbered",
      text: "What survives: search, lists, and a fast sidebar",
    },
    { type: "divider" },
    { type: "paragraph", text: "Target: 1,400 words. Draft due Friday." },
  ]);

  const travel = s.page({ title: "Travel", icon: "✈️" });
  s.blocks(travel, [
    {
      type: "paragraph",
      text: "Trips being planned, and notes from ones taken.",
    },
  ]);

  const japan = s.page({ parent: travel, title: "Japan 2026", icon: "🗾" });
  s.blocks(japan, [
    { type: "heading2", text: "Ten days, three stops" },
    {
      type: "paragraph",
      text: "Tokyo (4 nights) → Kyoto (4) → Osaka (2). Rail pass covers all of it; activate it on day 2, not day 1.",
    },
    {
      type: "bulleted",
      text: "Tokyo: old kissaten cafés, Meiji shrine at opening time",
    },
    {
      type: "bulleted",
      text: "Kyoto: Philosopher's Path early, before the crowds",
    },
    { type: "bulleted", text: "Osaka: eat until it stops being funny" },
    {
      type: "callout",
      text: "Book the ryokan with the cedar bath — the one Anna recommended. It sells out months ahead.",
    },
  ]);

  const tokyoFood = s.page({
    parent: japan,
    title: "Tokyo Food Shortlist",
    icon: "🍜",
  });
  s.blocks(tokyoFood, [
    {
      type: "bulleted",
      text: "Tsukemen at the place under the rail arches in Yūrakuchō",
    },
    {
      type: "bulleted",
      text: "7am tamago sando from any Lawson — not optional",
    },
    { type: "bulleted", text: "Depachika basement floor of Isetan, go hungry" },
    {
      type: "paragraph",
      text: "Rule: no queueing longer than 40 minutes for anything.",
    },
  ]);

  const packing = s.page({
    parent: travel,
    title: "Packing Checklist",
    icon: "🧳",
  });
  s.blocks(packing, [
    { type: "heading3", text: "Carry-on only" },
    { type: "todo", text: "Passport + rail pass voucher", checked: true },
    { type: "todo", text: "Universal adapter", checked: true },
    { type: "todo", text: "Merino layers x3", checked: false },
    { type: "todo", text: "Kindle, loaded", checked: false },
    { type: "todo", text: "Spare battery", checked: false },
    {
      type: "paragraph",
      text: "If it doesn't fit in the 40L bag, it doesn't come.",
    },
  ]);

  const notes = s.page({ title: "Notes", icon: "🧠" });
  s.blocks(notes, [
    {
      type: "paragraph",
      text: "Loose thoughts land here before they earn a page of their own.",
    },
  ]);

  const recipes = s.page({ parent: notes, title: "Recipes", icon: "🍝" });
  s.blocks(recipes, [
    { type: "heading3", text: "Midweek ragù (45 min)" },
    { type: "numbered", text: "Brown 400g mince hard — don't crowd the pan" },
    {
      type: "numbered",
      text: "Soffritto in the same pan, 10 minutes, no shortcuts",
    },
    {
      type: "numbered",
      text: "Tomatoes, a bay leaf, splash of milk, simmer 25",
    },
    { type: "paragraph", text: "Freezes well. Double it or regret it." },
  ]);

  const ideas = s.page({ parent: notes, title: "Ideas Inbox", icon: "💡" });
  s.blocks(ideas, [
    {
      type: "bulleted",
      text: "A tiny e-ink dashboard for the hallway: weather, calendar, one todo",
    },
    { type: "bulleted", text: "Essay: why paper boarding passes feel better" },
    { type: "bulleted", text: "Teach the niblings to solder something silly" },
  ]);

  seedReadingList(s);
  seedTripPlanner(s, travel);
  seedProjectTracker(s, projects);

  const health = s.page({ title: "Health & Habits", icon: "💪" });
  s.blocks(health, [
    { type: "heading2", text: "The boring basics" },
    {
      type: "paragraph",
      text: "Nothing clever: sleep, walks, weights twice a week. Track streaks, not records.",
    },
    { type: "todo", text: "Zone 2 — 40 minutes", checked: true },
    { type: "todo", text: "Weights — push day", checked: false },
    { type: "todo", text: "In bed by 23:00", checked: false },
    { type: "divider" },
    {
      type: "quote",
      text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    },
  ]);
}

function seedReadingList(s: Seeder): void {
  const dbId = s.page({ title: "Reading List", icon: "📚", type: "database" });
  const author = s.property(dbId, "Author", "text");
  const status = s.property(dbId, "Status", "select");
  const st = s.options(status, [
    ["To read", "amber"],
    ["Reading", "blue"],
    ["Finished", "green"],
  ]);
  const genre = s.property(dbId, "Genre", "multi_select");
  const g = s.options(genre, [
    ["Sci-fi", "purple"],
    ["Non-fiction", "teal"],
    ["Classic", "brown"],
    ["Fantasy", "pink"],
    ["Essays", "orange"],
  ]);
  const rating = s.property(dbId, "Rating", "number");
  const finished = s.property(dbId, "Finished on", "date");
  const owned = s.property(dbId, "Owned", "checkbox");
  const link = s.property(dbId, "Link", "url");

  const dune = s.row(dbId, "Dune", {
    [author]: "Frank Herbert",
    [status]: st.Finished,
    [genre]: [g["Sci-fi"], g.Classic],
    [rating]: 4.5,
    [finished]: "2026-03-02",
    [owned]: true,
    [link]: "https://en.wikipedia.org/wiki/Dune_(novel)",
  });
  s.blocks(dune, [
    { type: "quote", text: "Fear is the mind-killer." },
    {
      type: "paragraph",
      text: "Slower than remembered, better than expected. The dinner-party politics land harder at forty than they did at twenty.",
    },
  ]);

  s.row(dbId, "Project Hail Mary", {
    [author]: "Andy Weir",
    [status]: st.Finished,
    [genre]: [g["Sci-fi"]],
    [rating]: 4,
    [finished]: "2026-05-11",
    [owned]: false,
    [link]: "https://en.wikipedia.org/wiki/Project_Hail_Mary",
  });
  s.row(dbId, "The Making of the Atomic Bomb", {
    [author]: "Richard Rhodes",
    [status]: st.Reading,
    [genre]: [g["Non-fiction"]],
    [owned]: true,
    [link]: "https://en.wikipedia.org/wiki/The_Making_of_the_Atomic_Bomb",
  });
  const weeks = s.row(dbId, "Four Thousand Weeks", {
    [author]: "Oliver Burkeman",
    [status]: st.Finished,
    [genre]: [g["Non-fiction"], g.Essays],
    [rating]: 5,
    [finished]: "2026-01-20",
    [owned]: true,
  });
  s.blocks(weeks, [
    {
      type: "callout",
      text: "Re-read every January. The chapter on settling is the whole book.",
    },
  ]);
  s.row(dbId, "Piranesi", {
    [author]: "Susanna Clarke",
    [status]: st["To read"],
    [genre]: [g.Fantasy],
    [owned]: false,
  });
  s.row(dbId, "The Left Hand of Darkness", {
    [author]: "Ursula K. Le Guin",
    [status]: st["To read"],
    [genre]: [g["Sci-fi"], g.Classic],
    [owned]: true,
  });
  s.row(dbId, "Middlemarch", {
    [author]: "George Eliot",
    [status]: st["To read"],
    [genre]: [g.Classic],
    [owned]: false,
  });
  s.row(dbId, "Slow Productivity", {
    [author]: "Cal Newport",
    [status]: st.Reading,
    [genre]: [g["Non-fiction"]],
    [rating]: 3.5,
    [owned]: false,
    [link]: "https://calnewport.com/books/slow-productivity/",
  });

  s.view(dbId, "table", { sort: { propertyId: rating, direction: "desc" } });
  s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is", value: st["To read"] }],
  });
  s.view(dbId, "board", { groupBy: status });
}

function seedTripPlanner(s: Seeder, travelId: string): void {
  const dbId = s.page({
    parent: travelId,
    title: "Trip Planner",
    icon: "🧭",
    type: "database",
  });
  const status = s.property(dbId, "Status", "select");
  const st = s.options(status, [
    ["Dreaming", "gray"],
    ["Planning", "blue"],
    ["Booked", "green"],
    ["Done", "purple"],
  ]);
  const region = s.property(dbId, "Region", "select");
  const rg = s.options(region, [
    ["Europe", "teal"],
    ["Asia", "pink"],
    ["Americas", "orange"],
  ]);
  const vibes = s.property(dbId, "Vibes", "multi_select");
  const vb = s.options(vibes, [
    ["Food", "amber"],
    ["Hiking", "green"],
    ["Culture", "purple"],
    ["Beach", "blue"],
  ]);
  const budget = s.property(dbId, "Budget", "number");
  const depart = s.property(dbId, "Depart", "date");
  const flights = s.property(dbId, "Flights booked", "checkbox");
  const guide = s.property(dbId, "Guide", "url");

  const japan = s.row(dbId, "Japan, ten days", {
    [status]: st.Booked,
    [region]: rg.Asia,
    [vibes]: [vb.Food, vb.Culture],
    [budget]: 4800,
    [depart]: "2026-10-14",
    [flights]: true,
    [guide]: "https://japan-guide.com",
  });
  s.blocks(japan, [
    {
      type: "paragraph",
      text: "Flights on points, ryokan paid. Ground plan lives in the Japan 2026 page.",
    },
    { type: "todo", text: "Reserve the cedar-bath ryokan", checked: true },
    { type: "todo", text: "Activate rail pass on day 2", checked: false },
  ]);
  s.row(dbId, "Lisbon long weekend", {
    [status]: st.Planning,
    [region]: rg.Europe,
    [vibes]: [vb.Food, vb.Beach],
    [budget]: 900,
    [depart]: "2026-09-05",
    [flights]: false,
  });
  s.row(dbId, "Dolomites hut to hut", {
    [status]: st.Dreaming,
    [region]: rg.Europe,
    [vibes]: [vb.Hiking],
    [budget]: 1500,
    [flights]: false,
    [guide]: "https://www.alta-badia.org",
  });
  s.row(dbId, "Mexico City", {
    [status]: st.Dreaming,
    [region]: rg.Americas,
    [vibes]: [vb.Food, vb.Culture],
    [budget]: 1700,
    [flights]: false,
  });
  s.row(dbId, "Scottish Highlands", {
    [status]: st.Done,
    [region]: rg.Europe,
    [vibes]: [vb.Hiking],
    [budget]: 700,
    [depart]: "2026-04-18",
    [flights]: true,
  });

  s.view(dbId, "board", { groupBy: status });
  s.view(dbId, "table", { sort: { propertyId: depart, direction: "asc" } });
}

function seedProjectTracker(s: Seeder, projectsId: string): void {
  const dbId = s.page({
    parent: projectsId,
    title: "Project Tracker",
    icon: "🎯",
    type: "database",
  });
  const status = s.property(dbId, "Status", "select");
  const st = s.options(status, [
    ["Backlog", "gray"],
    ["In progress", "blue"],
    ["Blocked", "red"],
    ["Shipped", "green"],
  ]);
  const owner = s.property(dbId, "Owner", "text");
  const tags = s.property(dbId, "Tags", "multi_select");
  const tg = s.options(tags, [
    ["hardware", "orange"],
    ["software", "blue"],
    ["writing", "purple"],
    ["home", "teal"],
  ]);
  const effort = s.property(dbId, "Effort (days)", "number");
  const due = s.property(dbId, "Due", "date");
  const funded = s.property(dbId, "Budgeted", "checkbox");
  const spec = s.property(dbId, "Spec", "url");

  const migrate = s.row(dbId, "Migrate home lab services", {
    [status]: st["In progress"],
    [owner]: "Ed",
    [tags]: [tg.hardware, tg.software],
    [effort]: 6,
    [due]: "2026-08-30",
    [funded]: true,
    [spec]: "https://wiki.internal/homelab-plan",
  });
  s.blocks(migrate, [
    { type: "heading3", text: "Order of operations" },
    { type: "numbered", text: "DNS and reverse proxy last" },
    { type: "numbered", text: "Media server first, nobody notices downtime" },
    { type: "callout", text: "Snapshot before every move." },
  ]);
  s.row(dbId, "Drip irrigation for the balcony", {
    [status]: st.Shipped,
    [owner]: "Ed",
    [tags]: [tg.home],
    [effort]: 2,
    [due]: "2026-05-15",
    [funded]: true,
  });
  s.row(dbId, "Slow tools essay", {
    [status]: st["In progress"],
    [owner]: "Ed",
    [tags]: [tg.writing],
    [effort]: 3,
    [due]: "2026-07-31",
    [funded]: false,
  });
  s.row(dbId, "E-ink hallway dashboard", {
    [status]: st.Backlog,
    [owner]: "Ed",
    [tags]: [tg.hardware, tg.software],
    [effort]: 5,
    [funded]: false,
  });
  s.row(dbId, "Fix the wobbly bookshelf", {
    [status]: st.Blocked,
    [owner]: "Anna",
    [tags]: [tg.home],
    [effort]: 1,
    [funded]: false,
  });

  s.view(dbId, "board", { groupBy: status });
  s.view(dbId, "table", { sort: { propertyId: due, direction: "asc" } });
  s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is_not", value: st.Shipped }],
  });
}
