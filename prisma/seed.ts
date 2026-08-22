import { PrismaClient, Role, Category, Priority } from "@prisma/client";
import bcrypt from "bcrypt";

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

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const unitIdByLabel = new Map<string, string>();

  for (const { block, number } of UNITS) {
    const label = `${block}-${number}`;
    const unit = await prisma.unit.upsert({
      where: { block_number: { block, number } },
      update: { label },
      create: { block, number, label },
    });
    unitIdByLabel.set(label, unit.id);
  }

  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { name: ADMIN.name, role: Role.ADMIN, passwordHash },
    create: {
      email: ADMIN.email,
      name: ADMIN.name,
      role: Role.ADMIN,
      passwordHash,
    },
  });

  for (const resident of RESIDENTS) {
    const unitId = unitIdByLabel.get(resident.unitLabel);
    if (!unitId) {
      throw new Error(`Unknown unit label ${resident.unitLabel} for resident ${resident.name}`);
    }
    await prisma.user.upsert({
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

  console.log(
    `Seeded ${UNITS.length} units, ${RESIDENTS.length + 1} users, ` +
      `${Object.keys(SLA_HOURS).length * 3} SLA policies, ${SETTINGS.length} settings.`,
  );
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
