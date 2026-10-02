import type { Pool } from "pg";
import { randomUUID } from "node:crypto";

interface BlockSpec {
  type: string;
  [key: string]: unknown;
}

class Seeder {
  private positions = new Map<string | null, number>();

  constructor(
    private pool: Pool,
    private tenantId: number,
  ) {}

  async page(opts: {
    parent?: string | null;
    title: string;
    icon?: string;
    type?: string;
  }): Promise<string> {
    const parent = opts.parent ?? null;
    const pos = this.positions.get(parent) ?? 0;
    this.positions.set(parent, pos + 1);
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO pages (id, tenant_id, parent_id, type, title, icon, position) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        this.tenantId,
        parent,
        opts.type ?? "page",
        opts.title,
        opts.icon ?? null,
        pos,
      ],
    );
    return id;
  }

  async blocks(pageId: string, specs: BlockSpec[]): Promise<void> {
    for (const [i, { type, ...content }] of specs.entries()) {
      await this.pool.query(
        "INSERT INTO blocks (id, tenant_id, page_id, type, content, position) VALUES ($1, $2, $3, $4, $5, $6)",
        [randomUUID(), this.tenantId, pageId, type, JSON.stringify(content), i],
      );
    }
  }

  async property(
    databaseId: string,
    name: string,
    type: string,
  ): Promise<string> {
    const pos = await this.pool.query<{ pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = $1 AND tenant_id = $2",
      [databaseId, this.tenantId],
    );
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO properties (id, tenant_id, database_id, name, type, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, this.tenantId, databaseId, name, type, pos.rows[0].pos],
    );
    return id;
  }

  async options(
    propertyId: string,
    defs: [string, string][],
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const [i, [name, color]] of defs.entries()) {
      const id = randomUUID();
      await this.pool.query(
        "INSERT INTO property_options (id, tenant_id, property_id, name, color, position) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, this.tenantId, propertyId, name, color, i],
      );
      ids[name] = id;
    }
    return ids;
  }

  async row(
    databaseId: string,
    title: string,
    values: Record<string, unknown>,
  ): Promise<string> {
    const pos = await this.pool.query<{ pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = $1 AND tenant_id = $2",
      [databaseId, this.tenantId],
    );
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO pages (id, tenant_id, parent_id, type, title, position) VALUES ($1, $2, $3, 'row', $4, $5)",
      [id, this.tenantId, databaseId, title, pos.rows[0].pos],
    );
    for (const [propId, value] of Object.entries(values)) {
      if (value !== undefined)
        await this.pool.query(
          "INSERT INTO row_values (tenant_id, row_id, property_id, value) VALUES ($1, $2, $3, $4)",
          [this.tenantId, id, propId, JSON.stringify(value)],
        );
    }
    return id;
  }

  async view(
    databaseId: string,
    kind: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(
      "INSERT INTO views (tenant_id, database_id, kind, config) VALUES ($1, $2, $3, $4) ON CONFLICT (database_id, kind) DO UPDATE SET config = excluded.config",
      [this.tenantId, databaseId, kind, JSON.stringify(config)],
    );
  }
}

