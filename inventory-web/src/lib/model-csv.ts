import Papa from "papaparse";

export interface ModelCsvRow {
  rowIndex: number;
  manufacturer: string;
  modelName: string;
  series: string;
  notes: string;
  errors: string[];
}

export interface ModelCsvPreview {
  totalRows: number;
  readyRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ModelCsvRow[];
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function readCell(row: Record<string, unknown>, aliases: string[]) {
  const values = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()]),
  );

  for (const alias of aliases) {
    const value = values.get(normalizeHeader(alias));
    if (value) return value;
  }

  return "";
}

export function parseModelCsv(text: string): ModelCsvPreview {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  const rows = result.data.map((row, index) => {
    const modelName = readCell(row, ["model_name", "model name", "model", "name"]);
    const errors = modelName ? [] : ["model_name is required."];

    return {
      rowIndex: index + 1,
      manufacturer: readCell(row, ["manufacturer", "maker"]),
      modelName,
      series: readCell(row, ["series_family", "series family", "series", "family"]),
      notes: readCell(row, ["notes", "note", "comments"]),
      errors,
    } satisfies ModelCsvRow;
  });

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    if (row.errors.length > 0) continue;

    const key = `${row.manufacturer.trim().toLowerCase()}::${row.modelName.trim().toLowerCase()}`;
    if (seen.has(key)) {
      duplicateRows += 1;
      row.errors.push("Duplicate model in this CSV; only the first row will be imported.");
    } else {
      seen.add(key);
    }
  }

  const invalidRows = rows.filter((row) => row.errors.length > 0).length;
  return {
    totalRows: rows.length,
    readyRows: rows.length - invalidRows,
    invalidRows,
    duplicateRows,
    rows,
  };
}

