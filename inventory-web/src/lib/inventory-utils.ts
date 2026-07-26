import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { normalizeCategory } from "./category-normalization";
import type {
  ActivityEntry,
  Bin,
  AuditAction,
  DeviceModel,
  InventoryState,
  InventorySortKey,
  PartSetupStatus,
  Part,
  PartFilters,
} from "./inventory-types";
import {
  getModelDisplayName,
  getModelSearchBlob,
  getModelSeriesLabel,
} from "./model-search";

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

export function getDisplayPartNumber(part: Part, models: DeviceModel[]) {
  if (!part.isNpn) {
    return part.partNumber;
  }

  const compatibleModel = getCompatibleModels(part, models)[0];
  const modelLabel = compatibleModel
    ? `${compatibleModel.manufacturer} ${compatibleModel.name}`
    : "Unknown Model";

  return `NPN - ${modelLabel}`;
}

const auditActionLabels: Record<AuditAction, string> = {
  added: "Added",
  removed: "Removed",
  quantity_increased: "Quantity increased",
  quantity_decreased: "Quantity decreased",
  quantity_changed: "Quantity changed",
  location_changed: "Location changed",
  metadata_changed: "Metadata changed",
  marked_npn: "Marked NPN",
  unmarked_npn: "Unmarked NPN",
  label_printed: "Label printed",
};

const auditActionTones: Record<AuditAction, ActivityEntry["tone"]> = {
  added: "success",
  removed: "danger",
  quantity_increased: "success",
  quantity_decreased: "warning",
  quantity_changed: "info",
  location_changed: "warning",
  metadata_changed: "info",
  marked_npn: "warning",
  unmarked_npn: "info",
  label_printed: "success",
};

export function getAuditActionLabel(action: AuditAction | null | undefined) {
  if (!action) {
    return "Updated";
  }

  return auditActionLabels[action] ?? action;
}

export function getAuditActionTone(action: AuditAction | null | undefined) {
  if (!action) {
    return "info" as const;
  }

  return auditActionTones[action] ?? "info";
}

