export interface InventoryImportRowResult {
  rowIndex: number;
  partNumber: string;
  status: "created" | "updated" | "skipped";
  warnings: string[];
  errors: string[];
}

export interface InventoryImportSummary {
  totalRows: number;
  readyRows: number;
  skippedRows: number;
  partsCreated: number;
  partsUpdated: number;
  locationsCreated: number;
  locationsUpdated: number;
  modelsCreated: number;
  modelsUpdated: number;
  linksCreated: number;
  transactionsCreated: number;
  warningCount: number;
  errorCount: number;
  rowResults: InventoryImportRowResult[];
}

