import type { UserRole } from "@/lib/auth";
import type { Category } from "@/lib/inventory-types";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartRow {
  id: string;
  part_number: string | null;
  is_npn: boolean;
  part_name: string;
  manufacturer: string;
  category: Category;
  location_id: string | null;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_target: number;
  universal: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface LocationRow {
  id: string;
  location_code: string;
  name: string;
  area: string;
  shelf: number;
  bin: number;
  description: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface ModelRow {
  id: string;
  manufacturer: string;
  model_name: string;
  series: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface PartModelLinkRow {
  part_id: string;
  model_id: string;
  created_at: string;
}

export interface InventoryTransactionRow {
  id: string;
  part_id: string;
  delta: number;
  transaction_type: string;
  audit_type: string | null;
  previous_quantity: number | null;
  next_quantity: number | null;
  previous_location_id: string | null;
  next_location_id: string | null;
  previous_part_number: string | null;
  next_part_number: string | null;
  previous_is_npn: boolean | null;
  next_is_npn: boolean | null;
  item_part_name: string | null;
  item_manufacturer: string | null;
  item_category: Category | null;
  item_snapshot: Record<string, unknown> | null;
  label_mode: string | null;
  label_copies: number | null;
  note: string | null;
  created_by: string | null;
  actor_label: string | null;
  quantity_added: number;
  source: string | null;
  machine_id: string | null;
  machine_event_id: string | null;
  batch_id: string | null;
  created_at: string;
}
