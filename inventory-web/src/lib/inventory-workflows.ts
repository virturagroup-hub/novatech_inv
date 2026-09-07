import type { DeviceModel, PartDraft } from "@/lib/inventory-types";
import type { GreenMachine } from "@/lib/workspace-content-types";

export function sourceModelFor(machine: GreenMachine, models: DeviceModel[]) {
  const linked = models.find((model) => model.id === machine.modelId);
  if (linked) return linked;
  const name = (machine.modelName ?? "").trim().toLowerCase();
  const matches = models.filter((model) =>
    [
      model.name,
      `${model.manufacturer} ${model.name}`,
      `bizhub ${model.name}`,
    ].some((value) => value.trim().toLowerCase() === name),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export type SalvageStatus =
  | "on_machine"
  | "pulled_for_use"
  | "pending_inventory"
  | "inventoried"
  | "scrapped"
  | "missing"
  | "not_salvageable";
export const salvageLabels: Record<SalvageStatus, string> = {
  on_machine: "On Machine",
  pulled_for_use: "Pulled for Use",
  pending_inventory: "Pending Inventory — Service Bin",
  inventoried: "Added to Inventory",
  scrapped: "Scrapped",
  missing: "Missing / Already Removed",
  not_salvageable: "Not Salvageable / Not Worth Saving",
};
export interface SalvageItem {
  id: string;
  source_machine_id: string;
  machine_snapshot: GreenMachine;
  component_name: string;
  category: string;
  required: boolean;
  sort_order: number;
  status: SalvageStatus;
  draft: Partial<PartDraft> & { modelResolutionRequired?: boolean };
  part_id: string | null;
  actor_label: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  completed_at: string | null;
}
export interface Reservation {
  id: string;
  part_id: string | null;
  quantity: number;
  user_id: string | null;
  actor_label: string;
  status: "active" | "fulfilled" | "cancelled";
  notes: string;
  created_at: string;
  resolved_at: string | null;
}
