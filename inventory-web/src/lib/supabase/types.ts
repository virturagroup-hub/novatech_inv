import type { UserRole } from "@/lib/auth";
import type { Category } from "@/lib/inventory-types";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartRow {
  id: string;
  part_number: string;
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
  transaction_type: "adjustment" | "import" | "reset" | "transfer";
  note: string | null;
  created_by: string | null;
  created_at: string;
}
