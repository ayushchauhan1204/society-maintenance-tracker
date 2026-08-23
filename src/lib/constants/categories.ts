import { Category } from "@prisma/client";

export const CATEGORY_LABELS: Record<Category, string> = {
  WATER_PLUMBING: "Water & Plumbing",
  ELECTRICAL: "Electrical",
  LIFT: "Lift",
  SECURITY: "Security",
  HOUSEKEEPING: "Housekeeping",
  PARKING: "Parking",
  COMMON_AREA: "Common Area",
  OTHER: "Other",
};

export const CATEGORIES = Object.values(Category);
