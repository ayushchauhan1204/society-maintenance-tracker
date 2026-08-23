import { PrismaClient, Role, Category, Priority, Status } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createComplaint } from "../src/lib/complaints/create";
import { applyTransition, type ApplyTransitionInput } from "../src/lib/complaints/transition";
import { createNotice } from "../src/lib/notices/create";

const prisma = new PrismaClient();

// Known dev password for every seeded user, so local login works without
// looking up hashes.
export const DEV_PASSWORD = "Password123!";

const UNITS: { block: string; number: string }[] = [
  { block: "A", number: "101" },
  { block: "A", number: "202" },
  { block: "A", number: "303" },
  { block: "A", number: "404" },
  { block: "B", number: "101" },
  { block: "B", number: "202" },
  { block: "B", number: "303" },
  { block: "B", number: "404" },
  { block: "C", number: "101" },
  { block: "C", number: "202" },
  { block: "C", number: "303" },
  { block: "C", number: "404" },
];

const RESIDENTS: { name: string; email: string; unitLabel: string }[] = [
  { name: "Aarav Sharma", email: "aarav.sharma@example.com", unitLabel: "A-101" },
  { name: "Priya Nair", email: "priya.nair@example.com", unitLabel: "A-202" },
  { name: "Rohan Mehta", email: "rohan.mehta@example.com", unitLabel: "A-202" },
  { name: "Sneha Iyer", email: "sneha.iyer@example.com", unitLabel: "A-303" },
  { name: "Vikram Rao", email: "vikram.rao@example.com", unitLabel: "A-404" },
  { name: "Ananya Desai", email: "ananya.desai@example.com", unitLabel: "B-101" },
  { name: "Karan Malhotra", email: "karan.malhotra@example.com", unitLabel: "B-202" },
  { name: "Divya Reddy", email: "divya.reddy@example.com", unitLabel: "B-303" },
  { name: "Arjun Kapoor", email: "arjun.kapoor@example.com", unitLabel: "B-303" },
  { name: "Neha Joshi", email: "neha.joshi@example.com", unitLabel: "B-404" },
  { name: "Siddharth Menon", email: "siddharth.menon@example.com", unitLabel: "C-101" },
  { name: "Kavya Pillai", email: "kavya.pillai@example.com", unitLabel: "C-202" },
  { name: "Rahul Verma", email: "rahul.verma@example.com", unitLabel: "C-303" },
  { name: "Ishita Bose", email: "ishita.bose@example.com", unitLabel: "C-404" },
];

const ADMIN = { name: "Meera Kulkarni", email: "admin@societytracker.test" };

// Safety-critical categories (LIFT, ELECTRICAL, SECURITY) get tight SLAs;
// cosmetic ones (HOUSEKEEPING, COMMON_AREA) get loose ones. HIGH is always
// meaningfully tighter than LOW within a category.
const SLA_HOURS: Record<Category, Record<Priority, number>> = {
  LIFT: { HIGH: 2, MEDIUM: 6, LOW: 12 },
  ELECTRICAL: { HIGH: 2, MEDIUM: 8, LOW: 24 },
  SECURITY: { HIGH: 1, MEDIUM: 4, LOW: 12 },
  WATER_PLUMBING: { HIGH: 4, MEDIUM: 12, LOW: 48 },
  PARKING: { HIGH: 8, MEDIUM: 24, LOW: 72 },
  OTHER: { HIGH: 8, MEDIUM: 24, LOW: 72 },
  HOUSEKEEPING: { HIGH: 24, MEDIUM: 48, LOW: 120 },
  COMMON_AREA: { HIGH: 24, MEDIUM: 72, LOW: 168 },
};

const SETTINGS: { key: string; value: string }[] = [
  { key: "recurrence_window_days", value: "60" },
  { key: "recurrence_threshold_count", value: "3" },
];

