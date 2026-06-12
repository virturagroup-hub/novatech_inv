import { createSeedState } from "./inventory-seed";
import type {
  ActivityAction,
  ActivityEntry,
  ActivityTone,
  Bin,
  BinDraft,
  DeviceModel,
  InventorySettings,
  InventoryState,
  ModelDraft,
  Part,
  PartDraft,
} from "./inventory-types";

export interface PartImportRow {
  partNumber: string;
  isNpn?: boolean;
  partName: string;
  manufacturer: string;
  category: Part["category"];
  quantityOnHand: number;
  reorderPoint: number;
  reorderTarget: number;
  binCode: string;
  compatibleModelNames: string[];
  universal: boolean;
  notes: string;
}

export type InventoryAction =
  | { type: "hydrate"; state: InventoryState }
  | { type: "reset" }
  | { type: "upsertPart"; part: PartDraft }
  | { type: "deletePart"; partId: string }
  | { type: "adjustPart"; partId: string; delta: number }
  | { type: "upsertBin"; bin: BinDraft }
  | { type: "deleteBin"; binId: string }
  | { type: "setBinStatus"; binId: string; status: "active" | "inactive" }
  | { type: "upsertModel"; model: ModelDraft }
  | { type: "deleteModel"; modelId: string }
  | { type: "setModelStatus"; modelId: string; status: "active" | "inactive" }
  | { type: "importParts"; rows: PartImportRow[] }
  | {
      type: "logLabelPrint";
      partIds: string[];
      labelMode: string;
      copies: number;
      includeZero: boolean;
    }
  | { type: "updateSettings"; settings: Partial<InventorySettings> };

function timestamp() {
  return new Date().toISOString();
}

function createActivity({
  action,
  tone,
  entityType,
  entityId,
  title,
  detail,
  auditType,
  audit,
}: {
  action: ActivityAction;
  tone: ActivityTone;
  entityType: ActivityEntry["entityType"];
  entityId: string;
  title: string;
  detail: string;
  auditType?: ActivityEntry["auditType"];
  audit?: ActivityEntry["audit"];
}): ActivityEntry {
  return {
    id: `activity-${crypto.randomUUID()}`,
    action,
    tone,
    entityType,
    entityId,
    title,
    detail,
    occurredAt: timestamp(),
    auditType,
    audit,
  };
}

function pushActivity(state: InventoryState, entry: ActivityEntry) {
  return {
    ...state,
    activity: [entry, ...state.activity].slice(0, 120),
  };
}

function normalizeText(value: string) {
  return value.trim();
}

function getPartLabel(part: Pick<Part, "partNumber" | "isNpn">) {
  return part.isNpn ? "NPN" : part.partNumber || "Unknown part";
}