function isFiniteDate(value: string | Date | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

function maxTimestamp(values: Array<string | Date | null | undefined>) {
  const valid = values
    .filter(isFiniteDate)
    .map((value) => new Date(value as string | Date).getTime());

  if (valid.length === 0) {
    return null;
  }

  return new Date(Math.max(...valid));
}

export function normalizeAuditType(entry: Pick<ActivityEntry, "action" | "auditType" | "audit" | "tone">) {
  if (entry.auditType) {
    return entry.auditType;
  }

  switch (entry.action) {
    case "added":
    case "imported":
      return "added";
    case "removed":
      return "removed";
    case "printed":
      return "label_printed";
    case "moved":
      return "location_changed";
    case "adjusted": {
      const delta = entry.audit?.delta ?? 0;
      if (delta > 0) return "quantity_increased";
      if (delta < 0) return "quantity_decreased";
      return "quantity_changed";
    }
    case "updated": {
      if (entry.audit?.previousIsNpn !== entry.audit?.nextIsNpn) {
        return entry.audit?.nextIsNpn ? "marked_npn" : "unmarked_npn";
      }

      if ((entry.audit?.previousLocationId ?? null) !== (entry.audit?.nextLocationId ?? null)) {
        return "location_changed";
      }

      if (
        (entry.audit?.previousQuantity ?? null) !== (entry.audit?.nextQuantity ?? null) ||
        (entry.audit?.previousPartNumber ?? null) !== (entry.audit?.nextPartNumber ?? null)
      ) {
        return "quantity_changed";
      }

      return "metadata_changed";
    }
    default:
      return "metadata_changed";
  }
}

export function getActivityAuditLabel(entry: Pick<ActivityEntry, "action" | "auditType" | "audit" | "tone">) {
  return getAuditActionLabel(normalizeAuditType(entry));
}

export function getActivityAuditTone(entry: Pick<ActivityEntry, "action" | "auditType" | "audit" | "tone">) {
  return getAuditActionTone(normalizeAuditType(entry));
}

export function getPartStockStatus(part: Part): "critical" | "low" | "healthy" {
  if (part.quantityOnHand === 0) return "critical";
  if (part.quantityOnHand <= part.reorderPoint) return "low";
  return "healthy";
}

export function getPartSetupStatus(part: Part): PartSetupStatus {
  const hasLocation = part.binId !== null;
  const hasCompatibility = part.universal || part.compatibleModelIds.length > 0;

  if (hasLocation && hasCompatibility) {
    return "complete";
  }

  if (!hasLocation && !hasCompatibility) {
    return "critical";
  }

  return "attention";
}

export function getPartSetupMessages(part: Part) {
  const hasLocation = part.binId !== null;
  const hasCompatibility = part.universal || part.compatibleModelIds.length > 0;

  if (hasLocation && hasCompatibility) {
    return ["Complete setup"];
  }

  const messages: string[] = [];

  if (!hasLocation) {
    messages.push("Missing bin/location");
  }

  if (!hasCompatibility) {
    messages.push("Missing compatible models");
  }

  return messages;
}

export function requiresAttention(part: Part) {
  return getPartSetupStatus(part) !== "complete";
}

export function getPartLocationLabel(part: Part, bins: Bin[]) {
  const bin = getBinById(bins, part.binId);
  if (!bin) return "Unassigned";
  return `${bin.code} · ${bin.name}${bin.status === "inactive" ? " (Inactive)" : ""}`;
}

export function getPartLookupBlob(part: Part, bins: Bin[], models: DeviceModel[]) {
  const bin = getBinById(bins, part.binId);
  const modelNames = getCompatibleModels(part, models)
    .map((model) => `${getModelDisplayName(model)} ${getModelSeriesLabel(model)} ${getModelSearchBlob(model)}`)
    .join(" ");
  const displayPartNumber = getDisplayPartNumber(part, models);

  return normalizeSearch(
    [
      part.partNumber,
      part.isNpn ? "NPN" : "",
      displayPartNumber,
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

export type AuditWindowPreset =
  | "today"
  | "this-week"
  | "weekly"
  | "last-7-days"
  | "this-month"
  | "monthly"
  | "last-30-days"
  | "custom";

export type LabelRecencyFilter =
  | "all"
  | "added-today"
  | "added-last-3-days"
  | "added-last-7-days"
  | "quantity-increased-today"
  | "quantity-increased-last-3-days"
  | "quantity-increased-last-7-days"
  | "added-or-quantity-increased-today"
  | "added-or-quantity-increased-last-3-days"
  | "added-or-quantity-increased-last-7-days";

export interface AuditWindowBounds {
  start: Date;
  end: Date;
}

function asDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withinWindow(value: string | Date | null | undefined, bounds: AuditWindowBounds) {
  const date = asDate(value);
  return date ? isWithinInterval(date, bounds) : false;
}

export function getAuditWindowBounds(
  preset: AuditWindowPreset,
  options?: { customStart?: string | null; customEnd?: string | null; now?: Date },
): AuditWindowBounds | null {
  const now = options?.now ?? new Date();

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "this-week":
    case "weekly":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last-7-days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "this-month":
    case "monthly":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last-30-days":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "custom": {
      const start = asDate(options?.customStart);
      const end = asDate(options?.customEnd);

      if (!start || !end) {
        return null;
      }

      return { start: startOfDay(start), end: endOfDay(end) };
    }
  }
}

export function getPartLabelTimeline(
  part: Part,
  activity: ActivityEntry[],
): {
  addedAt: Date | null;
  quantityIncreasedAt: Date | null;
  combinedAt: Date | null;
  mostRecentAt: Date | null;
} {
  const related = activity.filter((entry) => {
    const audit = entry.audit ?? {};
    return entry.entityId === part.id || audit.itemId === part.id;
  });

  const addedAt = maxTimestamp([
    part.receivedAt,
    ...related
      .filter((entry) => normalizeAuditType(entry) === "added")
      .map((entry) => entry.occurredAt),
  ]);

  const quantityIncreasedAt = maxTimestamp([
    ...related
      .filter((entry) => {
        const auditType = normalizeAuditType(entry);
        const delta = entry.audit?.delta ?? 0;
        return auditType === "quantity_increased" || (auditType === "quantity_changed" && delta > 0);
      })
      .map((entry) => entry.occurredAt),
  ]);

  const combinedAt = maxTimestamp([addedAt, quantityIncreasedAt]);
  const mostRecentAt = maxTimestamp([combinedAt, part.updatedAt, part.lastCountedAt]);

  return {
    addedAt,
    quantityIncreasedAt,
    combinedAt,
    mostRecentAt,
  };
}

function labelRecencyBounds(days: number, now: Date) {
  return {
    start: startOfDay(subDays(now, days - 1)),
    end: endOfDay(now),
  };
}

export function getPartLabelRecencySortTimestamp(
  part: Part,
  activity: ActivityEntry[],
  recencyFilter: LabelRecencyFilter = "all",
) {
  const timeline = getPartLabelTimeline(part, activity);

  switch (recencyFilter) {
    case "added-today":
    case "added-last-3-days":
    case "added-last-7-days":
      return timeline.addedAt ?? timeline.mostRecentAt ?? asDate(part.updatedAt) ?? new Date(0);
    case "quantity-increased-today":
    case "quantity-increased-last-3-days":
    case "quantity-increased-last-7-days":
      return timeline.quantityIncreasedAt ?? timeline.combinedAt ?? timeline.mostRecentAt ?? asDate(part.updatedAt) ?? new Date(0);
    case "added-or-quantity-increased-today":
    case "added-or-quantity-increased-last-3-days":
    case "added-or-quantity-increased-last-7-days":
      return timeline.combinedAt ?? timeline.mostRecentAt ?? asDate(part.updatedAt) ?? new Date(0);
    case "all":
    default:
      return timeline.mostRecentAt ?? asDate(part.updatedAt) ?? new Date(0);
  }
}

export function partMatchesLabelRecency(
  part: Part,
  activity: ActivityEntry[],
  recencyFilter: LabelRecencyFilter,
  now = new Date(),
) {
  if (recencyFilter === "all") {
    return true;
  }

  const timeline = getPartLabelTimeline(part, activity);
  const hasAddedAt = timeline.addedAt ?? null;
  const hasIncreaseAt = timeline.quantityIncreasedAt ?? null;

  switch (recencyFilter) {
    case "added-today":
      return hasAddedAt ? withinWindow(hasAddedAt, labelRecencyBounds(1, now)) : false;
    case "added-last-3-days":
      return hasAddedAt ? withinWindow(hasAddedAt, labelRecencyBounds(3, now)) : false;
    case "added-last-7-days":
      return hasAddedAt ? withinWindow(hasAddedAt, labelRecencyBounds(7, now)) : false;
    case "quantity-increased-today":
      return hasIncreaseAt ? withinWindow(hasIncreaseAt, labelRecencyBounds(1, now)) : false;
    case "quantity-increased-last-3-days":
      return hasIncreaseAt ? withinWindow(hasIncreaseAt, labelRecencyBounds(3, now)) : false;
    case "quantity-increased-last-7-days":
      return hasIncreaseAt ? withinWindow(hasIncreaseAt, labelRecencyBounds(7, now)) : false;
    case "added-or-quantity-increased-today":
      return Boolean(
        (hasAddedAt && withinWindow(hasAddedAt, labelRecencyBounds(1, now))) ||
          (hasIncreaseAt && withinWindow(hasIncreaseAt, labelRecencyBounds(1, now))),
      );
    case "added-or-quantity-increased-last-3-days":
      return Boolean(
        (hasAddedAt && withinWindow(hasAddedAt, labelRecencyBounds(3, now))) ||
          (hasIncreaseAt && withinWindow(hasIncreaseAt, labelRecencyBounds(3, now))),
      );
    case "added-or-quantity-increased-last-7-days":
      return Boolean(
        (hasAddedAt && withinWindow(hasAddedAt, labelRecencyBounds(7, now))) ||
          (hasIncreaseAt && withinWindow(hasIncreaseAt, labelRecencyBounds(7, now))),
      );
    default:
      return true;
  }
}

export function filterPartsByLabelRecency(
  parts: Part[],
  activity: ActivityEntry[],
  recencyFilter: LabelRecencyFilter,
  now = new Date(),
) {
  const filtered = parts.filter((part) => partMatchesLabelRecency(part, activity, recencyFilter, now));
  return [...filtered].sort((left, right) => {
    const leftTimestamp = getPartLabelRecencySortTimestamp(left, activity, recencyFilter).getTime();
    const rightTimestamp = getPartLabelRecencySortTimestamp(right, activity, recencyFilter).getTime();
    return rightTimestamp - leftTimestamp;
  });
}

export function getSuggestedLabelQuantity(
  part: Part,
  activity: ActivityEntry[],
  recencyFilter: LabelRecencyFilter,
  now = new Date(),
) {
  if (recencyFilter === "all") {
    return 1;
  }

  const addedOnly = recencyFilter.startsWith("added-");
  const increaseOnly = recencyFilter.startsWith("quantity-increased-");
  const days = recencyFilter.includes("today") ? 1 : recencyFilter.includes("last-3") ? 3 : 7;
  const bounds = labelRecencyBounds(days, now);
  const transaction = activity
    .filter((entry) => {
      const audit = entry.audit;
      if (!audit || (audit.itemId ?? entry.entityId) !== part.id) return false;
      const quantityAdded = audit.quantityAdded ?? Math.max(audit.delta ?? 0, 0);
      if (quantityAdded <= 0 || !withinWindow(entry.occurredAt, bounds)) return false;

      const auditType = normalizeAuditType(entry);
      const isAdded = auditType === "added";
      const isIncrease =
        auditType === "quantity_increased" || (auditType === "quantity_changed" && (audit.delta ?? 0) > 0);

      if (addedOnly) return isAdded;
      if (increaseOnly) return isIncrease;
      return isAdded || isIncrease;
    })
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0];

  return Math.max(1, transaction?.audit?.quantityAdded ?? transaction?.audit?.delta ?? 1);
}

export function getLatestLabelAddition(
  part: Part,
  activity: ActivityEntry[],
  recencyFilter: LabelRecencyFilter,
  now = new Date(),
) {
  if (recencyFilter === "all") return null;

  const addedOnly = recencyFilter.startsWith("added-");
  const increaseOnly = recencyFilter.startsWith("quantity-increased-");
  const days = recencyFilter.includes("today") ? 1 : recencyFilter.includes("last-3") ? 3 : 7;
  const bounds = labelRecencyBounds(days, now);

  return activity
    .filter((entry) => {
      const audit = entry.audit;
      if (!audit || (audit.itemId ?? entry.entityId) !== part.id) return false;
      const quantityAdded = audit.quantityAdded ?? Math.max(audit.delta ?? 0, 0);
      if (quantityAdded <= 0 || !withinWindow(entry.occurredAt, bounds)) return false;

      const auditType = normalizeAuditType(entry);
      const isAdded = auditType === "added";
      const isIncrease =
        auditType === "quantity_increased" || (auditType === "quantity_changed" && (audit.delta ?? 0) > 0);
      if (addedOnly) return isAdded;
      if (increaseOnly) return isIncrease;
      return isAdded || isIncrease;
    })
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0] ?? null;
}