const NOTICES: { title: string; body: string; isImportant: boolean }[] = [
  {
    title: "Water tank cleaning scheduled for this Saturday",
    body: "The overhead water tanks for all three blocks will be cleaned this Saturday between 9 AM and 1 PM. Water supply will be interrupted during this window — please store water in advance.",
    isImportant: true,
  },
  {
    title: "Annual general body meeting — save the date",
    body: "The AGM will be held in the clubhouse on the last Sunday of next month at 6 PM. Agenda includes the annual maintenance budget review and committee elections.",
    isImportant: true,
  },
  {
    title: "Diwali decoration guidelines",
    body: "Residents are welcome to decorate their doors and balconies for Diwali. Please avoid open flames in common corridors and ensure electrical decorations are switched off overnight.",
    isImportant: false,
  },
  {
    title: "New visitor parking policy",
    body: "Starting next month, visitor vehicles parked beyond 2 hours without security desk registration will be clamped. Please inform your guests in advance.",
    isImportant: false,
  },
];

// ---------------------------------------------------------------- complaints
//
// Deferred from phase 1: complaints must go through createComplaint() and
// applyTransition(), which now exist. Every complaint below is authored
// deliberately — specific units with specific recurring problems — rather
// than generated, so the dashboard has a real shape instead of noise.
//
// createdHoursAgo is measured from SEED_NOW (captured once, at the top of
// seedComplaints). Each event's offsetHours is measured from its own
// complaint's createdAt, not from SEED_NOW.

const H = (days: number): number => days * 24;

interface ComplaintEventStep {
  offsetHours: number;
  kind: ApplyTransitionInput["kind"];
  toStatus?: Status;
  toPriority?: Priority;
  note?: string;
}

interface ComplaintScenario {
  unitLabel: string;
  raisedByEmail: string;
  category: Category;
  description: string;
  createdHoursAgo: number;
  events: ComplaintEventStep[];
}

