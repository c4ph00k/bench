> The original product brief for Rolodex, kept for intent and scope. It was written for a
> standalone repo, so it describes its own server, ports and commands; inside Bench the app is
> one of four, served by the shared server on :8100. The phased plan below describes a build that
> is **complete** - history, not outstanding work. For how Rolodex is actually built, read
> [IMPLEMENTATION.md](./IMPLEMENTATION.md).

# Rolodex — Requirements

## Summary

Rolodex is a personal CRM you run on your own computer — a private, thoughtful address book for the
people in your life. It helps one person keep track of their friends, family and colleagues: who they
are, when you last spoke, what's going on with them right now, and when you're overdue a catch-up. It
runs locally, needs no login, and works entirely on your machine.

The goal is a clean, focused tool that does the everyday essentials really well: a searchable list of
your people; birthdays and important dates you'll never miss again; a log of every conversation and
the little facts worth remembering; a nudge when someone's slipped off your radar; and a daily view
that tells you who to reach out to today. It should feel sharp and personal, and be genuinely
pleasant to use.

The idea it's modelled on is simple: relationships fade by accident, not on purpose. The app's job is
to notice before you do.

## Platform

The app has five sections in the main navigation. On first launch it comes pre-loaded with realistic
sample data, so every screen looks alive immediately.

- **Today** (the landing page) — what needs your attention: people you're due or overdue to contact,
  birthdays and important dates coming up in the next month, reminders due or overdue, a feed of
  recent activity, and a couple of simple charts showing how you're doing at staying in touch.
- **People** — everyone in your Rolodex. A searchable table you can filter by circle and by tag.
  **Add, search, edit and delete.** Click a person to open their page: their details, their latest
  news, the facts you want to remember about them, their important dates, their gift list, who they're
  connected to, and a full timeline of everything you've logged.
- **Circles** — your people as a visual board: cards in columns, one column per circle. Drag a person
  from one column to another to change their circle. Circles, from closest outwards:
  **Inner → Close → Wider → Distant**. A person's circle sets how often you want to be in touch with
  them, so this board is really where you decide who gets your attention.
- **Calendar** — a month grid of birthdays and important dates, so you can see what's coming and plan
  around it.
- **Timeline** — everything that's happened, across everyone, newest first: interactions you've
  logged, news you've recorded, reminders you've completed. Filterable by person and by type.

From any person's page you can log an interaction (a call, message, email, meet-up or other), record
a piece of news, add a fact worth remembering, note a gift idea, or set a reminder with a due date
which then shows up on Today.

## Staying in touch — how it works

This is the heart of the app, so it's worth spelling out.

- Every person belongs to one of four **circles**, and each circle carries a default **check-in
  cadence**: Inner = monthly, Close = quarterly, Wider = every six months, Distant = yearly.
- Any person can **override** their cadence individually, or opt out of check-ins altogether.
- **Last contacted is never typed by hand.** It's the date of the most recent interaction you logged
  with that person. Logging an interaction resets the clock.
- A person's **check-in status** is derived: _in touch_, _due soon_ (within the next week), or
  _overdue_. Today lists the due and overdue ones, most overdue first.
- A person can be **snoozed** until a date — they're on your list, but they stop nudging you (they're
  travelling, you've just seen them, whatever the reason).

## What Rolodex remembers

In plain English. How any of this is structured, named or stored is entirely the Coding Agent's call.

