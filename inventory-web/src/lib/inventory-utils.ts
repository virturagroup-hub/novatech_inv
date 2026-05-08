import { format, formatDistanceToNow } from "date-fns";
import type {
  ActivityEntry,
  Bin,
  DeviceModel,
  InventoryState,
  InventorySortKey,
  Part,
  PartFilters,
} from "./inventory-types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getBinById(bins: Bin[], binId: string | null | undefined) {
  if (!binId) return null;
  return bins.find((bin) => bin.id === binId) ?? null;
}

export function getBinStatusLabel(bin: Bin) {
  return bin.status === "active" ? "Active" : "Inactive";
}

export function getModelById(models: DeviceModel[], modelId: string) {
  return models.find((model) => model.id === modelId) ?? null;
}

export function getModelStatusLabel(model: DeviceModel) {
  return model.status === "active" ? "Active" : "Inactive";
}

export function getCompatibleModels(part: Part, models: DeviceModel[]) {
  return part.compatibleModelIds
    .map((modelId) => getModelById(models, modelId))
    .filter((model): model is DeviceModel => Boolean(model));
}

export function getPartStockStatus(part: Part): "critical" | "low" | "healthy" {
  if (part.quantityOnHand === 0) return "critical";
  if (part.quantityOnHand <= part.reorderPoint) return "low";
  return "healthy";
}

export function requiresAttention(part: Part) {
  return part.binId === null || (!part.universal && part.compatibleModelIds.length === 0);
}

export function getPartLocationLabel(part: Part, bins: Bin[]) {
  const bin = getBinById(bins, part.binId);
  if (!bin) return "Unassigned";
  return `${bin.code} · ${bin.name}${bin.status === "inactive" ? " (Inactive)" : ""}`;
}

