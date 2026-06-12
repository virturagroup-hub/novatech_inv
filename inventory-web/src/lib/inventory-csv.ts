import Papa from "papaparse";

import { categories, type Category } from "@/lib/inventory-types";

export interface InventoryCsvRow {
  rowIndex: number;
  partNumber: string;
  isNpn: boolean;
  partName: string;
  manufacturer: string;
  category: Category;
  quantityOnHand: number;
  reorderPoint: number;
  reorderTarget: number;
  locationCode: string;
  locationName: string;
  area: string;
  shelf: number | null;
  bin: number | null;
  compatibleModelNames: string[];
  universal: boolean;
  notes: string;
  warnings: string[];
  errors: string[];
}

export interface InventoryCsvPreview {
  totalRows: number;
  readyRows: number;
  skippedRows: number;
  warningCount: number;
  errorCount: number;
  rows: InventoryCsvRow[];
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  if (["n/a", "na", "null", "undefined", "-", "none"].includes(text.toLowerCase())) {
    return "";
  }

  return text;
}

function isTruthyText(value: string) {
  return ["y", "yes", "true", "1", "flagged", "active"].includes(value.toLowerCase());
}

function readValue(row: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeCell(value)]),
  );

  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias));
    if (value) return value;
  }

  return "";
}

function splitList(value: string) {
  return value
    .split(/[,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCategory(value: string): Category {
  const match = categories.find((category) => category.toLowerCase() === value.toLowerCase());
  return match ?? "Other";
}

function deriveLocation(row: Record<string, unknown>) {
  const explicitCode = readValue(row, [
    "location code",
    "storage bin",
    "storage location",
    "bin code",
    "bin",
    "location",
  ]);
  const explicitName = readValue(row, ["location name", "bin name", "storage bin name"]);
  const area = readValue(row, ["area", "aisle", "zone"]);
  const shelf = readValue(row, ["shelf", "row", "rack"]);
  const bin = readValue(row, ["bin number", "bin", "column", "slot"]);

  const normalizedCode = explicitCode && explicitCode.toLowerCase() !== "unassigned" ? explicitCode : "";
  const parsedArea = area || (normalizedCode.includes("-") ? normalizedCode.split("-")[0] : "");
  const parsedShelf = shelf || (normalizedCode.includes("-") ? normalizedCode.split("-")[1] ?? "" : "");
  const parsedBin = bin || (normalizedCode.includes("-") ? normalizedCode.split("-")[2] ?? "" : "");

  const composedCode =
    normalizedCode ||
    (parsedArea && parsedShelf && parsedBin ? `${parsedArea}-${parsedShelf}-${parsedBin}` : "");

  return {
    locationCode: composedCode,
    locationName:
      explicitName ||
      readValue(row, ["description", "location description"]) ||
      composedCode ||
      "Imported location",
    area: parsedArea || "Imported",
    shelf: parsedShelf ? parseInteger(parsedShelf, 1) : 1,
    bin: parsedBin ? parseInteger(parsedBin, 1) : 1,
  };
}

export function parseInventoryCsv(text: string): InventoryCsvPreview {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  const rows = result.data
    .map((row, index) => {
      const warnings: string[] = [];
      const errors: string[] = [];

      const partNumber = readValue(row, ["part number", "partnumber", "part_number"]);
      const npnValue = readValue(row, ["npn", "is npn", "is_npn", "no part number"]);
      const isNpn = isTruthyText(npnValue) || partNumber.trim().toUpperCase() === "NPN";

      if (!partNumber && !isNpn) {
        errors.push("Missing part number.");
      } else if (isNpn && !partNumber) {
        warnings.push("Row is marked NPN, so the part number will be stored as blank.");
      }

      const rawPartName = readValue(row, ["part name", "partname", "part_name"]);
      const description = readValue(row, ["description", "part description"]);
      const partName = rawPartName || description || "Unnamed part";

      if (!rawPartName && description) {
        warnings.push("Part name was missing, so description was used instead.");
      } else if (!rawPartName) {
        warnings.push("Part name was missing, so Unnamed part was used.");
      }

      const manufacturerRaw = readValue(row, ["manufacturer", "manufacturers"]);
      const manufacturer = manufacturerRaw || "Imported";
      if (!manufacturerRaw) {
        warnings.push("Manufacturer was missing, so Imported was used.");
      }

      const category = normalizeCategory(
        readValue(row, ["category", "type", "part category"]) || "Other",
      );

      const quantityRaw = readValue(row, ["quantity on hand", "quantity", "qty"]);
      const quantityOnHand = quantityRaw ? parseInteger(quantityRaw, 0) : 0;
      if (!quantityRaw) {
        warnings.push("Quantity was missing, so 0 was used.");
      } else if (!Number.isFinite(Number.parseInt(quantityRaw, 10))) {
        warnings.push(`Quantity "${quantityRaw}" was not a whole number, so 0 was used.`);
      }

      const reorderPointRaw = readValue(row, ["reorder point", "reorder"]);
      const reorderTargetRaw = readValue(row, ["reorder target", "target"]);
      const reorderPoint = reorderPointRaw ? parseInteger(reorderPointRaw, 0) : 0;
      const reorderTarget = reorderTargetRaw ? parseInteger(reorderTargetRaw, 0) : 0;

      if (!reorderPointRaw) {
        warnings.push("Reorder point was missing, so 0 was used.");
      }
      if (!reorderTargetRaw) {
        warnings.push("Reorder target was missing, so 0 was used.");
      }

      const compatibleModelNames = splitList(
        readValue(row, ["compatible models", "compatible model names", "models", "compatible model"]),
      );

      const { locationCode, locationName, area, shelf, bin } = deriveLocation(row);
      if (locationCode && locationCode.toLowerCase() !== "unassigned") {
        warnings.push(`Location ${locationCode} will be created or matched during import.`);
      }

      const universalField = readValue(row, ["universal"]);
      const flaggedField = readValue(row, ["flagged"]);
      const universal =
        isTruthyText(universalField) ||
        (!compatibleModelNames.length && isTruthyText(flaggedField));

      const notes = readValue(row, ["notes", "note", "comments", "comment"]);
      if (isTruthyText(flaggedField)) {
        warnings.push("Row is flagged in the source CSV.");
      }

      return {
        rowIndex: index + 1,
        partNumber,
        isNpn,
        partName,
        manufacturer,
        category,
        quantityOnHand,
        reorderPoint,
        reorderTarget,
        locationCode,
        locationName,
        area,
        shelf,
        bin,
        compatibleModelNames,
        universal,
        notes,
        warnings,
        errors,
      } satisfies InventoryCsvRow;
    })
    .filter((row) => row.partNumber || row.isNpn || row.errors.length > 0);

  const warningCount = rows.reduce((count, row) => count + row.warnings.length, 0);
  const errorCount = rows.reduce((count, row) => count + row.errors.length, 0);
  const readyRows = rows.filter((row) => row.errors.length === 0).length;

  return {
    totalRows: rows.length,
    readyRows,
    skippedRows: rows.length - readyRows,
    warningCount,
    errorCount,
    rows,
  };
}
