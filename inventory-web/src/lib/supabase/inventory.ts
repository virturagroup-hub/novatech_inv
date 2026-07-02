import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCategory } from "@/lib/category-normalization";
import { createDefaultSettings, createEmptyState } from "@/lib/inventory-seed";
import { profileDisplayName } from "@/lib/profile-display";
import type { ActivityEntry, Bin, DeviceModel, InventoryState, Part } from "@/lib/inventory-types";
import type { InventoryImportRowResult, InventoryImportSummary } from "@/lib/inventory-import-types";
import { parseInventoryCsv, type InventoryCsvRow } from "@/lib/inventory-csv";

import type {
  InventoryTransactionRow,
  LocationRow,
  ModelRow,
  PartModelLinkRow,
  PartRow,
  ProfileRow,
} from "./types";

type SnapshotPartRow = PartRow & {
  part_model_links?: PartModelLinkRow[] | null;
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function mapLocationRow(location: LocationRow): Bin {
  return {
    id: location.id,
    code: location.location_code,
    name: location.name || location.description || location.location_code,
    description: location.description || "",
    aisle: location.area,
    row: location.shelf,
    column: location.bin,
    manufacturer: null,
    status: location.status,
    notes: location.notes ?? undefined,
  };
}

function mapModelRow(model: ModelRow): DeviceModel {
  return {
    id: model.id,
    manufacturer: model.manufacturer,
    name: model.model_name,
    series: model.series,
    status: model.status,
    notes: model.notes ?? undefined,
  };
}

function mapPartRow(part: SnapshotPartRow, links: PartModelLinkRow[]): Part {
  return {
    id: part.id,
    partNumber: part.part_number ?? "",
    isNpn: part.is_npn,
    partName: part.part_name,
    manufacturer: part.manufacturer,
    category: normalizeCategory(part.category),
    binId: part.location_id,
    quantityOnHand: part.quantity_on_hand,
    reorderPoint: part.reorder_point,
    reorderTarget: part.reorder_target,
    compatibleModelIds: links.map((link) => link.model_id),
    universal: part.universal,
    notes: part.notes ?? "",
    receivedAt: part.created_at,
    updatedAt: part.updated_at,
    lastCountedAt: part.updated_at,
  };
}

function normalizeTransactionAuditType(
  transaction: InventoryTransactionRow,
): ActivityEntry["auditType"] {
  if (transaction.audit_type) {
    return transaction.audit_type as ActivityEntry["auditType"];
  }

  switch (transaction.transaction_type) {
    case "import":
      return "added";
    case "transfer":
      return "location_changed";
    case "reset":
      return "quantity_changed";
    case "adjustment":
    default:
      if (transaction.delta > 0) return "quantity_increased";
      if (transaction.delta < 0) return "quantity_decreased";
      return "quantity_changed";
  }
}

function mapTransactionAction(transaction: InventoryTransactionRow) {
  const auditType = normalizeTransactionAuditType(transaction);

  switch (auditType) {
    case "added":
      return "added" as const;
    case "removed":
      return "removed" as const;
    case "quantity_increased":
    case "quantity_decreased":
    case "quantity_changed":
      return "adjusted" as const;
    case "location_changed":
      return "moved" as const;
    case "metadata_changed":
    case "marked_npn":
    case "unmarked_npn":
      return "updated" as const;
    case "label_printed":
      return "printed" as const;
    default:
      return transaction.transaction_type === "import" ? "imported" as const : "updated" as const;
  }
}

function mapTransactionTone(transaction: InventoryTransactionRow) {
  const auditType = normalizeTransactionAuditType(transaction);

  switch (auditType) {
    case "added":
    case "quantity_increased":
    case "label_printed":
      return "success" as const;
    case "removed":
      return "danger" as const;
    case "quantity_decreased":
    case "location_changed":
    case "marked_npn":
      return "warning" as const;
    default:
      return transaction.delta < 0 ? ("warning" as const) : ("info" as const);
  }
}

function mapActivityRows(
  transactions: InventoryTransactionRow[],
  partLookup: Map<string, PartRow>,
  profilesById: Map<string, ProfileRow>,
): ActivityEntry[] {
  return [...transactions]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 25)
    .map((transaction) => {
      const part = partLookup.get(transaction.part_id);
      const partLabel = part
        ? `${part.is_npn ? "NPN" : part.part_number ?? "Unknown part"} · ${part.part_name}`
        : transaction.part_id;
      const auditType = normalizeTransactionAuditType(transaction);
      const actorLabel = transaction.created_by
        ? profileDisplayName(profilesById.get(transaction.created_by) ?? { full_name: null }, "")
        : transaction.actor_label ?? null;
      const deltaPrefix = transaction.delta >= 0 ? "+" : "";

      return {
        id: transaction.id,
        action: mapTransactionAction(transaction),
        tone: mapTransactionTone(transaction),
        entityType: "part",
        entityId: transaction.part_id,
        title:
          auditType === "added"
            ? `Added ${partLabel}`
            : auditType === "removed"
              ? `Removed ${partLabel}`
              : auditType === "location_changed"
                ? `Moved ${partLabel}`
                : auditType === "label_printed"
                  ? `Printed ${partLabel}`
                  : auditType === "quantity_increased"
                    ? `Quantity increased for ${partLabel}`
                    : auditType === "quantity_decreased"
                      ? `Quantity decreased for ${partLabel}`
                      : auditType === "quantity_changed"
                        ? `Quantity changed for ${partLabel}`
                        : auditType === "marked_npn"
                          ? `Marked ${partLabel} as NPN`
                          : auditType === "unmarked_npn"
                            ? `Unmarked ${partLabel} as NPN`
                            : transaction.transaction_type === "import"
                              ? `Imported ${partLabel}`
                              : transaction.transaction_type === "reset"
                                ? `Reset ${partLabel}`
                                : `Updated ${partLabel}`,
        detail:
          transaction.note ??
          `${deltaPrefix}${transaction.delta} units ${part ? `for ${part.is_npn ? "NPN" : part.part_number ?? "Unknown part"}` : ""}`.trim(),
        occurredAt: transaction.created_at,
        auditType,
        audit: {
          actorId: transaction.created_by,
          actorLabel,
          delta: transaction.delta,
          itemCategory: transaction.item_category,
          itemId: transaction.part_id,
          itemManufacturer: transaction.item_manufacturer,
          itemName: transaction.item_part_name ?? part?.part_name ?? null,
          labelCopies: transaction.label_copies,
          labelMode: transaction.label_mode,
          metadata: transaction.item_snapshot,
          nextIsNpn: transaction.next_is_npn,
          nextLocationId: transaction.next_location_id,
          nextPartNumber: transaction.next_part_number,
          nextQuantity: transaction.next_quantity,
          previousIsNpn: transaction.previous_is_npn,
          previousLocationId: transaction.previous_location_id,
          previousPartNumber: transaction.previous_part_number,
          previousQuantity: transaction.previous_quantity,
        },
      };
    });
}