export function getPartLookupBlob(part: Part, bins: Bin[], models: DeviceModel[]) {
  const bin = getBinById(bins, part.binId);
  const modelNames = getCompatibleModels(part, models)
    .map((model) => `${model.manufacturer} ${model.name}`)
    .join(" ");

  return normalizeSearch(
    [
      part.partNumber,
      part.partName,
      part.manufacturer,
      part.category,
      part.notes,
      bin?.code ?? "",
      bin?.name ?? "",
      bin?.description ?? "",
      modelNames,
      bin?.manufacturer ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function sortParts(parts: Part[], sortKey: InventorySortKey) {
  return [...parts].sort((left, right) => {
    switch (sortKey) {
      case "partNumber":
        return left.partNumber.localeCompare(right.partNumber);
      case "quantity":
        return left.quantityOnHand - right.quantityOnHand;
      case "location":
        return (left.binId ?? "zzz").localeCompare(right.binId ?? "zzz");
      case "updatedAt":
      default:
        return (
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        );
    }
  });
}

export function filterParts(
  parts: Part[],
  bins: Bin[],
  models: DeviceModel[],
  filters: PartFilters,
) {
  const query = normalizeSearch(filters.query);
  return parts.filter((part) => {
    if (filters.manufacturer && part.manufacturer !== filters.manufacturer) {
      return false;
    }

    if (filters.category && part.category !== filters.category) {
      return false;
    }

    if (filters.binId) {
      if (part.binId !== filters.binId) return false;
    }

    if (filters.modelId && !part.compatibleModelIds.includes(filters.modelId)) {
      return false;
    }

    if (filters.status !== "all") {
      const status = getPartStockStatus(part);
      const attention = requiresAttention(part);
      const universal = part.universal;
      const unassigned = part.binId === null;

      const matchesStatus =
        (filters.status === "critical" && status === "critical") ||
        (filters.status === "low" && status === "low") ||
        (filters.status === "attention" && attention) ||
        (filters.status === "unassigned" && unassigned) ||
        (filters.status === "universal" && universal);

      if (!matchesStatus) return false;
    }

    if (!query) return true;

    return getPartLookupBlob(part, bins, models).includes(query);
  });
}

export function getDashboardSummary(state: InventoryState) {
  const totalUnits = state.parts.reduce(
    (sum, part) => sum + part.quantityOnHand,
    0,
  );
  const lowStockParts = state.parts.filter(
    (part) => getPartStockStatus(part) !== "healthy",
  );
  const criticalParts = state.parts.filter(
    (part) => getPartStockStatus(part) === "critical",
  );
  const attentionParts = state.parts.filter((part) => requiresAttention(part));
  const unassignedParts = state.parts.filter((part) => part.binId === null);
  const universalParts = state.parts.filter((part) => part.universal);
  const taggedParts = state.parts.filter(
    (part) => part.compatibleModelIds.length > 0 || part.universal,
  );
  const activeBins = state.bins.filter((bin) => bin.status === "active");
  const inactiveBins = state.bins.filter((bin) => bin.status === "inactive");
  const activeModels = state.models.filter((model) => model.status === "active");
  const inactiveModels = state.models.filter((model) => model.status === "inactive");
  const coverage = state.parts.length
    ? Math.round((taggedParts.length / state.parts.length) * 100)
    : 0;

  const updatedAt = [...state.parts, ...state.bins, ...state.models].reduce(
    (latest, item) => {
      const timestamp = "updatedAt" in item ? item.updatedAt : undefined;
      if (!timestamp) return latest;
      return new Date(timestamp).getTime() > new Date(latest).getTime()
        ? timestamp
        : latest;
    },
    state.settings.updatedAt,
  );

  const manufacturers = Array.from(
    new Set(state.parts.map((part) => part.manufacturer)),
  )
    .map((manufacturer) => {
      const parts = state.parts.filter((part) => part.manufacturer === manufacturer);
      const units = parts.reduce((sum, part) => sum + part.quantityOnHand, 0);
      const attention = parts.filter((part) => requiresAttention(part)).length;
      return {
        label: manufacturer,
        parts: parts.length,
        units,
        attention,
      };
    })
    .sort((left, right) => right.units - left.units);

  const categories = Array.from(new Set(state.parts.map((part) => part.category)))
    .map((category) => {
      const parts = state.parts.filter((part) => part.category === category);
      const units = parts.reduce((sum, part) => sum + part.quantityOnHand, 0);
      return {
        label: category,
        parts: parts.length,
        units,
      };
    })
    .sort((left, right) => right.units - left.units);

  const lowStockTable = [...lowStockParts]
    .sort((left, right) => {
      const leftScore = left.quantityOnHand === 0 ? -1 : left.quantityOnHand;
      const rightScore = right.quantityOnHand === 0 ? -1 : right.quantityOnHand;
      return leftScore - rightScore;
    })
    .slice(0, 5);

  const recentActivity = [...state.activity]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 6);

  return {
    totalUnits,
    lowStockCount: lowStockParts.length,
    criticalCount: criticalParts.length,
    attentionCount: attentionParts.length,
    unassignedCount: unassignedParts.length,
    universalCount: universalParts.length,
    coverage,
    binCount: state.bins.length,
    activeBinCount: activeBins.length,
    inactiveBinCount: inactiveBins.length,
    modelCount: state.models.length,
    activeModelCount: activeModels.length,
    inactiveModelCount: inactiveModels.length,
    lastUpdated: updatedAt,
    manufacturers,
    categories,
    lowStockTable,
    recentActivity,
  };
}

export function getBinSummary(bin: Bin, parts: Part[]) {
  const assigned = parts.filter((part) => part.binId === bin.id);
  const lowStock = assigned.filter((part) => getPartStockStatus(part) !== "healthy");
  const totalUnits = assigned.reduce((sum, part) => sum + part.quantityOnHand, 0);

  return {
    parts: assigned,
    totalUnits,
    lowStockCount: lowStock.length,
  };
}

export function getActivityColor(action: ActivityEntry["action"]) {
  switch (action) {
    case "added":
    case "imported":
      return "success";
    case "adjusted":
    case "updated":
      return "info";
    case "printed":
      return "success";
    case "moved":
      return "warning";
    case "removed":
      return "danger";
    default:
      return "info";
  }
}

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "MMM d, yyyy · h:mm a");
}

export function formatCompactDate(value: string | Date) {
  return format(new Date(value), "MMM d");
}

