# Society Maintenance Tracker

Apartment society complaint management. Residents raise complaints with photos;
admins triage them through a lifecycle with priorities, SLAs, and a notice board.

This file defines the invariants of the system. They are not suggestions.
If a task seems to require breaking one, stop and say so instead of working around it.

---

## Stack

- Next.js 14 (App Router) + TypeScript, strict mode
- Prisma + PostgreSQL (Neon)
- NextAuth (credentials provider, JWT sessions)
- Zod for all input validation
- Cloudinary for photo storage (signed direct upload)
- Nodemailer over SMTP for email
- Vitest for tests
- Tailwind for styling

---

## The core idea

**A complaint is an append-only ledger. Its current state is a projection of that ledger.**

Every meaningful change writes a `ComplaintEvent`. The mutable columns on `Complaint`
(`status`, `priority`, `isEscalated`, `lastActivityAt`) are a denormalized read model,
written in the same transaction as the event so they cannot drift.

The ledger is the truth. The projection is a cache.

---

## Hard invariants

### 1. Status is never mutated directly

There is exactly one function that changes complaint state: `applyTransition()` in
`lib/complaints/transition.ts`.

Never write `prisma.complaint.update({ data: { status } })` anywhere else. Not in a
route handler, not in a script, not in a seed file. If you need a state change, call
`applyTransition()`.

### 2. Event, projection, and outbox are written in one transaction

Every call to `applyTransition()` performs, inside a single `prisma.$transaction`:

1. Append a `ComplaintEvent` (next `seq` for that complaint)
2. Update the `Complaint` projection columns
3. Increment `Complaint.version`
4. Insert `OutboxMessage` rows for any notifications this change triggers

All four, or none. Never split them across transactions.

### 3. Overdue is never stored

There is no `isOverdue` column and no `slaDueAt` column. Overdue is computed at read
time as:

```
status != 'RESOLVED' AND (now() - createdAt) > slaPolicy.hours
```

where `slaPolicy` is matched on `(category, priority)`.

This means editing the SLA matrix instantly re-evaluates every open complaint with no
backfill. Preserving that property is the whole point — do not "optimize" it into a
stored column.

Admin list queries use raw SQL (`prisma.$queryRaw`) to join `SlaPolicy` and sort by
overdue status. Single-complaint reads use the `isOverdue()` helper in
`lib/complaints/sla.ts`.

### 4. No email is ever sent from a request handler

Request handlers enqueue `OutboxMessage` rows. A separate drain route
(`/api/admin/outbox/drain`) sends them, with attempt counts, `lastError`, and backoff
via `nextAttemptAt`.

A failing mail provider must never fail a status update, and never roll one back.

### 5. Authorization is enforced in the data layer, not in handlers

Residents never receive a query that could touch another resident's rows. Scoping
happens where the query is built (`lib/db/scopes.ts`), not as an `if` check at the top
of a handler.

A resident requesting another resident's complaint ID gets a 404 — because the row was
never in the query's universe, not because a guard caught it.

### 6. Writes require a version for optimistic concurrency

Mutating endpoints accept the `version` the client last read. `applyTransition()`
updates with `where: { id, version }`. Zero rows affected means someone else changed it
first — return `409 Conflict` with the current state. Never silently overwrite.

### 7. Every input is validated with Zod at the boundary

No `any`. No trusting `req.json()`. The Zod schemas in `lib/schemas/` are also the
source for the generated OpenAPI spec, so they must accurately describe the API.

---

## Lifecycle rules

Legal transitions, defined in `lib/complaints/transition.ts` as a declarative map:

```
OPEN        -> IN_PROGRESS, RESOLVED
IN_PROGRESS -> RESOLVED
RESOLVED    -> (terminal)
```

`RESOLVED` is terminal. A resolved complaint is closed and can never reopen.

When a resident raises a new complaint with the same `category` and `unitId` as a
complaint resolved within the regression window, the new complaint's
`regressedFromId` links to it. The old complaint stays closed. The chain stays visible.

The API exposes the legal next transitions for a complaint so the UI can render only
actions that will succeed. The server validates independently — the UI hint is a
convenience, never the enforcement.

---

## Derived concepts (never stored)

| Concept | Computed as |
|---|---|
| Overdue | `status != RESOLVED AND age > slaPolicy(category, priority).hours` |
| Recurring | `>= N` complaints, same `(unitId, category)`, within the recurrence window |
| Regression | New complaint within window of a `RESOLVED` one, same `(unitId, category)` |
| Time in status | `now() - lastActivityAt` |

`N` and the window come from the `Setting` table, admin-editable.

---

## Layout

```
app/
  (auth)/            login, register
  resident/          complaint list, detail, new complaint
  admin/             queue, complaint detail, notices, dashboard, system
  api/               route handlers only — no business logic
lib/
  complaints/        transition.ts, sla.ts, recurrence.ts
  db/                scopes.ts, client.ts
  outbox/            enqueue.ts, drain.ts
  schemas/           zod schemas (also feed OpenAPI generation)
  auth/
prisma/
  schema.prisma, seed.ts
tests/
```

Route handlers are thin: parse with Zod, call a `lib/` function, serialize. Business
logic never lives in `app/api/`.

---

## Conventions

- Every new model gets seed data. An empty deployed app is a failed deliverable.
- Seed data must be realistic: ~40 complaints across ~3 months, spanning all statuses,
  with deliberate regressions and overdue cases so the dashboard has real shape.
- Timestamps are always `DateTime` in UTC. Format at render time only.
- Money and durations are integers (hours), never floats.
- Prefer explicit over clever. This code is read by an evaluator, not just executed.

---

## What not to build

Do not add, even if it seems helpful:

- LLM / AI features of any kind (auto-categorization, chatbots, summarization)
- WebSockets or real-time push
- Docker, microservices, or any multi-service deployment
- A separate backend server — this is one Next.js app

Scope creep on this project is a net negative. Depth on what exists beats breadth.

---

## Definition of done for any phase

1. It runs locally without errors
2. Its tests pass
3. Seed data exercises it
4. No invariant above was violated to make it work