- **The people themselves** — name, photo, email, phone, job title, company, the city they're in and
  their time zone (so you know whether it's a sensible hour to call), which circle they're in, how
  often you want to be in touch, any snooze date, how and where and when you met, freeform notes, and
  simple text tags (family, university, cycling, ex-colleague) you can filter by.
- **Times you were actually in contact** — a call, message, email, meet-up or something else, on a
  date, with notes on what you talked about. This is where _last contacted_ comes from.
- **Dates that come round every year** — birthdays, anniversaries, work anniversaries, a child's
  birthday, anything else. The year may or may not be known; where it is, the app can show an age or
  flag a milestone birthday.
- **Facts worth remembering** — small and durable. Allergic to shellfish. Partner is Sam. Supports
  Arsenal.
- **News** — dated and changeable. Started at Figma. Moved to Berlin. Second baby due in March. The
  most recent piece of news is that person's **latest news**, shown at the top of their page and in
  the People table.
- **Reminders** — something you need to do about someone, with a due date and a done / not-done
  state.
- **Connections between people** — partner, parent, child, sibling, colleague at, introduced me to.
  Visible from both people and clickable, so you can walk from one person to another.
- **Gifts** — ideas, things given and things received, with an occasion and a date. Ideas for a
  person surface on their page as one of their dates approaches.

## High-level technical guidance

Just enough direction to keep things on track — specific choices are left to the Coding Agent.

- Build it as a single web app using **Vite, React and TypeScript**.
- It runs fully locally and starts with **one simple command**; no accounts, no cloud, no internet
  needed to use it.
- It stores its data **locally on the machine** in a **SQLite** database file, photos included.
- **Prefer popular, well-supported libraries over custom code** — for the data table, the charts, the
  drag-and-drop board, the calendar grid, date handling, and reading vCard and CSV files. Don't
  hand-roll what a mature library does well.
- Keep the implementation simple and conventional. Library, data and structure choices are the Coding
  Agent's call, as long as the requirements and the success criteria below are met.
- The app will be running in a VS Code dev container with ports mapped on the host computer; ensure
  the server is configured so that it can be viewed in a browser on the host computer.

## Not in scope (v1)

Deliberately left out to keep this small and focused. Do not build these:

- No login, user accounts, multiple users or permissions — it's single-user and local.
- No AI features (these come later).
- No email, calendar, phone or social integrations, and no contact syncing. Import is a one-off,
  one-directional thing (see Phase 2); there is no export.
- No push notifications, emails or desktop alerts — nudges appear in the app only, on Today.
- No journal or diary. This app is about people, not days.
- No reporting or analytics beyond the Today dashboard described above.
- No custom fields. Tags are free text, but there are no user-defined field types.
- Circles are fixed at four and are not user-configurable, though their default cadences can be
  changed in the build if a better set is obvious.
- No table pagination.

## Look and feel

Applies to the whole app:

- Make it **sharp and modern, but still clean and professional**.
- Use the color palette **`#ecad0a` (amber), `#209dd7` (blue) and `#753991` (purple)**, together
  with grays.
- **Avoid** these — they read as generic "AI-generated" tells: background gradients, purple
  backgrounds, buttons with gradients, and panels or cards with a single accent border line down one
  side.
- Include visual / icon elements for main nav items, for edit and delete actions on table rows, for
  interaction types, and where it makes sense, but avoid unnecessary emojis.
- People should have a **photo** wherever they appear — in the table, on the board, on their page, in
  feeds. Where there's no photo, fall back to their initials on a flat color derived from their name.
  This is what makes the app feel personal rather than administrative.
- Check-in status needs a clear, calm visual language — overdue should be noticeable without the
  whole app looking like an alarm going off.

## Phases and success criteria

Build in these phases, in order. **Do not start a phase until every success criterion of the
previous phase is demonstrably met** — each criterion must be something you can actually show
working, not just assert.

### Phase 1 — Running skeleton and data

**Features**

- A single local web app with the five navigation sections (Today, People, Circles, Calendar,
  Timeline).
- Local storage for everything under _What Rolodex remembers_.
- A seed step that fills it with realistic sample data.
- Unit tests to create, read, update and delete every kind of thing the app stores.

**Success criteria**

1. One documented command starts the app, and opening the given URL shows Rolodex with all five
   navigation sections.
2. The app launches already populated with realistic sample data: at least 30 people, no circle
   empty, every person with a photo or initials, at least one birthday falling in each of the next
   three months, interactions going back at least a year, and at least one of every other thing the
   app remembers.
3. The unit tests for creating, reading, updating and deleting each kind of thing all pass.

### Phase 2 — People

**Features**

- A People table listing everyone, with photo, name, company, circle, last contacted and latest news.
- Add, edit and delete a person, including uploading a photo.
- A search box, a filter by circle, and a filter by tag.
- A person's page showing their details and notes.
- Importing people from a **CSV or vCard (.vcf)** file: pick a file, map the columns, preview what
  will be added, then import. Likely duplicates are flagged, not silently created.
- Unit tests for the add / edit / delete / search behavior and for parsing an import file.

**Success criteria**

1. People shows a table listing the sample people, each with a photo or initials fallback.
2. Adding, editing or deleting a person persists — the change is still there after a browser refresh.
3. Typing in the search box narrows the list to matching people; people are searchable by at least
   name, company and email.
4. Filtering by a circle, or by a tag, shows only matching people.
5. Clicking a row opens that person's page, showing their details.
6. A CSV file and a vCard file can each be imported, and the number and content of the people added
   match what the preview showed.
7. Importing a file containing someone already in the Rolodex flags them for the user to resolve
   rather than creating a second copy.
8. The unit tests for add / edit / delete / search and for import parsing all pass.

### Phase 3 — Circles and staying in touch

**Features**

- The Circles board: people as cards in four columns (Inner, Close, Wider, Distant).
- Drag-and-drop of a person's card between columns to change their circle.
- Each person has a check-in cadence, defaulting from their circle, individually overridable, with
  the option to turn check-ins off for that person.
- Derived check-in status (in touch / due soon / overdue) shown on the card, in the People table, and
  on the person's page.
- Snoozing a person until a date.
- Unit tests for cadence and status calculation, including the overrides, the off switch and snoozing.

**Success criteria**

1. The Circles board shows one column per circle, each person as a card in the correct column, with
   their photo, last contacted and check-in status.
2. Dragging a person's card to another column changes their circle, and the change persists after a
   refresh and matches the People table. Each column's header count and its number of overdue people
   refresh automatically.
3. The board shows fully where possible, filling horizontal space, only showing scrollbars when
   needed.
4. Changing a person's cadence changes their status correctly; turning check-ins off removes them
   from the due list entirely; snoozing removes them until the snooze date passes.
5. The unit tests for cadence, status, overrides and snoozing all pass.

### Phase 4 — Interactions, notes and reminders

**Features**

- Logging an interaction (call, message, email, met up, other) from a person's page, with a date and
  notes.
- An interaction timeline on each person's page, newest first.
- Last contacted and check-in status recalculating from the newest interaction.
- Adding facts and news to a person; the newest news showing as their latest news.
- Reminders with a due date and a done / not-done state.
- The Timeline section: everything across everyone, newest first, filterable by person and type.
- Unit tests for logging interactions, recalculating last contacted, and toggling reminders.

**Success criteria**

1. From a person's page you can log an interaction, and it appears in their timeline, newest first.
2. Logging an interaction updates that person's last contacted date and check-in status immediately,
   everywhere they appear.
3. Adding a piece of news makes it that person's latest news, on their page and in the People table.
4. Facts are shown as a distinct, compact list on the person's page — separate from freeform notes.
5. A reminder can be created with a due date and marked done or not-done, and that persists after a
   refresh.
6. The Timeline section shows activity across all people, newest first, and its person and type
   filters work.
7. The unit tests for interactions, last-contacted recalculation and reminder completion all pass.

### Phase 5 — Important dates and the calendar

**Features**

- Adding important dates to a person: birthday, anniversary, work anniversary, child's birthday,
  other — with or without a known year.
- Age or "turns 40 this year" shown where the year is known.
- The Calendar section: a month grid showing whose dates fall when, navigable forward and back.
- Upcoming dates shown on a person's page and used by Today in Phase 7.
- Unit tests for recurring-date arithmetic, including a 29 February birthday and dates in the next
  calendar year.

**Success criteria**

1. A person can be given one or more important dates, with or without a year, and they appear on
   their page.
2. Where the year is known, the app shows the correct current age, and flags a birthday as a
   milestone when the age being reached this year ends in a zero.
3. The Calendar shows a month grid with each person's dates on the right days, and navigating
   between months works, including across a year boundary.
4. Clicking a date in the calendar opens that person.
5. A 29 February birthday is handled sensibly in a non-leap year and does not crash or disappear.
6. The unit tests for recurring-date arithmetic all pass.

### Phase 6 — Gifts and connections

**Features**

- A gift list on a person's page: ideas, given and received, with an occasion and a date.
- Gift ideas surfacing on a person's page when one of their important dates is approaching.
- Connections between two people, with a label, created from either person's page.
- Connections shown on both people's pages and clickable to navigate between them.
- Unit tests for gifts and for connections being visible and correct from both sides.

**Success criteria**

1. A gift can be added to a person as an idea, marked as given, or recorded as received, and that
   persists.
2. When a person has an important date coming up within 30 days, their outstanding gift ideas are
   surfaced on their page.
3. A connection created from one person's page appears on the other person's page too, reading
   correctly from that side (recording that Sam is Kate's parent means Kate shows as Sam's child),
   and clicking it navigates there.
4. Deleting a person does not leave broken connections on anyone else's page.
5. The unit tests for gifts and connections all pass.

### Phase 7 — Today

**Features**

- Today as the landing page.
- Who to contact: people due and overdue, most overdue first, with a one-click way to log an
  interaction straight from the list.
- Birthdays and important dates in the next 30 days.
- Reminders due and overdue.
- A feed of recent activity across everyone.
- Simple charts: interactions logged per month, and people per circle showing how many in each are
  overdue.

**Success criteria**

1. Today is the landing page and shows: who to contact, upcoming dates, due and overdue reminders, a
   recent-activity feed, and the two charts.
2. The figures shown match the underlying data (e.g. the overdue count for a circle equals what's in
   the data, and the interactions-per-month chart matches the logged interactions).
3. Logging an interaction from Today removes that person from the who-to-contact list and updates the
   charts on refresh.
4. Marking a reminder done, adding news, or changing someone's circle is reflected on Today on
   refresh.
5. With nothing due, overdue or upcoming, every panel on Today still shows a written empty state
   saying so — no blank or collapsed panels.
6. Who to contact is the most prominent thing on the page, above and larger than everything else.

### Phase 8 — Look and feel, and end-to-end validation

**Features**

- The look-and-feel rules applied across the whole app (brand palette with grays; sharp, modern,
  clean, professional; photos everywhere; calm status language).
- Removal of any banned elements (background gradients, purple backgrounds, gradient buttons,
  single-side accent border lines).
- A full end-to-end walkthrough of the running app in a real browser, with visual inspection of every
  screen.

**Success criteria**

1. The whole app follows the look-and-feel rules and contains none of the banned elements.
2. The Coding Agent has driven the running app in a real browser end to end — added, edited, searched
   and deleted a person; imported a file; dragged someone between circles; logged an interaction and
   watched their status change; added a birthday and found it on the calendar; added a gift and a
   connection; set and completed a reminder; and viewed Today — visually inspecting every screen, not
   just running unit tests.
3. No errors appear in the browser console during that walkthrough.

## Final success criteria

The project is complete, and the Coding Agent may stop, when **all** of the following are true:

- A non-technical person can start the app with a single documented command and open it in a browser.
- All five sections work: Today, People, Circles, Calendar, Timeline.
- People support add, search, edit and delete, and everything the app remembers persists across
  refreshes.
- People can be imported from a CSV or vCard file, with duplicates flagged rather than created.
- The Circles board supports drag-to-change-circle, and the new circle persists.
- Staying in touch actually works: last contacted derives from logged interactions, check-in status
  is correct for every cadence, and snoozing and opting out both behave.
- Birthdays and important dates are correct, including ages and a 29 February birthday, and the
  calendar shows them on the right days.
- Interactions, notes, reminders, gifts and connections all work, and Today accurately reflects the
  data.
- The app ships with realistic sample data, so it looks alive on first launch.
- The look-and-feel rules are met and none of the banned elements appear anywhere.
- Today looks stunning: compelling information, well presented, with the person you most need to
  contact impossible to miss.
- The drag and drop on the Circles board works well, column counts update, scrollbars don't show
  unless necessary.
- All unit tests pass.
- **Most importantly: the product has been validated by actually using it end to end in a real
  browser — clicking through every section as a real user would, performing the actions above, and
  visually inspecting each screen. Passing unit tests is necessary but NOT sufficient; the Coding
  Agent must confirm the running product works and looks right, not merely that the tests are green.**