export function sortParts(parts: Part[], sortKey: InventorySortKey) {
  return [...parts].sort((left, right) => {
    switch (sortKey) {
      case "partNumber":
        return (
          (left.partNumber || (left.isNpn ? "NPN" : "")).localeCompare(
            right.partNumber || (right.isNpn ? "NPN" : ""),
          ) ||
          left.partName.localeCompare(right.partName) ||
          left.id.localeCompare(right.id)
        );
      case "quantity":
        return right.quantityOnHand - left.quantityOnHand || right.updatedAt.localeCompare(left.updatedAt);
      case "location":
        return (left.binId ?? "zzz").localeCompare(right.binId ?? "zzz") || left.id.localeCompare(right.id);
      case "updatedAt":
      default:
        return (
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
          left.id.localeCompare(right.id)
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
  const normalizedCategory = filters.category ? normalizeCategory(filters.category) : "";
  return parts.filter((part) => {
    if (filters.manufacturer && part.manufacturer !== filters.manufacturer) {
      return false;
    }

    if (normalizedCategory && normalizeCategory(part.category) !== normalizedCategory) {
      return false;
    }

    if (filters.partNumberState === "with-number" && part.isNpn) {
      return false;
    }

    if (filters.partNumberState === "npn" && !part.isNpn) {
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

  const categories = Array.from(
    new Set(state.parts.map((part) => normalizeCategory(part.category))),
  )
    .map((category) => {
      const parts = state.parts.filter((part) => normalizeCategory(part.category) === category);
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

export function getActivityColor(action: ActivityEntry["action"] | AuditAction) {
  switch (action) {
    case "added":
    case "imported":
    case "quantity_increased":
    case "label_printed":
      return "success";
    case "quantity_decreased":
    case "marked_npn":
      return "warning";
    case "removed":
      return "danger";
    case "adjusted":
    case "updated":
      return "info";
    case "moved":
      return "warning";
    case "printed":
    case "quantity_changed":
    case "location_changed":
    case "metadata_changed":
    case "unmarked_npn":
      return "info";
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
    "Display Part Number",
    "Part Number",
    "NPN",
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
      .map((model) => `${getModelDisplayName(model)} (${getModelSeriesLabel(model)})`)
      .join("; ");
    const displayPartNumber = getDisplayPartNumber(part, state.models);

    return [
      escapeCsvCell(displayPartNumber),
      escapeCsvCell(part.partNumber),
      escapeCsvCell(part.isNpn ? "Yes" : "No"),
      escapeCsvCell(part.partName),
      escapeCsvCell(part.manufacturer),
      escapeCsvCell(normalizeCategory(part.category)),
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
    "Display Part Number",
    "Part Number",
    "NPN",
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
          .map((model) => `${getModelDisplayName(model)} (${getModelSeriesLabel(model)})`)
          .join("; ");
    const displayPartNumber = getDisplayPartNumber(part, state.models);

    return [
      escapeCsvCell(displayPartNumber),
      escapeCsvCell(part.partNumber),
      escapeCsvCell(part.isNpn ? "Yes" : "No"),
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
  const header = [
    "Timestamp",
    "Audit Type",
    "Action",
    "Entity Type",
    "Item ID",
    "Display Part Number",
    "Part Name",
    "Quantity Before",
    "Quantity After",
    "Delta",
    "Location Before",
    "Location After",
    "User",
    "Title",
    "Detail",
  ];
  const rows = state.activity.map((entry) => {
    const metadata = entry.audit?.metadata as Record<string, unknown> | null | undefined;
    const displayPartNumber =
      (typeof metadata?.displayPartNumber === "string" && metadata.displayPartNumber) ||
      entry.audit?.nextPartNumber ||
      entry.audit?.previousPartNumber ||
      "";

    return [
      escapeCsvCell(formatDateTime(entry.occurredAt)),
      escapeCsvCell(entry.auditType ?? ""),
      escapeCsvCell(entry.action),
      escapeCsvCell(entry.entityType),
      escapeCsvCell(entry.audit?.itemId ?? entry.entityId),
      escapeCsvCell(displayPartNumber),
      escapeCsvCell(entry.audit?.itemName ?? ""),
      escapeCsvCell(entry.audit?.previousQuantity ?? ""),
      escapeCsvCell(entry.audit?.nextQuantity ?? ""),
      escapeCsvCell(entry.audit?.delta ?? ""),
      escapeCsvCell(entry.audit?.previousLocationId ?? ""),
      escapeCsvCell(entry.audit?.nextLocationId ?? ""),
      escapeCsvCell(entry.audit?.actorLabel ?? ""),
      escapeCsvCell(entry.title),
      escapeCsvCell(entry.detail),
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function countCompatiblePartsForModel(parts: Part[], modelId: string) {
  return parts.filter((part) => part.compatibleModelIds.includes(modelId)).length;
}
