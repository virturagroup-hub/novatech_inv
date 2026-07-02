const canonicalCategories = [
  "Accessories",
  "Boards",
  "Cables",
  "Cooling",
  "Covers",
  "Drives",
  "Drums",
  "Duplex",
  "Feeders",
  "Finishing",
  "Fusers",
  "Hardware",
  "Imaging",
  "Maintenance",
  "Miscellaneous",
  "Motors",
  "Power Supplies",
  "Rollers",
  "Scanner / ADF",
  "Sensors",
  "Transfer",
  "Trays",
  "Toner / Consumables",
] as const;

export const categories = canonicalCategories;

export type Category = (typeof canonicalCategories)[number];

export const defaultCategory: Category = "Accessories";

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

const categoryAliases: Record<Category, readonly string[]> = {
  Accessories: ["Accessory", "Accessories"],
  Boards: ["Board", "Boards"],
  Cables: ["Cable", "Cables"],
  Cooling: ["Cooling"],
  Covers: ["Cover", "Covers"],
  Drives: ["Drive", "Drives"],
  Drums: ["Drum", "Drums"],
  Duplex: ["Duplex"],
  Feeders: ["Feeder", "Feeders"],
  Finishing: ["Finishing"],
  Fusers: ["Fuser", "Fusers"],
  Hardware: ["Hardware"],
  Imaging: ["Imaging"],
  Maintenance: ["Maintenance"],
  Miscellaneous: ["Misc", "Miscellaneous", "Other"],
  Motors: ["Motor", "Motors"],
  "Power Supplies": ["Power Supply", "Power Supplies"],
  Rollers: ["Roller", "Rollers"],
  "Scanner / ADF": ["Scanner / ADF", "Scanner ADF", "Scanner and ADF", "Scanner/ADF"],
  Sensors: ["Sensor", "Sensors"],
  Transfer: ["Transfer"],
  Trays: ["Tray", "Trays"],
  "Toner / Consumables": [
    "Toner",
    "Toner Consumable",
    "Toner Consumables",
    "Toner / Consumables",
  ],
};

const normalizedCategoryAliases = new Map<string, Category>(
  Object.entries(categoryAliases).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [normalizeCategoryKey(alias), canonical as Category] as const),
  ),
);

export function normalizeCategory(value: string | null | undefined): Category {
  const key = normalizeCategoryKey(value ?? "");
  return normalizedCategoryAliases.get(key) ?? "Miscellaneous";
}