export async function fetchInventorySnapshot(supabase: SupabaseClient): Promise<InventoryState> {
  const [partsResult, locationsResult, modelsResult, linksResult, transactionsResult] =
    await Promise.all([
      supabase.from("parts").select("*"),
      supabase.from("locations").select("*"),
      supabase.from("models").select("*"),
      supabase.from("part_model_links").select("*"),
      supabase.from("inventory_transactions").select("*"),
    ]);

  if (partsResult.error) throw partsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (modelsResult.error) throw modelsResult.error;
  if (linksResult.error) throw linksResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const locations = ((locationsResult.data ?? []) as LocationRow[]).map(mapLocationRow);
  const models = ((modelsResult.data ?? []) as ModelRow[]).map(mapModelRow);
  const links = (linksResult.data ?? []) as PartModelLinkRow[];
  const transactions = (transactionsResult.data ?? []) as InventoryTransactionRow[];
  const partRows = (partsResult.data ?? []) as SnapshotPartRow[];
  const actorIds = [...new Set(transactions.map((transaction) => transaction.created_by).filter((id): id is string => Boolean(id)))];
  const profilesResult =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [], error: null };

  if (profilesResult && "error" in profilesResult && profilesResult.error) {
    throw profilesResult.error;
  }

  const linksByPart = links.reduce((acc, link) => {
    const current = acc.get(link.part_id) ?? [];
    current.push(link);
    acc.set(link.part_id, current);
    return acc;
  }, new Map<string, PartModelLinkRow[]>());

  const partLookup = new Map<string, PartRow>();
  const parts = partRows.map((part) => {
    partLookup.set(part.id, part);
    return mapPartRow(part, linksByPart.get(part.id) ?? []);
  });
  const profilesById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return {
    parts,
    bins: locations,
    models,
    activity: mapActivityRows(transactions, partLookup, profilesById),
    settings: createDefaultSettings("supabase"),
  };
}

function toLocationKey(row: InventoryCsvRow) {
  return normalizeLookup(row.locationCode);
}

function toModelKey(manufacturer: string, modelName: string) {
  return `${normalizeLookup(manufacturer)}::${normalizeLookup(modelName)}`;
}

