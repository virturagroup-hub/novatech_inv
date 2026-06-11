import type { SupabaseClient } from "@supabase/supabase-js";

import { createDefaultSettings, createEmptyState } from "@/lib/inventory-seed";
import type { ActivityEntry, Bin, DeviceModel, InventoryState, Part } from "@/lib/inventory-types";
import { categories, type Category } from "@/lib/inventory-types";
import type { InventoryImportRowResult, InventoryImportSummary } from "@/lib/inventory-import-types";
import { parseInventoryCsv, type InventoryCsvRow } from "@/lib/inventory-csv";

import type {
  InventoryTransactionRow,
  LocationRow,
  ModelRow,
  PartModelLinkRow,
  PartRow,
} from "./types";

type SnapshotPartRow = PartRow & {
  part_model_links?: PartModelLinkRow[] | null;
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCategory(value: string): Category {
  return (
    categories.find((category) => category.toLowerCase() === value.toLowerCase()) ?? "Other"
  );
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

function mapTransactionAction(transaction: InventoryTransactionRow["transaction_type"]) {
  switch (transaction) {
    case "import":
      return "imported" as const;
    case "adjustment":
    case "transfer":
      return "adjusted" as const;
    case "reset":
      return "updated" as const;
    default:
      return "updated" as const;
  }
}

function mapTransactionTone(transaction: InventoryTransactionRow) {
  if (transaction.transaction_type === "import") return "success" as const;
  if (transaction.delta < 0) return "danger" as const;
  if (transaction.delta > 0) return "info" as const;
  return "warning" as const;
}

function mapActivityRows(
  transactions: InventoryTransactionRow[],
  partLookup: Map<string, PartRow>,
): ActivityEntry[] {
  return [...transactions]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 25)
    .map((transaction) => {
      const part = partLookup.get(transaction.part_id);
      const partLabel = part
        ? `${part.is_npn ? "NPN" : part.part_number ?? "Unknown part"} · ${part.part_name}`
        : transaction.part_id;
      const deltaPrefix = transaction.delta >= 0 ? "+" : "";

      return {
        id: transaction.id,
        action: mapTransactionAction(transaction.transaction_type),
        tone: mapTransactionTone(transaction),
        entityType: "part",
        entityId: transaction.part_id,
        title:
          transaction.transaction_type === "import"
            ? `Imported ${partLabel}`
            : transaction.transaction_type === "reset"
              ? `Reset ${partLabel}`
              : `Adjusted ${partLabel}`,
        detail:
          transaction.note ??
          `${deltaPrefix}${transaction.delta} units ${part ? `for ${part.is_npn ? "NPN" : part.part_number ?? "Unknown part"}` : ""}`.trim(),
        occurredAt: transaction.created_at,
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

  return {
    parts,
    bins: locations,
    models,
    activity: mapActivityRows(transactions, partLookup),
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

  const uniqueRows = [...readyRows].reduce((map, row) => {
    map.set(row.partNumber.toUpperCase(), row);
    return map;
  }, new Map<string, InventoryCsvRow>());

  const rows = [...uniqueRows.values()];

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

  const partRows = rows.map((row) => ({
    part_number: row.partNumber,
    is_npn: false,
    part_name: row.partName,
    manufacturer: row.manufacturer,
    category: row.category,
    location_id: row.locationCode ? locationIdByCode.get(toLocationKey(row)) ?? null : null,
    quantity_on_hand: row.quantityOnHand,
    reorder_point: row.reorderPoint,
    reorder_target: row.reorderTarget,
    universal: row.universal,
    notes: row.notes || "",
  }));

  const partsCreated = partRows.filter((part) => !partsByNumber.has(normalizeLookup(part.part_number))).length;
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

  const importLinks: Array<{ part_id: string; model_id: string }> = [];
  for (const row of rows) {
    const partId = partIdByNumber.get(normalizeLookup(row.partNumber));
    if (!partId) continue;

    const modelNames = splitModels(row);
    for (const modelName of modelNames) {
      const modelId = modelIdByKey.get(toModelKey(row.manufacturer, modelName));
      if (!modelId) continue;
      importLinks.push({ part_id: partId, model_id: modelId });
    }
  }

  const partIds = [...partIdByNumber.values()];
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

  const importTransactions = rows
    .filter((row) => row.quantityOnHand !== 0)
    .map((row) => ({
      part_id: partIdByNumber.get(normalizeLookup(row.partNumber)) ?? "",
      transaction_type: "import" as const,
      delta: row.quantityOnHand,
      note: sourceName
        ? `Imported from ${sourceName}`
        : "Imported from CSV",
      created_by: createdByUserId,
    }))
    .filter((row) => row.part_id);

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