/** Populate a fresh tenant with the showcase workspace. No-op if pages exist. */
export async function seedIfEmpty(pool: Pool, tenantId: number): Promise<void> {
  const count = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM pages WHERE tenant_id = $1",
    [tenantId],
  );
  if (count.rows[0].c > 0) return;
  const s = new Seeder(pool, tenantId);

  const home = await s.page({ title: "Home", icon: "🏠" });
  await s.blocks(home, [
    { type: "heading1", text: "Welcome back, Marco" },
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
    { type: "divider" },
    { type: "heading3", text: "Where things live" },
    {
      type: "bulleted",
      text: "Projects — anything with an outcome and more than one step",
    },
    {
      type: "bulleted",
      text: "Work — deadlines someone else set, and the task board",
    },
    {
      type: "bulleted",
      text: "Travel — trips planned, trips taken, and what to pack",
    },
    {
      type: "bulleted",
      text: "Notes — everything that has not earned a home yet",
    },
    {
      type: "bulleted",
      text: "Archive — finished or abandoned, kept for the reasoning",
    },
  ]);

  const projects = await s.page({ title: "Projects", icon: "🗂️" });
  await s.blocks(projects, [
    {
      type: "paragraph",
      text: "Anything with an outcome and more than one step lives here.",
    },
    { type: "bulleted", text: "Balcony Garden — summer crop underway" },
    { type: "bulleted", text: "Home Lab Rebuild — waiting on parts" },
    { type: "bulleted", text: "Writing — one essay at a time" },
  ]);

  const garden = await s.page({
    parent: projects,
    title: "Balcony Garden",
    icon: "🌱",
  });
  await s.blocks(garden, [
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

  const calendar = await s.page({
    parent: garden,
    title: "Planting Calendar",
    icon: "📅",
  });
  await s.blocks(calendar, [
    { type: "heading3", text: "Sow" },
    {
      type: "bulleted",
      text: "March — basil and chillies indoors, on the sill",
    },
    { type: "bulleted", text: "April — tomatoes potted on, still inside" },
    {
      type: "bulleted",
      text: "Mid-May — everything out, after the last frost",
    },
    { type: "heading3", text: "Feed" },
    {
      type: "paragraph",
      text: "Tomato feed once a week from the first truss, half strength for the herbs.",
    },
    {
      type: "callout",
      text: "Last frost here is usually the second week of May. Going out early has cost two years running.",
    },
  ]);

  const homelab = await s.page({
    parent: projects,
    title: "Home Lab Rebuild",
    icon: "🖥️",
  });
  await s.blocks(homelab, [
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

  const parts = await s.page({
    parent: homelab,
    title: "Parts Inventory",
    icon: "📦",
  });
  await s.blocks(parts, [
    {
      type: "paragraph",
      text: "What has actually arrived, not what was ordered.",
    },
    { type: "todo", text: "Mini PC #1 (arrived, tested)", checked: true },
    { type: "todo", text: "Mini PC #2", checked: false },
    { type: "todo", text: "2.5G switch", checked: true },
    { type: "todo", text: "Short patch cables x6", checked: false },
  ]);

  const network = await s.page({
    parent: homelab,
    title: "Network Map",
    icon: "🕸️",
  });
  await s.blocks(network, [
    {
      type: "paragraph",
      text: "One flat network was fine until the cameras arrived. Three VLANs now, and the rule is that anything cheap lives on 30.",
    },
    { type: "numbered", text: "10 — trusted: laptops, phones, the NAS" },
    { type: "numbered", text: "20 — services: the two nodes and the proxy" },
    { type: "numbered", text: "30 — untrusted: cameras, plugs, the doorbell" },
    {
      type: "code",
      text: "# router: only 10 may reach 20's admin ports\nallow from 10.0.10.0/24 to 10.0.20.0/24 port 22,443\nblock from 10.0.30.0/24 to 10.0.0.0/8\nallow from 10.0.30.0/24 to any port 123",
    },
    { type: "divider" },
    {
      type: "quote",
      text: "A network you cannot draw on one page is a network you do not understand.",
    },
  ]);

  const writing = await s.page({
    parent: projects,
    title: "Writing",
    icon: "✍️",
  });
  await s.blocks(writing, [
    {
      type: "paragraph",
      text: "Drafts in progress. One piece at a time, shipped monthly.",
    },
  ]);

  const blog = await s.page({
    parent: writing,
    title: "Blog: Slow Tools",
    icon: "📝",
  });
  await s.blocks(blog, [
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

  const essays = await s.page({
    parent: writing,
    title: "Essay Ideas",
    icon: "🗒️",
  });
  await s.blocks(essays, [
    {
      type: "paragraph",
      text: "Nothing here is committed to. An idea earns its own page once it survives a month.",
    },
    { type: "bulleted", text: "The case against the second monitor" },
    { type: "bulleted", text: "What a home lab teaches you about production" },
    { type: "bulleted", text: "Why every list app becomes a calendar" },
    { type: "bulleted", text: "Cooking as the last unoptimised hobby" },
    { type: "todo", text: "Pick one for September", checked: false },
  ]);

  const bike = await s.page({
    parent: projects,
    title: "Bike Restoration",
    icon: "🚲",
  });
  await s.blocks(bike, [
    { type: "heading2", text: "1987 tourer, bought for parts money" },
    {
      type: "paragraph",
      text: "Frame is straight and the lugs are clean, which is the only part that cannot be bought later.",
    },
    { type: "todo", text: "Strip and degrease the frame", checked: true },
    { type: "todo", text: "Repack both hubs", checked: true },
    { type: "todo", text: "New cables, outers included", checked: false },
    {
      type: "todo",
      text: "Decide: keep the friction shifters",
      checked: false,
    },
    {
      type: "callout",
      text: "Do not repaint it. The patina is the reason it was affordable.",
    },
  ]);

  const travel = await s.page({ title: "Travel", icon: "✈️" });
  await s.blocks(travel, [
    {
      type: "paragraph",
      text: "Trips being planned, and notes from ones taken.",
    },
  ]);

  const japan = await s.page({
    parent: travel,
    title: "Japan 2026",
    icon: "🗾",
  });
  await s.blocks(japan, [
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

  const tokyoFood = await s.page({
    parent: japan,
    title: "Tokyo Food Shortlist",
    icon: "🍜",
  });
  await s.blocks(tokyoFood, [
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

  const kyoto = await s.page({
    parent: japan,
    title: "Kyoto Notes",
    icon: "⛩️",
  });
  await s.blocks(kyoto, [
    { type: "heading3", text: "Mornings" },
    {
      type: "paragraph",
      text: "Everything worth seeing is worth seeing at seven. By ten the same place is a queue with a temple in it.",
    },
    { type: "bulleted", text: "Fushimi Inari before six, all the way up" },
    {
      type: "bulleted",
      text: "Nanzen-ji aqueduct, then coffee at the kissaten",
    },
    { type: "bulleted", text: "Nishiki market on a weekday only" },
    { type: "heading3", text: "Evenings" },
    {
      type: "paragraph",
      text: "Pontocho is fun once. The river bank on a warm night is fun every time and costs nothing.",
    },
    {
      type: "callout",
      text: "Buses take exact change and fill up after four. Walk, or take the subway two stops and walk.",
    },
  ]);

  const points = await s.page({
    parent: travel,
    title: "Points and Miles",
    icon: "🎫",
  });
  await s.blocks(points, [
    {
      type: "paragraph",
      text: "The only rule that has ever worked: earn on one alliance, burn on long haul, ignore everything else.",
    },
    { type: "numbered", text: "Balance sits at roughly 180,000" },
    { type: "numbered", text: "Two long-haul seats booked, one still open" },
    { type: "numbered", text: "Expiry rolls forward on any activity" },
    {
      type: "todo",
      text: "Move the hotel points before December",
      checked: false,
    },
    {
      type: "quote",
      text: "Points are a currency that only ever loses value.",
    },
  ]);

  const packing = await s.page({
    parent: travel,
    title: "Packing Checklist",
    icon: "🧳",
  });
  await s.blocks(packing, [
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

  const notes = await s.page({ title: "Notes", icon: "🧠" });
  await s.blocks(notes, [
    {
      type: "paragraph",
      text: "Loose thoughts land here before they earn a page of their own.",
    },
  ]);

  const recipes = await s.page({ parent: notes, title: "Recipes", icon: "🍝" });
  await s.blocks(recipes, [
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

  const sourdough = await s.page({
    parent: recipes,
    title: "Sourdough, Slowly",
    icon: "🍞",
  });
  await s.blocks(sourdough, [
    { type: "heading2", text: "The schedule that fits a working week" },
    {
      type: "paragraph",
      text: "Feed on Friday night, mix Saturday morning, bake Sunday. Everything else is waiting, which the fridge does for you.",
    },
    { type: "numbered", text: "Friday 21:00 — feed 1:5:5, leave out" },
    { type: "numbered", text: "Saturday 09:00 — mix, autolyse an hour" },
    { type: "numbered", text: "Saturday 10:00 — salt in, four sets of folds" },
    { type: "numbered", text: "Saturday 14:00 — shape, into the fridge" },
    {
      type: "numbered",
      text: "Sunday 08:00 — bake from cold, lid on 20, off 20",
    },
    { type: "divider" },
    { type: "heading3", text: "Ratios" },
    {
      type: "code",
      text: "flour 500g\nwater 350g   (70%)\nstarter 100g (20%)\nsalt 10g     (2%)",
    },
    {
      type: "callout",
      text: "If the crumb is tight, the dough was under-fermented, not under-proved. Give it another hour on the counter next time.",
    },
  ]);

  const quotes = await s.page({ parent: notes, title: "Quotes", icon: "💬" });
  await s.blocks(quotes, [
    {
      type: "paragraph",
      text: "Kept because they changed something, not because they sounded clever.",
    },
    {
      type: "quote",
      text: "Perfection is achieved when there is nothing left to take away.",
    },
    {
      type: "quote",
      text: "The work is the reward. Everything else is weather.",
    },
    { type: "quote", text: "You can have results or excuses, not both." },
    { type: "quote", text: "Any fool can write code a computer understands." },
  ]);

  const films = await s.page({
    parent: notes,
    title: "Films to Watch",
    icon: "🎬",
  });
  await s.blocks(films, [
    { type: "heading3", text: "Queued" },
    {
      type: "todo",
      text: "Stalker — long, but the right kind",
      checked: false,
    },
    { type: "todo", text: "The Conversation", checked: false },
    { type: "todo", text: "Perfect Days", checked: true },
    { type: "heading3", text: "Rewatch when it rains" },
    { type: "bulleted", text: "Heat" },
    { type: "bulleted", text: "Paris, Texas" },
    { type: "bulleted", text: "Chungking Express" },
  ]);

  const ideas = await s.page({
    parent: notes,
    title: "Ideas Inbox",
    icon: "💡",
  });
  await s.blocks(ideas, [
    {
      type: "bulleted",
      text: "A tiny e-ink dashboard for the hallway: weather, calendar, one todo",
    },
    { type: "bulleted", text: "Essay: why paper boarding passes feel better" },
    { type: "bulleted", text: "Teach the niblings to solder something silly" },
  ]);

  await seedReadingList(s);
  await seedTripPlanner(s, travel);
  await seedProjectTracker(s, projects);

  const health = await s.page({ title: "Health & Habits", icon: "💪" });
  await s.blocks(health, [
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

  const training = await s.page({
    parent: health,
    title: "Training Plan",
    icon: "🏋️",
  });
  await s.blocks(training, [
    { type: "heading3", text: "Week shape" },
    { type: "bulleted", text: "Monday — push, 45 minutes, no more" },
    { type: "bulleted", text: "Wednesday — pull, same" },
    { type: "bulleted", text: "Saturday — long walk or the hill loop" },
    { type: "heading3", text: "The lifts" },
    { type: "numbered", text: "Bench — 5x5, add 2.5kg when all sets clear" },
    { type: "numbered", text: "Row — 5x5, same rule" },
    { type: "numbered", text: "Squat — 3x8, never to failure" },
    {
      type: "callout",
      text: "Two sessions a week done for a year beats four sessions a week done for a month. It is not close.",
    },
  ]);

  const sleep = await s.page({
    parent: health,
    title: "Sleep Log",
    icon: "😴",
  });
  await s.blocks(sleep, [
    {
      type: "paragraph",
      text: "Kept for a fortnight to find the pattern, not forever. The pattern was obvious by day four.",
    },
    { type: "bulleted", text: "Screens after 22:30 cost about forty minutes" },
    { type: "bulleted", text: "Coffee after 14:00 costs the same again" },
    {
      type: "bulleted",
      text: "A walk before dinner is worth more than either",
    },
    {
      type: "quote",
      text: "Sleep is the intervention. Everything else is a supplement.",
    },
  ]);

  await seedWork(s);
  await seedLearning(s);

  const archive = await s.page({ title: "Archive", icon: "🗄️" });
  await s.blocks(archive, [
    {
      type: "paragraph",
      text: "Finished, abandoned, or simply over. Kept because deleting it would lose the reasoning.",
    },
  ]);

  const retro = await s.page({
    parent: archive,
    title: "2025 in Review",
    icon: "🧾",
  });
  await s.blocks(retro, [
    { type: "heading2", text: "What worked" },
    { type: "bulleted", text: "Writing monthly instead of weekly" },
    {
      type: "bulleted",
      text: "One trip planned properly, not three planned badly",
    },
    { type: "heading2", text: "What did not" },
    { type: "bulleted", text: "Three note apps, none of them trusted" },
    {
      type: "bulleted",
      text: "Buying tools before finishing the last project",
    },
    { type: "divider" },
    {
      type: "callout",
      text: "The whole year in one line: fewer things, finished.",
    },
  ]);
}

async function seedWork(s: Seeder): Promise<void> {
  const work = await s.page({ title: "Work", icon: "💼" });
  await s.blocks(work, [
    { type: "heading1", text: "Work" },
    {
      type: "paragraph",
      text: "Everything that has a deadline someone else set. Tasks live in the database below; thinking lives on its own page.",
    },
    {
      type: "callout",
      text: "Rule: if it takes two minutes, it never becomes a task.",
    },
  ]);

  await s.page({ parent: work, title: "Weekly Review", icon: "🔁" });
  await s.page({ parent: work, title: "Who Does What", icon: "👥" });
  await s.page({ parent: work, title: "Meeting Notes", icon: "📓" });
  await seedTasks(s, work);
}

async function seedTasks(s: Seeder, workId: string): Promise<void> {
  const dbId = await s.page({
    parent: workId,
    title: "Tasks",
    icon: "📋",
    type: "database",
  });
  const status = await s.property(dbId, "Status", "select");
  const st = await s.options(status, [
    ["Todo", "gray"],
    ["Doing", "blue"],
    ["Waiting", "amber"],
    ["Done", "green"],
  ]);
  const priority = await s.property(dbId, "Priority", "select");
  const pr = await s.options(priority, [
    ["High", "red"],
    ["Medium", "amber"],
    ["Low", "gray"],
  ]);
  const area = await s.property(dbId, "Area", "multi_select");
  const ar = await s.options(area, [
    ["Client", "orange"],
    ["Deep work", "purple"],
    ["Admin", "teal"],
    ["Hiring", "pink"],
  ]);
  const due = await s.property(dbId, "Due", "date");
  const hours = await s.property(dbId, "Estimate (h)", "number");
  const recurring = await s.property(dbId, "Recurring", "checkbox");
  const brief = await s.property(dbId, "Brief", "url");

  const rollout = await s.row(dbId, "Warehouse rollout plan", {
    [status]: st.Doing,
    [priority]: pr.High,
    [area]: [ar.Client, ar["Deep work"]],
    [due]: "2026-08-21",
    [hours]: 6,
    [recurring]: false,
    [brief]: "https://wiki.internal/rollout",
  });
  await s.blocks(rollout, [
    { type: "heading3", text: "Shape" },
    { type: "numbered", text: "Warehouse, two weeks, watch the error rate" },
    { type: "numbered", text: "Stores, once warehouse is quiet" },
    { type: "numbered", text: "Everyone else, same day" },
    { type: "callout", text: "No rollout on a Friday. Ever." },
  ]);
  await s.row(dbId, "Q4 budget draft", {
    [status]: st.Doing,
    [priority]: pr.High,
    [area]: [ar.Admin],
    [due]: "2026-08-28",
    [hours]: 4,
    [recurring]: false,
  });
  await s.row(dbId, "Interview loop for the data role", {
    [status]: st.Waiting,
    [priority]: pr.Medium,
    [area]: [ar.Hiring],
    [due]: "2026-09-04",
    [hours]: 3,
    [recurring]: false,
    [brief]: "https://wiki.internal/hiring-loop",
  });
  await s.row(dbId, "Rewrite the onboarding doc", {
    [status]: st.Todo,
    [priority]: pr.Medium,
    [area]: [ar["Deep work"]],
    [hours]: 5,
    [recurring]: false,
  });
  await s.row(dbId, "Renew the SSL certificate", {
    [status]: st.Todo,
    [priority]: pr.High,
    [area]: [ar.Admin],
    [due]: "2026-09-12",
    [hours]: 1,
    [recurring]: true,
  });
  const invoices = await s.row(dbId, "Chase the open invoices", {
    [status]: st.Waiting,
    [priority]: pr.Medium,
    [area]: [ar.Admin, ar.Client],
    [due]: "2026-08-18",
    [hours]: 1,
    [recurring]: true,
  });
  await s.blocks(invoices, [
    { type: "todo", text: "Northwind — 30 days over", checked: false },
    { type: "todo", text: "Cobalt — paid, close it", checked: true },
    {
      type: "paragraph",
      text: "Both were sent to the wrong address. Fix the template, not the invoices.",
    },
  ]);
  await s.row(dbId, "Client review deck", {
    [status]: st.Todo,
    [priority]: pr.Low,
    [area]: [ar.Client],
    [due]: "2026-09-25",
    [hours]: 3,
    [recurring]: false,
  });
  await s.row(dbId, "Archive the 2025 project folders", {
    [status]: st.Todo,
    [priority]: pr.Low,
    [area]: [ar.Admin],
    [hours]: 2,
    [recurring]: false,
  });
  await s.row(dbId, "Weekly review", {
    [status]: st.Done,
    [priority]: pr.Medium,
    [area]: [ar.Admin],
    [due]: "2026-08-14",
    [hours]: 0.5,
    [recurring]: true,
  });
  await s.row(dbId, "Migrate the reporting job", {
    [status]: st.Done,
    [priority]: pr.High,
    [area]: [ar["Deep work"]],
    [due]: "2026-08-07",
    [hours]: 8,
    [recurring]: false,
  });
  await s.row(dbId, "Pick the analytics vendor", {
    [status]: st.Done,
    [priority]: pr.Medium,
    [area]: [ar.Client, ar.Admin],
    [due]: "2026-07-31",
    [hours]: 4,
    [recurring]: false,
    [brief]: "https://wiki.internal/analytics-shortlist",
  });

  await s.view(dbId, "board", { groupBy: status });
  await s.view(dbId, "table", { sort: { propertyId: due, direction: "asc" } });
  await s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is_not", value: st.Done }],
  });
}

async function seedLearning(s: Seeder): Promise<void> {
  const learning = await s.page({ title: "Learning", icon: "🎓" });
  await s.blocks(learning, [
    {
      type: "paragraph",
      text: "One thing at a time, finished before the next one starts. Notes here, progress in the course log.",
    },
    {
      type: "quote",
      text: "You do not know a subject until you can teach the awkward parts.",
    },
  ]);

  await s.page({ parent: learning, title: "Rust Notes", icon: "🦀" });
  await s.page({
    parent: learning,
    title: "Shortcuts Worth Learning",
    icon: "⌨️",
  });
  await seedCourseLog(s, learning);
}

async function seedCourseLog(s: Seeder, learningId: string): Promise<void> {
  const dbId = await s.page({
    parent: learningId,
    title: "Course Log",
    icon: "🎧",
    type: "database",
  });
  const status = await s.property(dbId, "Status", "select");
  const st = await s.options(status, [
    ["Wishlist", "gray"],
    ["Watching", "blue"],
    ["Finished", "green"],
    ["Abandoned", "red"],
  ]);
  const source = await s.property(dbId, "Source", "text");
  const topics = await s.property(dbId, "Topics", "multi_select");
  const tp = await s.options(topics, [
    ["Systems", "teal"],
    ["Language", "purple"],
    ["Design", "pink"],
    ["Music", "orange"],
  ]);
  const hours = await s.property(dbId, "Hours", "number");
  const started = await s.property(dbId, "Started", "date");
  const finished = await s.property(dbId, "Certificate", "checkbox");
  await s.property(dbId, "Link", "url");

  const rustCourse = await s.row(dbId, "Rust in Practice", {
    [source]: "Recorded lectures",
    [status]: st.Watching,
    [topics]: [tp.Language, tp.Systems],
    [hours]: 18,
    [started]: "2026-07-06",
    [finished]: false,
  });
  await s.blocks(rustCourse, [
    {
      type: "paragraph",
      text: "Two chapters a week, exercises done properly. Notes go to the Rust page rather than in here.",
    },
    { type: "todo", text: "Chapter 10 — generics and traits", checked: true },
    {
      type: "todo",
      text: "Chapter 13 — closures and iterators",
      checked: false,
    },
  ]);
  await s.row(dbId, "Designing Data-Intensive Systems", {
    [source]: "University series",
    [status]: st.Watching,
    [topics]: [tp.Systems],
    [hours]: 24,
    [started]: "2026-06-01",
    [finished]: false,
  });
  await s.row(dbId, "Typography for Screens", {
    [source]: "Workshop, two days",
    [status]: st.Finished,
    [topics]: [tp.Design],
    [hours]: 12,
    [started]: "2026-03-10",
    [finished]: true,
  });
  await s.row(dbId, "Jazz Piano Fundamentals", {
    [source]: "Weekly lesson",
    [status]: st.Watching,
    [topics]: [tp.Music],
    [hours]: 40,
    [started]: "2026-01-08",
    [finished]: false,
  });
  await s.row(dbId, "Kubernetes the Hard Way", {
    [source]: "Self-paced",
    [status]: st.Abandoned,
    [topics]: [tp.Systems],
    [hours]: 6,
    [started]: "2026-02-14",
    [finished]: false,
  });
  await s.row(dbId, "Colour and Contrast", {
    [source]: "Reading group",
    [status]: st.Wishlist,
    [topics]: [tp.Design],
    [finished]: false,
  });
  await s.row(dbId, "Compilers, from Scratch", {
    [source]: "Book plus exercises",
    [status]: st.Wishlist,
    [topics]: [tp.Language, tp.Systems],
    [hours]: 30,
    [finished]: false,
  });

  await s.view(dbId, "table", {
    sort: { propertyId: hours, direction: "desc" },
  });
  await s.view(dbId, "board", { groupBy: status });
  await s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is", value: st.Watching }],
  });
}

async function seedReadingList(s: Seeder): Promise<void> {
  const dbId = await s.page({
    title: "Reading List",
    icon: "📚",
    type: "database",
  });
  const author = await s.property(dbId, "Author", "text");
  const status = await s.property(dbId, "Status", "select");
  const st = await s.options(status, [
    ["To read", "amber"],
    ["Reading", "blue"],
    ["Finished", "green"],
  ]);
  const genre = await s.property(dbId, "Genre", "multi_select");
  const g = await s.options(genre, [
    ["Sci-fi", "purple"],
    ["Non-fiction", "teal"],
    ["Classic", "brown"],
    ["Fantasy", "pink"],
    ["Essays", "orange"],
  ]);
  const rating = await s.property(dbId, "Rating", "number");
  const finished = await s.property(dbId, "Finished on", "date");
  const owned = await s.property(dbId, "Owned", "checkbox");
  const link = await s.property(dbId, "Link", "url");

  const dune = await s.row(dbId, "Dune", {
    [author]: "Frank Herbert",
    [status]: st.Finished,
    [genre]: [g["Sci-fi"], g.Classic],
    [rating]: 4.5,
    [finished]: "2026-03-02",
    [owned]: true,
    [link]: "https://en.wikipedia.org/wiki/Dune_(novel)",
  });
  await s.blocks(dune, [
    { type: "quote", text: "Fear is the mind-killer." },
    {
      type: "paragraph",
      text: "Slower than remembered, better than expected. The dinner-party politics land harder at forty than they did at twenty.",
    },
  ]);

  await s.row(dbId, "Project Hail Mary", {
    [author]: "Andy Weir",
    [status]: st.Finished,
    [genre]: [g["Sci-fi"]],
    [rating]: 4,
    [finished]: "2026-05-11",
    [owned]: false,
    [link]: "https://en.wikipedia.org/wiki/Project_Hail_Mary",
  });
  await s.row(dbId, "The Making of the Atomic Bomb", {
    [author]: "Richard Rhodes",
    [status]: st.Reading,
    [genre]: [g["Non-fiction"]],
    [owned]: true,
    [link]: "https://en.wikipedia.org/wiki/The_Making_of_the_Atomic_Bomb",
  });
  const weeks = await s.row(dbId, "Four Thousand Weeks", {
    [author]: "Oliver Burkeman",
    [status]: st.Finished,
    [genre]: [g["Non-fiction"], g.Essays],
    [rating]: 5,
    [finished]: "2026-01-20",
    [owned]: true,
  });
  await s.blocks(weeks, [
    {
      type: "callout",
      text: "Re-read every January. The chapter on settling is the whole book.",
    },
  ]);
  await s.row(dbId, "Piranesi", {
    [author]: "Susanna Clarke",
    [status]: st["To read"],
    [genre]: [g.Fantasy],
    [owned]: false,
  });
  await s.row(dbId, "The Left Hand of Darkness", {
    [author]: "Ursula K. Le Guin",
    [status]: st["To read"],
    [genre]: [g["Sci-fi"], g.Classic],
    [owned]: true,
  });
  await s.row(dbId, "Middlemarch", {
    [author]: "George Eliot",
    [status]: st["To read"],
    [genre]: [g.Classic],
    [owned]: false,
  });
  await s.row(dbId, "Slow Productivity", {
    [author]: "Cal Newport",
    [status]: st.Reading,
    [genre]: [g["Non-fiction"]],
    [rating]: 3.5,
    [owned]: false,
    [link]: "https://calnewport.com/books/slow-productivity/",
  });
  const wolf = await s.row(dbId, "Wolf Hall", {
    [author]: "Hilary Mantel",
    [status]: st.Finished,
    [genre]: [g.Classic],
    [rating]: 4.5,
    [finished]: "2026-02-14",
    [owned]: true,
  });
  await s.blocks(wolf, [
    {
      type: "paragraph",
      text: "Took eighty pages to work out who 'he' is, and then it was the best thing read all year.",
    },
  ]);
  await s.row(dbId, "The Dispossessed", {
    [author]: "Ursula K. Le Guin",
    [status]: st.Reading,
    [genre]: [g["Sci-fi"], g.Classic],
    [owned]: true,
  });
  await s.row(dbId, "Thinking in Systems", {
    [author]: "Donella Meadows",
    [status]: st.Finished,
    [genre]: [g["Non-fiction"]],
    [rating]: 4,
    [finished]: "2026-04-08",
    [owned]: false,
    [link]: "https://en.wikipedia.org/wiki/Donella_Meadows",
  });
  await s.row(dbId, "A Wizard of Earthsea", {
    [author]: "Ursula K. Le Guin",
    [status]: st["To read"],
    [genre]: [g.Fantasy, g.Classic],
    [owned]: true,
  });
  await s.row(dbId, "The Idea Factory", {
    [author]: "Jon Gertner",
    [status]: st["To read"],
    [genre]: [g["Non-fiction"]],
    [owned]: false,
  });
  await s.row(dbId, "Consider the Lobster", {
    [author]: "David Foster Wallace",
    [status]: st.Reading,
    [genre]: [g.Essays],
    [rating]: 4,
    [owned]: true,
  });
  await s.row(dbId, "Station Eleven", {
    [author]: "Emily St. John Mandel",
    [status]: st.Finished,
    [genre]: [g["Sci-fi"]],
    [rating]: 4.5,
    [finished]: "2025-12-29",
    [owned]: false,
  });

  await s.view(dbId, "table", {
    sort: { propertyId: rating, direction: "desc" },
  });
  await s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is", value: st["To read"] }],
  });
  await s.view(dbId, "board", { groupBy: status });
}

async function seedTripPlanner(s: Seeder, travelId: string): Promise<void> {
  const dbId = await s.page({
    parent: travelId,
    title: "Trip Planner",
    icon: "🧭",
    type: "database",
  });
  const status = await s.property(dbId, "Status", "select");
  const st = await s.options(status, [
    ["Dreaming", "gray"],
    ["Planning", "blue"],
    ["Booked", "green"],
    ["Done", "purple"],
  ]);
  const region = await s.property(dbId, "Region", "select");
  const rg = await s.options(region, [
    ["Europe", "teal"],
    ["Asia", "pink"],
    ["Americas", "orange"],
  ]);
  const vibes = await s.property(dbId, "Vibes", "multi_select");
  const vb = await s.options(vibes, [
    ["Food", "amber"],
    ["Hiking", "green"],
    ["Culture", "purple"],
    ["Beach", "blue"],
  ]);
  const budget = await s.property(dbId, "Budget", "number");
  const depart = await s.property(dbId, "Depart", "date");
  const flights = await s.property(dbId, "Flights booked", "checkbox");
  const guide = await s.property(dbId, "Guide", "url");

  const japan = await s.row(dbId, "Japan, ten days", {
    [status]: st.Booked,
    [region]: rg.Asia,
    [vibes]: [vb.Food, vb.Culture],
    [budget]: 4800,
    [depart]: "2026-10-14",
    [flights]: true,
    [guide]: "https://japan-guide.com",
  });
  await s.blocks(japan, [
    {
      type: "paragraph",
      text: "Flights on points, ryokan paid. Ground plan lives in the Japan 2026 page.",
    },
    { type: "todo", text: "Reserve the cedar-bath ryokan", checked: true },
    { type: "todo", text: "Activate rail pass on day 2", checked: false },
  ]);
  await s.row(dbId, "Lisbon long weekend", {
    [status]: st.Planning,
    [region]: rg.Europe,
    [vibes]: [vb.Food, vb.Beach],
    [budget]: 900,
    [depart]: "2026-09-05",
    [flights]: false,
  });
  await s.row(dbId, "Dolomites hut to hut", {
    [status]: st.Dreaming,
    [region]: rg.Europe,
    [vibes]: [vb.Hiking],
    [budget]: 1500,
    [flights]: false,
    [guide]: "https://www.alta-badia.org",
  });
  await s.row(dbId, "Mexico City", {
    [status]: st.Dreaming,
    [region]: rg.Americas,
    [vibes]: [vb.Food, vb.Culture],
    [budget]: 1700,
    [flights]: false,
  });
  await s.row(dbId, "Scottish Highlands", {
    [status]: st.Done,
    [region]: rg.Europe,
    [vibes]: [vb.Hiking],
    [budget]: 700,
    [depart]: "2026-04-18",
    [flights]: true,
  });

  await s.view(dbId, "board", { groupBy: status });
  await s.view(dbId, "table", {
    sort: { propertyId: depart, direction: "asc" },
  });
}

async function seedProjectTracker(
  s: Seeder,
  projectsId: string,
): Promise<void> {
  const dbId = await s.page({
    parent: projectsId,
    title: "Project Tracker",
    icon: "🎯",
    type: "database",
  });
  const status = await s.property(dbId, "Status", "select");
  const st = await s.options(status, [
    ["Backlog", "gray"],
    ["In progress", "blue"],
    ["Blocked", "red"],
    ["Shipped", "green"],
  ]);
  const owner = await s.property(dbId, "Owner", "text");
  const tags = await s.property(dbId, "Tags", "multi_select");
  const tg = await s.options(tags, [
    ["hardware", "orange"],
    ["software", "blue"],
    ["writing", "purple"],
    ["home", "teal"],
  ]);
  const effort = await s.property(dbId, "Effort (days)", "number");
  const due = await s.property(dbId, "Due", "date");
  const funded = await s.property(dbId, "Budgeted", "checkbox");
  const spec = await s.property(dbId, "Spec", "url");

  const migrate = await s.row(dbId, "Migrate home lab services", {
    [status]: st["In progress"],
    [owner]: "Marco",
    [tags]: [tg.hardware, tg.software],
    [effort]: 6,
    [due]: "2026-08-30",
    [funded]: true,
    [spec]: "https://wiki.internal/homelab-plan",
  });
  await s.blocks(migrate, [
    { type: "heading3", text: "Order of operations" },
    { type: "numbered", text: "DNS and reverse proxy last" },
    { type: "numbered", text: "Media server first, nobody notices downtime" },
    { type: "callout", text: "Snapshot before every move." },
  ]);
  await s.row(dbId, "Drip irrigation for the balcony", {
    [status]: st.Shipped,
    [owner]: "Marco",
    [tags]: [tg.home],
    [effort]: 2,
    [due]: "2026-05-15",
    [funded]: true,
  });
  await s.row(dbId, "Slow tools essay", {
    [status]: st["In progress"],
    [owner]: "Marco",
    [tags]: [tg.writing],
    [effort]: 3,
    [due]: "2026-07-31",
    [funded]: false,
  });
  await s.row(dbId, "E-ink hallway dashboard", {
    [status]: st.Backlog,
    [owner]: "Marco",
    [tags]: [tg.hardware, tg.software],
    [effort]: 5,
    [funded]: false,
  });
  await s.row(dbId, "Fix the wobbly bookshelf", {
    [status]: st.Blocked,
    [owner]: "Anna",
    [tags]: [tg.home],
    [effort]: 1,
    [funded]: false,
  });
  const restore = await s.row(dbId, "Bike restoration", {
    [status]: st["In progress"],
    [owner]: "Marco",
    [tags]: [tg.hardware, tg.home],
    [effort]: 8,
    [due]: "2026-10-04",
    [funded]: true,
  });
  await s.blocks(restore, [
    {
      type: "paragraph",
      text: "Frame and hubs done. Cables next, then a decision about the shifters.",
    },
  ]);
  await s.row(dbId, "Sourdough schedule that survives a work week", {
    [status]: st.Shipped,
    [owner]: "Marco",
    [tags]: [tg.home, tg.writing],
    [effort]: 2,
    [due]: "2026-06-20",
    [funded]: false,
  });
  await s.row(dbId, "Photo backup, offsite copy", {
    [status]: st.Backlog,
    [owner]: "Marco",
    [tags]: [tg.software],
    [effort]: 3,
    [funded]: false,
  });
  await s.row(dbId, "Replace the hallway light switch", {
    [status]: st.Blocked,
    [owner]: "Marco",
    [tags]: [tg.home],
    [effort]: 1,
    [due]: "2026-09-06",
    [funded]: true,
  });

  await s.view(dbId, "board", { groupBy: status });
  await s.view(dbId, "table", { sort: { propertyId: due, direction: "asc" } });
  await s.view(dbId, "list", {
    filters: [{ propertyId: status, operator: "is_not", value: st.Shipped }],
  });
}