function splitModels(row: InventoryCsvRow) {
  return row.compatibleModelNames
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function importInventoryCsvToSupabase(
  supabase: SupabaseClient,
  csvText: string,
  createdByUserId: string,
  sourceName?: string,
): Promise<InventoryImportSummary> {
  const preview = parseInventoryCsv(csvText);
  const readyRows = preview.rows.filter((row) => row.errors.length === 0);

  const rows = readyRows.reduce((acc, row) => {
    if (row.isNpn || !row.partNumber.trim()) {
      acc.push(row);
      return acc;
    }

    const normalizedPartNumber = row.partNumber.toUpperCase();
    const existingIndex = acc.findIndex(
      (item) => !item.isNpn && item.partNumber.toUpperCase() === normalizedPartNumber,
    );

    if (existingIndex >= 0) {
      acc[existingIndex] = row;
    } else {
      acc.push(row);
    }

    return acc;
  }, [] as InventoryCsvRow[]);

  const [partsResult, locationsResult, modelsResult] = await Promise.all([
    supabase.from("parts").select("id, part_number, is_npn"),
    supabase.from("locations").select("id, location_code, name"),
    supabase.from("models").select("id, manufacturer, model_name"),
  ]);

  if (partsResult.error) throw partsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (modelsResult.error) throw modelsResult.error;

  const partsByNumber = new Map(
    ((partsResult.data ?? []) as PartRow[])
      .filter((part) => Boolean(part.part_number))
      .map((part) => [normalizeLookup(part.part_number ?? ""), part]),
  );
  const locationsByCode = new Map(
    ((locationsResult.data ?? []) as LocationRow[]).map((location) => [
      normalizeLookup(location.location_code),
      location,
    ]),
  );
  const modelsByKey = new Map(
    ((modelsResult.data ?? []) as ModelRow[]).map((model) => [
      toModelKey(model.manufacturer, model.model_name),
      model,
    ]),
  );

  const locationDrafts = new Map<
    string,
    {
      location_code: string;
      name: string;
      area: string;
      shelf: number;
      bin: number;
      description: string;
      status: "active";
      notes: string | null;
    }
  >();
  const modelDrafts = new Map<
    string,
    {
      manufacturer: string;
      model_name: string;
      series: string;
      status: "active";
      notes: string | null;
    }
  >();

  for (const row of rows) {
    if (row.locationCode) {
      const key = toLocationKey(row);
      locationDrafts.set(key, {
        location_code: row.locationCode,
        name: row.locationName,
        area: row.area,
        shelf: row.shelf ?? 1,
        bin: row.bin ?? 1,
        description: row.locationName,
        status: "active",
        notes: row.notes || null,
      });
    }

    for (const modelName of splitModels(row)) {
      const key = toModelKey(row.manufacturer, modelName);
      modelDrafts.set(key, {
        manufacturer: row.manufacturer,
        model_name: modelName,
        series: modelName.toLowerCase().includes("series")
          ? modelName
          : row.manufacturer || "",
        status: "active",
        notes: null,
      });
    }
  }

  let locationsCreated = 0;
  let locationsUpdated = 0;
  let modelsCreated = 0;
  let modelsUpdated = 0;

  if (locationDrafts.size > 0) {
    const locationRows = [...locationDrafts.values()];
    locationsCreated = locationRows.filter(
      (location) => !locationsByCode.has(normalizeLookup(location.location_code)),
    ).length;
    locationsUpdated = locationRows.length - locationsCreated;

    const { error } = await supabase.from("locations").upsert(locationRows, {
      onConflict: "location_code",
    });

    if (error) throw error;
  }

  if (modelDrafts.size > 0) {
    const modelRows = [...modelDrafts.values()];
    modelsCreated = modelRows.filter((model) => !modelsByKey.has(toModelKey(model.manufacturer, model.model_name))).length;
    modelsUpdated = modelRows.length - modelsCreated;

    const { error } = await supabase.from("models").upsert(modelRows, {
      onConflict: "manufacturer,model_name",
    });

    if (error) throw error;
  }

  const [refetchedLocations, refetchedModels] = await Promise.all([
    supabase.from("locations").select("id, location_code, name"),
    supabase.from("models").select("id, manufacturer, model_name"),
  ]);

  if (refetchedLocations.error) throw refetchedLocations.error;
  if (refetchedModels.error) throw refetchedModels.error;

  const locationIdByCode = new Map(
    ((refetchedLocations.data ?? []) as LocationRow[]).map((location) => [
      normalizeLookup(location.location_code),
      location.id,
    ]),
  );
  const modelIdByKey = new Map(
    ((refetchedModels.data ?? []) as ModelRow[]).map((model) => [
      toModelKey(model.manufacturer, model.model_name),
      model.id,
    ]),
  );

  const preparedPartRows = rows.map((row) => {
    const id = crypto.randomUUID();
    return {
      sourceRow: row,
      tempId: id,
      row: {
        id,
        part_number: row.isNpn ? null : row.partNumber,
        is_npn: row.isNpn,
        part_name: row.partName,
        manufacturer: row.manufacturer,
        category: row.category,
        location_id: row.locationCode ? locationIdByCode.get(toLocationKey(row)) ?? null : null,
        quantity_on_hand: row.quantityOnHand,
        reorder_point: row.reorderPoint,
        reorder_target: row.reorderTarget,
        universal: row.universal,
        notes: row.notes || "",
      },
    };
  });

  const partRows = preparedPartRows.map((entry) => entry.row);

  const partsCreated = preparedPartRows.filter(({ row }) => {
    if (row.is_npn) {
      return true;
    }

    return !partsByNumber.has(normalizeLookup(row.part_number ?? ""));
  }).length;
  const partsUpdated = partRows.length - partsCreated;

  const { data: upsertedParts, error: partsError } = await supabase
    .from("parts")
    .upsert(partRows, { onConflict: "part_number" })
    .select("id, part_number, is_npn");

  if (partsError) throw partsError;

  const partIdByNumber = new Map(
    ((upsertedParts ?? []) as PartRow[])
      .filter((part) => Boolean(part.part_number))
      .map((part) => [normalizeLookup(part.part_number ?? ""), part.id]),
  );

  const getPreparedPartId = (preparedRow: (typeof preparedPartRows)[number]) => {
    const row = preparedRow.sourceRow;
    return row.isNpn
      ? preparedRow.tempId
      : partIdByNumber.get(normalizeLookup(row.partNumber)) ?? preparedRow.tempId;
  };

  const importLinks: Array<{ part_id: string; model_id: string }> = [];
  for (const preparedRow of preparedPartRows) {
    const row = preparedRow.sourceRow;
    const partId = getPreparedPartId(preparedRow);
    if (!partId) continue;

    const modelNames = splitModels(row);
    for (const modelName of modelNames) {
      const modelId = modelIdByKey.get(toModelKey(row.manufacturer, modelName));
      if (!modelId) continue;
      importLinks.push({ part_id: partId, model_id: modelId });
    }
  }

  const partIds = [...new Set(
    preparedPartRows.map((preparedRow) => getPreparedPartId(preparedRow)),
  )];
  if (partIds.length > 0) {
    const { error } = await supabase.from("part_model_links").delete().in("part_id", partIds);
    if (error) throw error;
  }

  let linksCreated = 0;
  if (importLinks.length > 0) {
    const { error } = await supabase.from("part_model_links").insert(importLinks);
    if (error) throw error;
    linksCreated = importLinks.length;
  }

  const importTransactions = preparedPartRows
    .filter(({ sourceRow }) => sourceRow.quantityOnHand !== 0)
    .map((preparedRow) => ({
      part_id: getPreparedPartId(preparedRow),
      transaction_type: "import" as const,
      delta: preparedRow.sourceRow.quantityOnHand,
      note: sourceName
        ? `Imported from ${sourceName}`
        : "Imported from CSV",
      created_by: createdByUserId,
    }));

  let transactionsCreated = 0;
  if (importTransactions.length > 0) {
    const { error } = await supabase.from("inventory_transactions").insert(importTransactions);
    if (error) throw error;
    transactionsCreated = importTransactions.length;
  }

  const rowResults: InventoryImportRowResult[] = preview.rows.map((row) => {
    if (row.errors.length > 0) {
      return {
        rowIndex: row.rowIndex,
        partNumber: row.partNumber,
        status: "skipped",
        warnings: row.warnings,
        errors: row.errors,
      };
    }

    const existed = partsByNumber.has(normalizeLookup(row.partNumber));

    return {
      rowIndex: row.rowIndex,
      partNumber: row.partNumber,
      status: existed ? "updated" : "created",
      warnings: row.warnings,
      errors: row.errors,
    };
  });

  return {
    totalRows: preview.totalRows,
    readyRows: rows.length,
    skippedRows: preview.rows.length - rows.length,
    partsCreated,
    partsUpdated,
    locationsCreated,
    locationsUpdated,
    modelsCreated,
    modelsUpdated,
    linksCreated,
    transactionsCreated,
    warningCount: preview.warningCount,
    errorCount: preview.errorCount,
    rowResults,
  };
}

export function mapSupabaseSnapshotToEmptyState() {
  return createEmptyState("supabase");
}
