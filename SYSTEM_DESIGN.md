# System Design

## The gap the objective doesn't scope

The objective says admins need to see "which issues keep coming back," but no scope-of-work
bullet asks for recurrence detection or a regression link — only a status/priority lifecycle and
an SLA. The design closes the gap anyway: `regressedFromId` links a new complaint to the most
recently resolved complaint in the same `(unit, category)` within a rolling window, and a
recurrence panel surfaces units crossing a count threshold in that window (e.g. "A-303: 3
water/plumbing complaints in 27 days"). Both are derived at read time from data the lifecycle
already needed — no new table.

## 1. Complaint history model

**Decision**: complaint state is a denormalized projection (`status`, `priority`, `isEscalated`,
`lastActivityAt` on `Complaint`) written in the same transaction as an append to
`ComplaintEvent`, an append-only ledger with a monotonic `seq`. `applyTransition()` is the only
function permitted to touch either.

**Rejected**: a single mutable `Complaint.status` column with a separate `ComplaintHistory` table
populated as a side effect of updating it.

**Why**: a side-effect history table can fall out of sync with the row it describes — the write to
`Complaint` can succeed while the write to history fails, or lands in a different transaction.
With ledger-plus-projection the projection is *derived from* the ledger by construction: the same
transaction that changes state records why, so they cannot drift. A wrong projection is rebuildable
from the ledger; the ledger itself is never wrong, because nothing writes to it except transitions
that also update the row it describes. History-of-a-mutable-row can't offer that — state and its
history are always two separate writes, two chances to diverge.

## 2. Overdue detection

**Decision**: overdue is computed at read time — `status != RESOLVED AND age >
slaPolicy(category, priority).hours` — joined against an `SlaPolicy` table keyed on `(category,
priority)`. No `isOverdue` or `slaDueAt` column exists.

**Rejected**: a stored `isOverdue` boolean (or `slaDueAt` timestamp), flipped by a cron job
sweeping open complaints on a schedule.

**Why**: a stored flag is only as fresh as the last sweep, decoupling "overdue" from the matrix
that defines it — edit a policy's hours and every open complaint keeps describing a rule that no
longer applies until the next sweep. Deriving it at read time means an SLA edit changes the
overdue set for every open complaint immediately, with nothing to backfill. The cost is a join on
every list read instead of an indexed scan — the right trade at this scale. This is also what
makes `priority` functional, not decorative: overdue is keyed on `(category, priority)` together,
so a HIGH-priority lift complaint and a LOW-priority housekeeping complaint are judged against
genuinely different clocks — bumping priority changes which SLA rule applies, not just a badge
color.

## 3. Photo handling

**Decision**: the browser requests a signed upload from `/api/uploads/sign` — the server validates
declared mime type and size, then signs Cloudinary's upload params — uploads the file directly to
Cloudinary, and posts back only the resulting `public_id`/`secure_url`.

**Rejected**: the browser uploads the file to a Next.js route handler, which streams or buffers it
through to Cloudinary's API.

**Why**: proxying bytes makes the app's own compute and memory the bottleneck for something it has
no reason to touch — a 5MB photo would occupy a serverless function's lifetime for no benefit over
Cloudinary receiving it directly. Signed direct upload keeps the server's involvement to what
requires trust — deciding *whether* an upload should be allowed, and vouching for that with a
signature — and removes it entirely from the bytes themselves. The tradeoff: validation is
declaration-based, since the server never inspects the bytes; `allowed_formats` on the signed
params is what Cloudinary itself enforces against the real file.

## 4. Notification flow

**Decision**: request handlers never send mail. A state change enqueues `OutboxMessage` rows in
the same transaction as the change; a separate drain route claims `PENDING` rows due now, sends
over SMTP, and commits each message's outcome independently — `SENT`, or attempts incremented with
`lastError` and exponential backoff, or `FAILED` past 5 attempts.

**Rejected**: sending inline from the request handler that changed state.

**Why**: this ran into real evidence during development. Draining against Mailtrap's rate-limited
sandbox mid-batch, the provider rejected messages partway through: 9 sent, 16 rescheduled with the
literal SMTP error recorded and `nextAttemptAt` pushed out by backoff. The next drain call
correctly skipped the backed-off messages and only claimed fresh ones. Inline sending forces a
choice between two bad outcomes: let a flaky provider fail the status update that triggered it, or
catch and silently ignore the failure, with no retry and no record a notification was owed. The
outbox makes both impossible — the state change always commits, and mail delivery fails, retries,
and eventually gives up, without the two ever touching.