function buildPartAuditMetadata(
  previous: Part | null,
  next: Pick<
    Part,
    | "id"
    | "partNumber"
    | "isNpn"
    | "partName"
    | "manufacturer"
    | "category"
    | "binId"
    | "quantityOnHand"
    | "reorderPoint"
    | "reorderTarget"
    | "universal"
    | "notes"
    | "compatibleModelIds"
  >,
  extras?: {
    actorLabel?: string | null;
    labelCopies?: number | null;
    labelMode?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Pick<ActivityEntry, "auditType" | "audit"> {
  const previousQuantity = previous?.quantityOnHand ?? null;
  const nextQuantity = Math.max(0, Number(next.quantityOnHand) || 0);
  const previousLocationId = previous?.binId ?? null;
  const nextLocationId = next.binId ?? null;
  const previousPartNumber = previous ? (previous.isNpn ? null : previous.partNumber || null) : null;
  const nextPartNumber = next.isNpn ? null : next.partNumber || null;
  const previousIsNpn = previous?.isNpn ?? null;
  const nextIsNpn = Boolean(next.isNpn);
  const previousModels = JSON.stringify(previous?.compatibleModelIds ?? []);
  const nextModels = JSON.stringify(next.compatibleModelIds ?? []);
  const metadataChanged =
    !previous ||
    previous.partName !== next.partName ||
    previous.manufacturer !== next.manufacturer ||
    previous.category !== next.category ||
    previous.reorderPoint !== next.reorderPoint ||
    previous.reorderTarget !== next.reorderTarget ||
    previous.universal !== next.universal ||
    previous.notes !== next.notes ||
    previousPartNumber !== nextPartNumber ||
    previousLocationId !== nextLocationId ||
    previousIsNpn !== nextIsNpn ||
    previousModels !== nextModels;

  let auditType: ActivityEntry["auditType"] = "metadata_changed";

  if (!previous) {
    auditType = "added";
  } else if (previousQuantity !== nextQuantity) {
    const delta = nextQuantity - (previousQuantity ?? 0);
    auditType = delta > 0 ? "quantity_increased" : delta < 0 ? "quantity_decreased" : "quantity_changed";
  } else if (previousLocationId !== nextLocationId) {
    auditType = "location_changed";
  } else if (previousIsNpn !== nextIsNpn) {
    auditType = nextIsNpn ? "marked_npn" : "unmarked_npn";
  } else if (metadataChanged) {
    auditType = "metadata_changed";
  }

  return {
    auditType,
    audit: {
      actorLabel: extras?.actorLabel ?? null,
      delta: previousQuantity === null ? null : nextQuantity - previousQuantity,
      itemCategory: next.category,
      itemId: next.id,
      itemManufacturer: next.manufacturer,
      itemName: next.partName,
      labelCopies: extras?.labelCopies ?? null,
      labelMode: extras?.labelMode ?? null,
      metadata: extras?.metadata ?? null,
      nextIsNpn,
      nextLocationId,
      nextPartNumber,
      nextQuantity,
      previousIsNpn,
      previousLocationId,
      previousPartNumber,
      previousQuantity,
    },
  };
}

function upsertPartDraft(state: InventoryState, draft: PartDraft) {
  const isNpn = Boolean(draft.isNpn);
  const normalizedPartNumber = normalizeText(draft.partNumber).toUpperCase();
  const existing = state.parts.find((part) => {
    if (part.id === draft.id) {
      return true;
    }

    if (isNpn || part.isNpn) {
      return false;
    }

    return part.partNumber.toLowerCase() === normalizedPartNumber.toLowerCase();
  });
  const now = timestamp();
  const part: Part = {
    id: existing?.id ?? draft.id ?? crypto.randomUUID(),
    partNumber: isNpn ? "" : normalizedPartNumber,
    isNpn,
    partName: normalizeText(draft.partName),
    manufacturer: normalizeText(draft.manufacturer),
    category: draft.category,
    binId: draft.binId || null,
    quantityOnHand: Math.max(0, Number(draft.quantityOnHand) || 0),
    reorderPoint: Math.max(0, Number(draft.reorderPoint) || 0),
    reorderTarget: Math.max(0, Number(draft.reorderTarget) || 0),
    compatibleModelIds: [...new Set(draft.compatibleModelIds)],
    universal: draft.universal,
    notes: normalizeText(draft.notes),
    receivedAt: existing?.receivedAt ?? now,
    updatedAt: now,
    lastCountedAt: existing?.lastCountedAt ?? now,
  };

  const parts = existing
    ? state.parts.map((item) => (item.id === existing.id ? part : item))
    : [part, ...state.parts];

  return {
    ...state,
    parts,
  };
}

function upsertBinDraft(state: InventoryState, draft: BinDraft) {
  const existing = state.bins.find(
    (bin) => bin.id === draft.id || bin.code.toLowerCase() === draft.code.toLowerCase(),
  );
  const bin: Bin = {
    id: existing?.id ?? draft.id ?? crypto.randomUUID(),
    code: normalizeText(draft.code).toUpperCase(),
    name: normalizeText(draft.name),
    description: normalizeText(draft.description),
    aisle: normalizeText(draft.aisle).toUpperCase(),
    row: Number(draft.row) || 1,
    column: Number(draft.column) || 1,
    manufacturer: draft.manufacturer ? normalizeText(draft.manufacturer) : null,
    status: draft.status,
    notes: normalizeText(draft.notes) || undefined,
  };

  const bins = existing
    ? state.bins.map((item) => (item.id === existing.id ? bin : item))
    : [bin, ...state.bins];

  return {
    ...state,
    bins,
  };
}

function upsertModelDraft(state: InventoryState, draft: ModelDraft) {
  const existing = state.models.find(
    (model) =>
      model.id === draft.id ||
      (model.manufacturer.toLowerCase() === draft.manufacturer.toLowerCase() &&
        model.name.toLowerCase() === draft.name.toLowerCase()),
  );
  const model: DeviceModel = {
    id: existing?.id ?? draft.id ?? crypto.randomUUID(),
    manufacturer: normalizeText(draft.manufacturer),
    name: normalizeText(draft.name),
    series: normalizeText(draft.series),
    status: draft.status,
    notes: normalizeText(draft.notes) || undefined,
  };

  const models = existing
    ? state.models.map((item) => (item.id === existing.id ? model : item))
    : [model, ...state.models];

  return {
    ...state,
    models,
  };
}

function importPartRow(state: InventoryState, row: PartImportRow) {
  const matchedBin = state.bins.find(
    (bin) => bin.code.toLowerCase() === row.binCode.trim().toLowerCase(),
  );
  const matchedModelIds = row.compatibleModelNames
    .map((modelName) => {
      const normalized = modelName.trim().toLowerCase();
      return state.models.find(
        (model) =>
          `${model.manufacturer} ${model.name}`.toLowerCase() === normalized ||
          model.name.toLowerCase() === normalized,
      )?.id;
    })
    .filter(Boolean) as string[];

  return upsertPartDraft(state, {
    partNumber: row.partNumber,
    isNpn: row.isNpn,
    partName: row.partName,
    manufacturer: row.manufacturer,
    category: row.category,
    binId: matchedBin?.id ?? null,
    quantityOnHand: row.quantityOnHand,
    reorderPoint: row.reorderPoint,
    reorderTarget: row.reorderTarget,
    compatibleModelIds: matchedModelIds,
    universal: row.universal,
    notes: row.notes,
  });
}

export function inventoryReducer(
  state: InventoryState,
  action: InventoryAction,
): InventoryState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "reset":
      return createSeedState();

    case "upsertPart": {
      const draft = {
        ...action.part,
        id: action.part.id ?? crypto.randomUUID(),
      };
      const normalizedPartNumber = normalizeText(draft.partNumber).toUpperCase();
      const existing = state.parts.find((part) => {
        if (part.id === draft.id) {
          return true;
        }

        if (draft.isNpn || part.isNpn) {
          return false;
        }

        return part.partNumber.toLowerCase() === normalizedPartNumber.toLowerCase();
      });
      const next = upsertPartDraft(state, draft);
      const saved = next.parts.find((part) => part.id === (existing?.id ?? draft.id)) ?? null;
      const audit = buildPartAuditMetadata(existing ?? null, saved ?? draft, {
        metadata: {
          compatibleModelIds: saved?.compatibleModelIds ?? draft.compatibleModelIds,
        },
      });
      const partLabel = getPartLabel(draft);
      const entry = createActivity({
        action: existing ? "updated" : "added",
        tone: existing ? "info" : "success",
        entityType: "part",
        entityId: saved?.id ?? draft.id,
        title: existing ? "Part updated" : "Part added",
        detail: `${partLabel} was ${existing ? "updated" : "added"} in the inventory.`,
        auditType: audit.auditType,
        audit: audit.audit,
      });
      return pushActivity(next, entry);
    }

    case "deletePart": {
      const removed = state.parts.find((part) => part.id === action.partId);
      if (!removed) return state;
      const removedLabel = getPartLabel(removed);

      const next: InventoryState = {
        ...state,
        parts: state.parts.filter((part) => part.id !== action.partId),
      };

      const audit = buildPartAuditMetadata(removed, {
        id: removed.id,
        partNumber: removed.partNumber,
        isNpn: removed.isNpn,
        partName: removed.partName,
        manufacturer: removed.manufacturer,
        category: removed.category,
        binId: removed.binId,
        quantityOnHand: 0,
        reorderPoint: removed.reorderPoint,
        reorderTarget: removed.reorderTarget,
        universal: removed.universal,
        notes: removed.notes,
        compatibleModelIds: removed.compatibleModelIds,
      });

      return pushActivity(
        next,
        createActivity({
          action: "removed",
          tone: "danger",
          entityType: "part",
          entityId: action.partId,
          title: "Part removed",
          detail: `${removedLabel} was removed from the active inventory.`,
          auditType: "removed",
          audit: audit.audit,
        }),
      );
    }

    case "adjustPart": {
      const part = state.parts.find((item) => item.id === action.partId);
      if (!part) return state;
      const partLabel = getPartLabel(part);

      const nextQuantity = Math.max(0, part.quantityOnHand + action.delta);
      const now = timestamp();
      const next: InventoryState = {
        ...state,
        parts: state.parts.map((item) =>
          item.id === action.partId
            ? {
                ...item,
                quantityOnHand: nextQuantity,
                updatedAt: now,
                lastCountedAt: now,
              }
            : item,
        ),
      };

      const updatedPart = next.parts.find((item) => item.id === action.partId) ?? {
        ...part,
        quantityOnHand: nextQuantity,
      };
      const audit = buildPartAuditMetadata(part, {
        ...updatedPart,
        quantityOnHand: nextQuantity,
      });

      return pushActivity(
        next,
        createActivity({
          action: "adjusted",
          tone: action.delta >= 0 ? "success" : "warning",
          entityType: "inventory",
          entityId: action.partId,
          title: action.delta >= 0 ? "Quantity increased" : "Quantity reduced",
          detail: `${partLabel} moved from ${part.quantityOnHand} to ${nextQuantity}.`,
          auditType: audit.auditType,
          audit: audit.audit,
        }),
      );
    }

    case "upsertBin": {
      const next = upsertBinDraft(state, action.bin);
      const entry = createActivity({
        action: "updated",
        tone: "info",
        entityType: "bin",
        entityId: action.bin.id ?? action.bin.code,
        title: "Bin saved",
        detail: `${action.bin.code} was added or updated in the storage map.`,
      });
      return pushActivity(next, entry);
    }

    case "deleteBin": {
      const removed = state.bins.find((bin) => bin.id === action.binId);
      if (!removed) return state;
      const now = timestamp();
      const next: InventoryState = {
        ...state,
        bins: state.bins.filter((bin) => bin.id !== action.binId),
        parts: state.parts.map((part) =>
          part.binId === action.binId
            ? {
                ...part,
                binId: null,
                updatedAt: now,
              }
            : part,
        ),
      };

      return pushActivity(
        next,
        createActivity({
          action: "removed",
          tone: "warning",
          entityType: "bin",
          entityId: action.binId,
          title: "Bin removed",
          detail: `${removed.code} was deleted and any assigned parts were marked unassigned.`,
        }),
      );
    }

    case "setBinStatus": {
      const bin = state.bins.find((item) => item.id === action.binId);
      if (!bin) return state;

      const next: InventoryState = {
        ...state,
        bins: state.bins.map((item) =>
          item.id === action.binId ? { ...item, status: action.status } : item,
        ),
      };

      return pushActivity(
        next,
        createActivity({
          action: "updated",
          tone: action.status === "active" ? "success" : "warning",
          entityType: "bin",
          entityId: action.binId,
          title: action.status === "active" ? "Bin restored" : "Bin archived",
          detail: `${bin.code} was marked ${action.status}.`,
        }),
      );
    }

    case "upsertModel": {
      const next = upsertModelDraft(state, action.model);
      return pushActivity(
        next,
        createActivity({
          action: "updated",
          tone: "info",
          entityType: "model",
          entityId: action.model.id ?? action.model.name,
          title: "Model saved",
          detail: `${action.model.manufacturer} ${action.model.name} is available for compatibility checks.`,
        }),
      );
    }

    case "deleteModel": {
      const removed = state.models.find((model) => model.id === action.modelId);
      if (!removed) return state;
      const now = timestamp();
      const next: InventoryState = {
        ...state,
        models: state.models.filter((model) => model.id !== action.modelId),
        parts: state.parts.map((part) =>
          part.compatibleModelIds.includes(action.modelId)
            ? {
                ...part,
                compatibleModelIds: part.compatibleModelIds.filter(
                  (modelId) => modelId !== action.modelId,
                ),
                updatedAt: now,
              }
            : part,
        ),
      };

      return pushActivity(
        next,
        createActivity({
          action: "removed",
          tone: "warning",
          entityType: "model",
          entityId: action.modelId,
          title: "Model removed",
          detail: `${removed.manufacturer} ${removed.name} was removed from the model list.`,
        }),
      );
    }

    case "setModelStatus": {
      const model = state.models.find((item) => item.id === action.modelId);
      if (!model) return state;

      const next: InventoryState = {
        ...state,
        models: state.models.map((item) =>
          item.id === action.modelId ? { ...item, status: action.status } : item,
        ),
      };

      return pushActivity(
        next,
        createActivity({
          action: "updated",
          tone: action.status === "active" ? "success" : "warning",
          entityType: "model",
          entityId: action.modelId,
          title: action.status === "active" ? "Model restored" : "Model archived",
          detail: `${model.manufacturer} ${model.name} was marked ${action.status}.`,
        }),
      );
    }

    case "importParts": {
      let next = state;
      action.rows.forEach((row) => {
        next = importPartRow(next, row);
      });

      return pushActivity(
        next,
        createActivity({
          action: "imported",
          tone: "success",
          entityType: "inventory",
          entityId: "import",
          title: "CSV imported",
          detail: `${action.rows.length} part row${action.rows.length === 1 ? "" : "s"} were imported into the current inventory source.`,
        }),
      );
    }

    case "logLabelPrint": {
      const firstPart = state.parts.find((part) => part.id === action.partIds[0]) ?? null;
      const entry = createActivity({
        action: "printed",
        tone: "success",
        entityType: "inventory",
        entityId: action.partIds[0] ?? "print-job",
        title: "Labels printed",
        detail:
          action.partIds.length > 0
            ? `${action.partIds.length} label${action.partIds.length === 1 ? "" : "s"} printed${action.labelMode ? ` in ${action.labelMode} mode` : ""}.`
            : "A label print job completed.",
        auditType: "label_printed",
        audit: {
          itemId: firstPart?.id ?? action.partIds[0] ?? "print-job",
          itemName: firstPart?.partName ?? null,
          itemManufacturer: firstPart?.manufacturer ?? null,
          itemCategory: firstPart?.category ?? null,
          nextIsNpn: firstPart?.isNpn ?? null,
          nextPartNumber: firstPart ? getPartLabel(firstPart) : null,
          labelMode: action.labelMode,
          labelCopies: action.copies,
          metadata: {
            includeZero: action.includeZero,
            partIds: action.partIds,
          },
        },
      });

      return pushActivity(state, entry);
    }

    case "updateSettings":
      return pushActivity(
        {
          ...state,
          settings: {
            ...state.settings,
            ...action.settings,
            updatedAt: timestamp(),
          },
        },
        createActivity({
          action: "updated",
          tone: "info",
          entityType: "system",
          entityId: "settings",
          title: "Settings saved",
          detail: "Local inventory settings were updated in the current inventory source.",
        }),
      );

    default:
      return state;
  }
}
