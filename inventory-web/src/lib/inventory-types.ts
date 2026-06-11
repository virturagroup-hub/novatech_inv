export const manufacturers = [
  "Canon",
  "HP",
  "Konica Minolta",
  "Ricoh",
  "Sharp",
  "Xerox",
  "Riso",
  "Universal",
] as const;

export type Manufacturer = (typeof manufacturers)[number];

export const categories = [
  "Accessory",
  "Drum",
  "Fuser",
  "Maintenance",
  "Other",
  "Roller",
  "Sensor",
  "Transfer",
  "Toner",
] as const;

export type Category = (typeof categories)[number];

export const activityActions = [
  "added",
  "adjusted",
  "exported",
  "imported",
  "printed",
  "removed",
  "updated",
  "moved",
] as const;

export type ActivityAction = (typeof activityActions)[number];

export type ActivityTone = "success" | "info" | "warning" | "danger";

export type InventoryViewStatus =
  | "all"
  | "attention"
  | "critical"
  | "low"
  | "unassigned"
  | "universal";

export type InventorySortKey = "updatedAt" | "partNumber" | "quantity" | "location";

export interface Bin {
  id: string;
  code: string;
  name: string;
  description: string;
  aisle: string;
  row: number;
  column: number;
  manufacturer: string | null;
  status: "active" | "inactive";
  notes?: string;
}

export type ModelStatus = "active" | "inactive";

export interface DeviceModel {
  id: string;
  manufacturer: string;
  name: string;
  series: string;
  status: ModelStatus;
  notes?: string;
}

export interface Part {
  id: string;
  partNumber: string;
  isNpn?: boolean;
  partName: string;
  manufacturer: string;
  category: Category;
  binId: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  reorderTarget: number;
  compatibleModelIds: string[];
  universal: boolean;
  notes: string;
  receivedAt: string;
  updatedAt: string;
  lastCountedAt: string;
}

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  tone: ActivityTone;
  entityType: "part" | "bin" | "model" | "inventory" | "system";
  entityId: string;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface InventorySettings {
  lowStockThreshold: number;
  defaultPrintCopies: number;
  storageMode: "browser-local" | "supabase";
  syncMode: "mock-phase-1" | "supabase";
  theme: "dark";
  updatedAt: string;
}

export interface InventoryState {
  parts: Part[];
  bins: Bin[];
  models: DeviceModel[];
  activity: ActivityEntry[];
  settings: InventorySettings;
}

export interface PartDraft {
  id?: string;
  partNumber: string;
  isNpn?: boolean;
  partName: string;
  manufacturer: string;
  category: Category;
  binId: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  reorderTarget: number;
  compatibleModelIds: string[];
  universal: boolean;
  notes: string;
}

export interface BinDraft {
  id?: string;
  code: string;
  name: string;
  description: string;
  aisle: string;
  row: number;
  column: number;
  manufacturer: string | null;
  status: "active" | "inactive";
  notes: string;
}

export interface ModelDraft {
  id?: string;
  manufacturer: string;
  name: string;
  series: string;
  status: ModelStatus;
  notes: string;
}

export interface PartFilters {
  query: string;
  manufacturer: string;
  category: string;
  binId: string;
  modelId: string;
  status: InventoryViewStatus;
}

export interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
}