const COMPLAINTS: ComplaintScenario[] = [
  // --- Regression chain 1: B-101, ELECTRICAL. Old complaint resolved, new
  // one raised 7 days later, same unit and category — links via
  // regressedFromId. Ends RESOLVED again.
  {
    unitLabel: "B-101",
    raisedByEmail: "ananya.desai@example.com",
    category: "ELECTRICAL",
    description: "Frequent power trips in B-101 kitchen circuit, breaker keeps flipping.",
    createdHoursAgo: H(70),
    events: [
      { offsetHours: 3, kind: "NOTE", note: "Logged with facilities, electrician to inspect breaker panel." },
      { offsetHours: 6, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Electrician assigned, visiting today." },
      { offsetHours: 30, kind: "NOTE", note: "Electrician replaced a worn fuse in the kitchen circuit." },
      { offsetHours: 48, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Breaker holding steady for 24 hours, closing out." },
    ],
  },
  {
    unitLabel: "B-101",
    raisedByEmail: "ananya.desai@example.com",
    category: "ELECTRICAL",
    description: "Power tripping again in B-101 kitchen circuit — same breaker as last month.",
    createdHoursAgo: H(61),
    events: [
      { offsetHours: 1, kind: "ESCALATE", note: "Second occurrence in a month, escalating to the facilities lead." },
      {
        offsetHours: 4,
        kind: "STATUS_CHANGE",
        toStatus: "IN_PROGRESS",
        note: "Vendor sending a senior electrician this time for a full circuit check.",
      },
      { offsetHours: 20, kind: "NOTE", note: "Found a loose neutral connection behind the panel, rewiring now." },
      {
        offsetHours: 72,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "Neutral connection resecured and panel retested under load. Holding.",
      },
    ],
  },

  // --- Regression chain 2: C-202, LIFT. Old resolved, new one 6 days later,
  // escalated then deescalated, ends IN_PROGRESS (still open).
  {
    unitLabel: "C-202",
    raisedByEmail: "kavya.pillai@example.com",
    category: "LIFT",
    description: "Lift in C block juddering between the 2nd and 3rd floor.",
    createdHoursAgo: H(45),
    events: [
      { offsetHours: 2, kind: "NOTE", note: "Reported to the AMC vendor, technician visit requested." },
      { offsetHours: 5, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 24, kind: "NOTE", note: "Technician adjusted the guide cables and lubricated the rails." },
      { offsetHours: 40, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Test rides smooth across all floors, resolving." },
    ],
  },
  {
    unitLabel: "C-202",
    raisedByEmail: "kavya.pillai@example.com",
    category: "LIFT",
    description: "Lift juddering near the 3rd floor again, same spot as last month.",
    createdHoursAgo: H(37),
    events: [
      { offsetHours: 1, kind: "PRIORITY_CHANGE", toPriority: "HIGH", note: "Recurring lift fault, raising priority." },
      {
        offsetHours: 2,
        kind: "ESCALATE",
        note: "Second occurrence on the same lift within weeks — escalating to building manager.",
      },
      {
        offsetHours: 3,
        kind: "STATUS_CHANGE",
        toStatus: "IN_PROGRESS",
        note: "Vendor called back; suspects a worn guide shoe this time, ordering the part.",
      },
      {
        offsetHours: 30,
        kind: "DEESCALATE",
        note: "Vendor confirmed the part arrives tomorrow — stepping down the escalation, on track.",
      },
    ],
  },

  // --- Regression chain 3: A-404, SECURITY. Old resolved, new one 8 days
  // later, still freshly OPEN.
  {
    unitLabel: "A-404",
    raisedByEmail: "vikram.rao@example.com",
    category: "SECURITY",
    description: "Front boom barrier at A block not lifting automatically for residents.",
    createdHoursAgo: H(25),
    events: [
      { offsetHours: 1, kind: "NOTE", note: "Security desk notified, manual lifting in the meantime." },
      { offsetHours: 3, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 10, kind: "NOTE", note: "Vendor found a faulty proximity sensor, replacing it." },
      {
        offsetHours: 18,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "Sensor replaced, barrier auto-lifting correctly again.",
      },
    ],
  },
  {
    unitLabel: "A-404",
    raisedByEmail: "vikram.rao@example.com",
    category: "SECURITY",
    description: "Boom barrier stuck again at A block gate — guards letting cars in manually.",
    createdHoursAgo: H(16),
    events: [
      { offsetHours: 1, kind: "NOTE", note: "Logged with security vendor; same barrier as last month's sensor issue." },
    ],
  },

  // --- Recurrence set: A-303, WATER_PLUMBING, 3 complaints within the
  // 60-day window (also chains two regressions). Third is escalated and
  // still open — a genuinely unresolved recurring nuisance.
  {
    unitLabel: "A-303",
    raisedByEmail: "sneha.iyer@example.com",
    category: "WATER_PLUMBING",
    description: "Kitchen sink drain blocked in A-303.",
    createdHoursAgo: H(40),
    events: [
      { offsetHours: 2, kind: "NOTE", note: "Plumber requested for a drain clearing visit." },
      { offsetHours: 5, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 20, kind: "NOTE", note: "Plumber cleared a grease blockage in the trap." },
      { offsetHours: 30, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Draining freely, resident confirmed." },
    ],
  },
  {
    unitLabel: "A-303",
    raisedByEmail: "sneha.iyer@example.com",
    category: "WATER_PLUMBING",
    description: "Kitchen sink draining slowly again in A-303, same spot as last time.",
    createdHoursAgo: H(24),
    events: [
      { offsetHours: 2, kind: "NOTE", note: "Plumber revisiting — likely the same trap joint." },
      { offsetHours: 4, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 18, kind: "NOTE", note: "Re-sealed the trap joint, it was not fully tightened last visit." },
      { offsetHours: 26, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Draining normally, resident confirmed again." },
    ],
  },
  {
    unitLabel: "A-303",
    raisedByEmail: "sneha.iyer@example.com",
    category: "WATER_PLUMBING",
    description: "Sink in A-303 backing up again — third time this quarter, want a permanent fix.",
    createdHoursAgo: H(13),
    events: [
      {
        offsetHours: 1,
        kind: "ESCALATE",
        note: "Third recurrence on the same fixture — escalating for a permanent fix, not another patch.",
      },
      {
        offsetHours: 4,
        kind: "NOTE",
        note: "Master plumber scheduled to fully replace the trap and drain fitting, not just reseal it.",
      },
    ],
  },

  // --- Currently overdue, exercising different (category, priority) SLA
  // rules. All stay OPEN/IN_PROGRESS — never RESOLVED.
  {
    // Tight SLA breach: LIFT/HIGH, 2-hour SLA, 48 hours open.
    unitLabel: "A-101",
    raisedByEmail: "aarav.sharma@example.com",
    category: "LIFT",
    description: "Lift stuck between ground and 1st floor again, stopped responding to the call button.",
    createdHoursAgo: 48,
    events: [
      { offsetHours: 0.25, kind: "PRIORITY_CHANGE", toPriority: "HIGH", note: "Possible entrapment risk, marking high priority immediately." },
      { offsetHours: 0.5, kind: "ESCALATE", note: "No response from vendor's emergency line yet — escalating." },
      { offsetHours: 1, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Technician dispatched, ETA 30 minutes." },
    ],
  },
  {
    // Loose SLA breach: HOUSEKEEPING/LOW, 120-hour SLA, 216 hours open.
    unitLabel: "C-101",
    raisedByEmail: "siddharth.menon@example.com",
    category: "HOUSEKEEPING",
    description: "Common corridor on the 3rd floor of C block not swept in over a week, garbage bags piling near the lift lobby.",
    createdHoursAgo: 216,
    events: [
      { offsetHours: 1, kind: "PRIORITY_CHANGE", toPriority: "LOW", note: "Cosmetic/non-urgent, downgrading priority." },
      { offsetHours: 4, kind: "NOTE", note: "Logged with the housekeeping vendor, requesting an extra round this week." },
    ],
  },
  {
    unitLabel: "B-202",
    raisedByEmail: "karan.malhotra@example.com",
    category: "ELECTRICAL",
    description: "Flickering lights in the B-202 hallway, breaker panel making a buzzing noise.",
    createdHoursAgo: 72,
    events: [
      { offsetHours: 2, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Electrician inspecting the panel." },
      {
        offsetHours: 40,
        kind: "NOTE",
        note: "Waiting on a replacement breaker from the vendor, panel isolated safely in the meantime.",
      },
    ],
  },
  {
    unitLabel: "C-303",
    raisedByEmail: "rahul.verma@example.com",
    category: "SECURITY",
    description: "CCTV camera at the C block entrance gate has been offline since last night, no footage recorded.",
    createdHoursAgo: 30,
    events: [{ offsetHours: 0.5, kind: "PRIORITY_CHANGE", toPriority: "HIGH", note: "Security blind spot at the main gate — high priority." }],
  },
  {
    unitLabel: "B-404",
    raisedByEmail: "neha.joshi@example.com",
    category: "WATER_PLUMBING",
    description: "Slow drip from the bathroom ceiling in B-404, B-303 below also noticing water stains.",
    createdHoursAgo: 168,
    events: [
      { offsetHours: 1, kind: "PRIORITY_CHANGE", toPriority: "LOW", note: "Minor seepage, no active leak — downgrading for now." },
      {
        offsetHours: 50,
        kind: "NOTE",
        note: "Plumber inspected — needs waterproofing on the B-404 bathroom floor, not just a pipe fix.",
      },
    ],
  },
  {
    unitLabel: "A-202",
    raisedByEmail: "rohan.mehta@example.com",
    category: "PARKING",
    description: "Allotted parking slot for A-202 repeatedly occupied by visitor vehicles despite signage.",
    createdHoursAgo: 96,
    events: [
      { offsetHours: 3, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Asked security to actively monitor the slot." },
      { offsetHours: 30, kind: "NOTE", note: "Same visitor vehicle again — issuing a formal warning notice this time." },
    ],
  },

  // --- Ordinary complaints, spread across the last ~3 months, mostly
  // resolved, giving the timeline real texture beyond the flagship cases.
  {
    unitLabel: "C-404",
    raisedByEmail: "ishita.bose@example.com",
    category: "OTHER",
    description: "Clubhouse projector bulb blown, residents' association meeting affected.",
    createdHoursAgo: H(88),
    events: [
      { offsetHours: 4, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Procuring a replacement bulb." },
      { offsetHours: 48, kind: "NOTE", note: "Bulb ordered, expected in two days." },
      { offsetHours: 72, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "New bulb installed and tested working." },
    ],
  },
  {
    unitLabel: "B-303",
    raisedByEmail: "divya.reddy@example.com",
    category: "COMMON_AREA",
    description: "Garden bench near B block broken, wooden slat cracked.",
    createdHoursAgo: H(82),
    events: [
      { offsetHours: 24, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Carpenter notified for a repair visit." },
      { offsetHours: 96, kind: "NOTE", note: "Slat replaced and sanded down." },
      { offsetHours: 100, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Bench safe to use again." },
    ],
  },
  {
    unitLabel: "A-202",
    raisedByEmail: "priya.nair@example.com",
    category: "HOUSEKEEPING",
    description: "Recycling bins overflowing near A block, not collected on the scheduled day.",
    createdHoursAgo: H(75),
    events: [
      { offsetHours: 6, kind: "NOTE", note: "Housekeeping vendor contacted about the missed collection." },
      {
        offsetHours: 30,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "Bins cleared and collection schedule corrected with the vendor.",
      },
    ],
  },
  {
    unitLabel: "C-202",
    raisedByEmail: "kavya.pillai@example.com",
    category: "SECURITY",
    description: "Intercom at the C block main gate not connecting to individual flats.",
    createdHoursAgo: H(68),
    events: [
      { offsetHours: 5, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Technician checking the intercom wiring." },
      {
        offsetHours: 40,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "Found and reconnected a loose wire, tested calls to all flats.",
      },
    ],
  },
  {
    unitLabel: "B-101",
    raisedByEmail: "ananya.desai@example.com",
    category: "PARKING",
    description: "Two-wheeler parking area near B block waterlogged after rain, bikes covered in mud.",
    createdHoursAgo: H(60),
    events: [
      { offsetHours: 8, kind: "NOTE", note: "Drainage team informed about the low spot." },
      { offsetHours: 20, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      {
        offsetHours: 90,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "Drain cleared and gravel added to the low spot to stop pooling.",
      },
    ],
  },
  {
    unitLabel: "A-404",
    raisedByEmail: "vikram.rao@example.com",
    category: "COMMON_AREA",
    description: "Terrace door lock at A block broken, door not latching shut.",
    createdHoursAgo: H(55),
    events: [
      { offsetHours: 10, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 30, kind: "NOTE", note: "Locksmith replacing the latch mechanism." },
      { offsetHours: 36, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "New latch installed and tested." },
    ],
  },
  {
    unitLabel: "C-303",
    raisedByEmail: "rahul.verma@example.com",
    category: "ELECTRICAL",
    description: "Streetlight pole 4 near C block not switching on at dusk.",
    createdHoursAgo: H(50),
    events: [
      { offsetHours: 6, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 48, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Photocell sensor was faulty, replaced it." },
    ],
  },
  {
    unitLabel: "B-404",
    raisedByEmail: "neha.joshi@example.com",
    category: "LIFT",
    description: "B block lift making a grinding noise on descent.",
    createdHoursAgo: H(44),
    events: [
      { offsetHours: 1, kind: "PRIORITY_CHANGE", toPriority: "HIGH", note: "Unusual mechanical noise, raising priority as a precaution." },
      { offsetHours: 3, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS" },
      { offsetHours: 20, kind: "NOTE", note: "AMC vendor serviced the motor and greased the rails." },
      { offsetHours: 26, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Ride is smooth and quiet again." },
    ],
  },
  {
    unitLabel: "C-101",
    raisedByEmail: "siddharth.menon@example.com",
    category: "WATER_PLUMBING",
    description: "Low water pressure on the 3rd floor of C block during morning hours.",
    createdHoursAgo: H(38),
    events: [
      { offsetHours: 10, kind: "NOTE", note: "Checked the overhead tank valve, adjusting the flow." },
      { offsetHours: 34, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Valve fully opened, pressure back to normal." },
    ],
  },
  {
    unitLabel: "A-101",
    raisedByEmail: "aarav.sharma@example.com",
    category: "SECURITY",
    description: "Visitor entry log register missing at the A block gate, watchman couldn't find it.",
    createdHoursAgo: H(32),
    events: [
      { offsetHours: 3, kind: "NOTE", note: "Issued a spare register, ordering a replacement." },
      {
        offsetHours: 8,
        kind: "STATUS_CHANGE",
        toStatus: "RESOLVED",
        note: "New register in use, old one to be replaced within the week.",
      },
    ],
  },
  {
    unitLabel: "A-101",
    raisedByEmail: "aarav.sharma@example.com",
    category: "HOUSEKEEPING",
    description: "Newspaper and flyer pile accumulating outside A-101's door, requesting a small bin nearby.",
    createdHoursAgo: H(20),
    events: [
      { offsetHours: 10, kind: "NOTE", note: "Maintenance placed a small bin near the mailboxes." },
      { offsetHours: 30, kind: "STATUS_CHANGE", toStatus: "RESOLVED", note: "Pile cleared, bin in place going forward." },
    ],
  },
  {
    // In progress, comfortably within SLA (COMMON_AREA/MEDIUM, 72h).
    unitLabel: "A-303",
    raisedByEmail: "sneha.iyer@example.com",
    category: "COMMON_AREA",
    description: "Clubhouse treadmill making a grinding noise near the motor, still usable.",
    createdHoursAgo: H(1),
    events: [
      { offsetHours: 6, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Servicing vendor contacted, visit scheduled this week." },
    ],
  },
  {
    // In progress, comfortably within SLA (HOUSEKEEPING/MEDIUM, 48h).
    unitLabel: "C-404",
    raisedByEmail: "ishita.bose@example.com",
    category: "HOUSEKEEPING",
    description: "Basement parking level 2 not swept, oil stains and debris accumulating.",
    createdHoursAgo: H(1),
    events: [
      { offsetHours: 8, kind: "STATUS_CHANGE", toStatus: "IN_PROGRESS", note: "Housekeeping staff assigned for a deep clean of level 2." },
    ],
  },
  {
    // Freshly raised, nothing actioned yet.
    unitLabel: "B-202",
    raisedByEmail: "karan.malhotra@example.com",
    category: "OTHER",
    description: "Request to install a shoe rack stand near the B block lift lobby.",
    createdHoursAgo: 12,
    events: [],
  },
  {
    // Freshly raised, well within SLA (WATER_PLUMBING/LOW, 48h).
    unitLabel: "B-303",
    raisedByEmail: "arjun.kapoor@example.com",
    category: "WATER_PLUMBING",
    description: "Kitchen tap in B-303 dripping continuously, minor but constant.",
    createdHoursAgo: 4,
    events: [
      { offsetHours: 0.5, kind: "PRIORITY_CHANGE", toPriority: "LOW", note: "Minor/cosmetic drip, downgrading priority." },
      { offsetHours: 1, kind: "NOTE", note: "Logged, plumber to visit within the week." },
    ],
  },
];

function buildTransitionInput(
  step: ComplaintEventStep,
  base: { complaintId: string; actorId: string; expectedVersion: number; now: Date },
): ApplyTransitionInput {
  switch (step.kind) {
    case "STATUS_CHANGE":
      if (!step.toStatus) throw new Error(`STATUS_CHANGE step for ${base.complaintId} missing toStatus`);
      return { ...base, kind: "STATUS_CHANGE", toStatus: step.toStatus, note: step.note };
    case "PRIORITY_CHANGE":
      if (!step.toPriority) throw new Error(`PRIORITY_CHANGE step for ${base.complaintId} missing toPriority`);
      return { ...base, kind: "PRIORITY_CHANGE", toPriority: step.toPriority, note: step.note };
    case "ESCALATE":
      return { ...base, kind: "ESCALATE", note: step.note };
    case "DEESCALATE":
      return { ...base, kind: "DEESCALATE", note: step.note };
    case "NOTE":
      if (!step.note) throw new Error(`NOTE step for ${base.complaintId} missing note`);
      return { ...base, kind: "NOTE", note: step.note };
  }
}

// Idempotent: each scenario is keyed by its (unique, authored) description.
// Complaints go through createComplaint() and applyTransition() only — never
// a direct write — per invariant 1.
async function seedComplaints(
  unitIdByLabel: Map<string, string>,
  userIdByEmail: Map<string, string>,
  adminId: string,
): Promise<{ created: number; skipped: number }> {
  const seedNow = new Date();
  let created = 0;
  let skipped = 0;

  for (const scenario of COMPLAINTS) {
    const existing = await prisma.complaint.findFirst({ where: { description: scenario.description } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const unitId = unitIdByLabel.get(scenario.unitLabel);
    const raisedById = userIdByEmail.get(scenario.raisedByEmail);
    if (!unitId || !raisedById) {
      throw new Error(`Seed data error: unknown unit ${scenario.unitLabel} or resident ${scenario.raisedByEmail}`);
    }

    const createdAt = new Date(seedNow.getTime() - scenario.createdHoursAgo * 60 * 60 * 1000);

    const complaint = await createComplaint({
      unitId,
      raisedById,
      category: scenario.category,
      description: scenario.description,
      now: createdAt,
    });

    let version = complaint.version;
    for (const step of scenario.events) {
      const eventTime = new Date(createdAt.getTime() + step.offsetHours * 60 * 60 * 1000);
      const result = await applyTransition(
        buildTransitionInput(step, {
          complaintId: complaint.id,
          actorId: adminId,
          expectedVersion: version,
          now: eventTime,
        }),
      );
      version = result.version;
    }

    created += 1;
  }

  return { created, skipped };
}

async function seedNotices(adminId: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const notice of NOTICES) {
    const existing = await prisma.notice.findFirst({ where: { title: notice.title } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await createNotice({
      title: notice.title,
      body: notice.body,
      isImportant: notice.isImportant,
      postedById: adminId,
    });
    created += 1;
  }

  return { created, skipped };
}

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const unitIdByLabel = new Map<string, string>();
  const userIdByEmail = new Map<string, string>();

  for (const { block, number } of UNITS) {
    const label = `${block}-${number}`;
    const unit = await prisma.unit.upsert({
      where: { block_number: { block, number } },
      update: { label },
      create: { block, number, label },
    });
    unitIdByLabel.set(label, unit.id);
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { name: ADMIN.name, role: Role.ADMIN, passwordHash },
    create: {
      email: ADMIN.email,
      name: ADMIN.name,
      role: Role.ADMIN,
      passwordHash,
    },
  });
  userIdByEmail.set(admin.email, admin.id);

  for (const resident of RESIDENTS) {
    const unitId = unitIdByLabel.get(resident.unitLabel);
    if (!unitId) {
      throw new Error(`Unknown unit label ${resident.unitLabel} for resident ${resident.name}`);
    }
    const user = await prisma.user.upsert({
      where: { email: resident.email },
      update: { name: resident.name, role: Role.RESIDENT, passwordHash, unitId },
      create: {
        email: resident.email,
        name: resident.name,
        role: Role.RESIDENT,
        passwordHash,
        unitId,
      },
    });
    userIdByEmail.set(user.email, user.id);
  }

  for (const category of Object.keys(SLA_HOURS) as Category[]) {
    for (const priority of Object.keys(SLA_HOURS[category]) as Priority[]) {
      const hours = SLA_HOURS[category][priority];
      await prisma.slaPolicy.upsert({
        where: { category_priority: { category, priority } },
        update: { hours },
        create: { category, priority, hours },
      });
    }
  }

  for (const setting of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
  }

  const complaintResult = await seedComplaints(unitIdByLabel, userIdByEmail, admin.id);
  const noticeResult = await seedNotices(admin.id);

  console.log(
    `Seeded ${UNITS.length} units, ${RESIDENTS.length + 1} users, ` +
      `${Object.keys(SLA_HOURS).length * 3} SLA policies, ${SETTINGS.length} settings.`,
  );
  console.log(
    `Complaints: ${complaintResult.created} created, ${complaintResult.skipped} already present.`,
  );
  console.log(`Notices: ${noticeResult.created} created, ${noticeResult.skipped} already present.`);
  console.log(`Dev login password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
