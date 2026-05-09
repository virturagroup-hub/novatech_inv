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
}: {
  action: ActivityAction;
  tone: ActivityTone;
  entityType: ActivityEntry["entityType"];
  entityId: string;
  title: string;
  detail: string;
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

function upsertPartDraft(state: InventoryState, draft: PartDraft) {
  const existing = state.parts.find(
    (part) => part.id === draft.id || part.partNumber.toLowerCase() === draft.partNumber.toLowerCase(),
  );
  const now = timestamp();
  const part: Part = {
    id: existing?.id ?? draft.id ?? crypto.randomUUID(),
    partNumber: normalizeText(draft.partNumber).toUpperCase(),
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
      const next = upsertPartDraft(state, action.part);
      const entry = createActivity({
        action: "updated",
        tone: "info",
        entityType: "part",
        entityId: action.part.id ?? action.part.partNumber,
        title: "Part saved",
        detail: `${action.part.partNumber} was added or updated in the inventory.`,
      });
      return pushActivity(next, entry);
    }

    case "deletePart": {
      const removed = state.parts.find((part) => part.id === action.partId);
      if (!removed) return state;

      const next: InventoryState = {
        ...state,
        parts: state.parts.filter((part) => part.id !== action.partId),
      };

      return pushActivity(
        next,
        createActivity({
          action: "removed",
          tone: "danger",
          entityType: "part",
          entityId: action.partId,
          title: "Part removed",
          detail: `${removed.partNumber} was removed from the active inventory.`,
        }),
      );
    }

    case "adjustPart": {
      const part = state.parts.find((item) => item.id === action.partId);
      if (!part) return state;

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

      return pushActivity(
        next,
        createActivity({
          action: "adjusted",
          tone: action.delta >= 0 ? "success" : "warning",
          entityType: "inventory",
          entityId: action.partId,
          title: action.delta >= 0 ? "Quantity increased" : "Quantity reduced",
          detail: `${part.partNumber} moved from ${part.quantityOnHand} to ${nextQuantity}.`,
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