export function formatRelative(value: string | Date) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializePartsCsv(
  state: Pick<InventoryState, "parts" | "bins" | "models">,
) {
  const header = [
    "Part Number",
    "Part Name",
    "Manufacturer",
    "Category",
    "Quantity On Hand",
    "Reorder Point",
    "Reorder Target",
    "Bin Code",
    "Bin Status",
    "Compatible Models",
    "Universal",
    "Notes",
    "Received At",
    "Updated At",
  ];

  const rows = state.parts.map((part) => {
    const bin = getBinById(state.bins, part.binId);
    const modelNames = getCompatibleModels(part, state.models)
      .map((model) => `${model.manufacturer} ${model.name}`)
      .join("; ");

    return [
      escapeCsvCell(part.partNumber),
      escapeCsvCell(part.partName),
      escapeCsvCell(part.manufacturer),
      escapeCsvCell(part.category),
      part.quantityOnHand,
      part.reorderPoint,
      part.reorderTarget,
      escapeCsvCell(bin?.code ?? ""),
      escapeCsvCell(bin?.status ?? ""),
      escapeCsvCell(modelNames),
      escapeCsvCell(part.universal ? "Yes" : "No"),
      escapeCsvCell(part.notes),
      escapeCsvCell(formatCompactDate(part.receivedAt)),
      escapeCsvCell(formatCompactDate(part.updatedAt)),
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function serializeBinsCsv(state: InventoryState) {
  const header = [
    "Location Code",
    "Location Name",
    "Description",
    "Area",
    "Shelf",
    "Bin",
    "Manufacturer",
    "Status",
    "Notes",
  ];

  const rows = state.bins.map((bin) =>
    [
      escapeCsvCell(bin.code),
      escapeCsvCell(bin.name),
      escapeCsvCell(bin.description),
      escapeCsvCell(bin.aisle),
      bin.row,
      bin.column,
      escapeCsvCell(bin.manufacturer ?? ""),
      escapeCsvCell(bin.status),
      escapeCsvCell(bin.notes ?? ""),
    ].join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export function serializeModelsCsv(state: InventoryState) {
  const header = ["Manufacturer", "Model Name", "Series", "Status", "Notes"];
  const rows = state.models.map((model) =>
    [
      escapeCsvCell(model.manufacturer),
      escapeCsvCell(model.name),
      escapeCsvCell(model.series),
      escapeCsvCell(model.status),
      escapeCsvCell(model.notes ?? ""),
    ].join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export function serializeLowStockCsv(
  state: Pick<InventoryState, "parts" | "bins" | "models">,
) {
  const lowStockParts = state.parts.filter(
    (part) => getPartStockStatus(part) !== "healthy",
  );

  const header = [
    "Part Number",
    "Part Name",
    "Manufacturer",
    "Quantity On Hand",
    "Reorder Point",
    "Reorder Target",
    "Location",
    "Status",
    "Compatibility",
    "Notes",
  ];

  const rows = lowStockParts.map((part) => {
    const bin = getBinById(state.bins, part.binId);
    const compatibility = part.universal
      ? "Universal"
      : getCompatibleModels(part, state.models)
          .map((model) => `${model.manufacturer} ${model.name}`)
          .join("; ");

    return [
      escapeCsvCell(part.partNumber),
      escapeCsvCell(part.partName),
      escapeCsvCell(part.manufacturer),
      part.quantityOnHand,
      part.reorderPoint,
      part.reorderTarget,
      escapeCsvCell(bin ? `${bin.code} · ${bin.name}` : "Unassigned"),
      escapeCsvCell(getPartStockStatus(part)),
      escapeCsvCell(compatibility),
      escapeCsvCell(part.notes),
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function serializeLocationsCsv(state: InventoryState) {
  return serializeBinsCsv(state);
}

export function serializeActivityCsv(state: InventoryState) {
  const header = ["Timestamp", "Action", "Entity Type", "Title", "Detail"];
  const rows = state.activity.map((entry) =>
    [
      escapeCsvCell(formatDateTime(entry.occurredAt)),
      escapeCsvCell(entry.action),
      escapeCsvCell(entry.entityType),
      escapeCsvCell(entry.title),
      escapeCsvCell(entry.detail),
    ].join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export function countCompatiblePartsForModel(parts: Part[], modelId: string) {
  return parts.filter((part) => part.compatibleModelIds.includes(modelId)).length;
}
