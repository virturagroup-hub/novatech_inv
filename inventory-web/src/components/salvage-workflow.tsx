"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { PartEditorSheet } from "@/components/part-editor-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { isElevatedRole } from "@/lib/auth";
import { normalizeCategory, type PartDraft } from "@/lib/inventory-types";
import {
  salvageLabels,
  sourceModelFor,
  type SalvageItem,
  type SalvageStatus,
} from "@/lib/inventory-workflows";
import type { GreenMachine } from "@/lib/workspace-content-types";

export function SalvageWorkflow({ machine }: { machine?: GreenMachine }) {
  const { permissions, effectiveRole } = useAuth();
  const { models, isSupabaseMode, refreshInventory } = useInventory();
  const { refreshWorkspace } = useWorkspaceContent();
  const [client] = useState(createClient);
  const [items, setItems] = useState<SalvageItem[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [minAge, setMinAge] = useState("0");
  const [busy, setBusy] = useState(false);
  const [modelChoices, setModelChoices] = useState<Record<string, string>>({});
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [editor, setEditor] = useState<{
    item: SalvageItem;
    action: "inventoried" | "pending_inventory";
    draft: PartDraft;
  } | null>(null);
  const machineId = machine?.id;
  const reload = useCallback(async () => {
    if (!isSupabaseMode) return;
    let request = client
      .from("machine_salvage_items")
      .select("*")
      .order("sort_order");
    request = machineId
      ? request.eq("source_machine_id", machineId)
      : request.eq("status", "pending_inventory").order("resolved_at");
    const result = await request;
    if (result.error) {
      setError(
        "Unable to load salvage records. Check the connection and database migration.",
      );
      return;
    }
    setItems(result.data as SalvageItem[]);
    setError("");
    setLoadedAt(Date.now());
  }, [client, isSupabaseMode, machineId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void reload();
    });
    window.addEventListener("focus", reload);
    return () => {
      active = false;
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  function openEditor(
    item: SalvageItem,
    action: "inventoried" | "pending_inventory",
  ) {
    const model = sourceModelFor(item.status === "pending_inventory" ? item.machine_snapshot : machine ?? item.machine_snapshot, models);
    if (!model && action === "inventoried") {
      toast.error(
        "Save to the Service Bin first. Admin/Manager can resolve the source model in Pending Inventory.",
      );
      return;
    }
    const draft: PartDraft = {
      partNumber: "",
      isNpn: false,
      partName: item.component_name,
      manufacturer: model?.manufacturer ?? "Universal",
      category: normalizeCategory(item.category),
      quantityOnHand: 1,
      binId: null,
      reorderPoint: 0,
      reorderTarget: 0,
      compatibleModelIds: [],
      universal: false,
      notes: "",
      ...item.draft,
    };
    draft.compatibleModelIds = [
      ...new Set([...(model ? [model.id] : []), ...draft.compatibleModelIds]),
    ];
    setEditor({ item, action, draft });
  }
  async function act(
    item: SalvageItem,
    action: SalvageStatus,
    draft?: PartDraft,
  ) {
    if (!navigator.onLine)
      throw new Error("An online database confirmation is required.");
    setBusy(true);
    try {
      const { error: failure } = await client.rpc("salvage_action", {
        p_id: item.id,
        p_action: action,
        p_draft: draft ?? {},
      });
      if (failure) throw new Error(failure.message);
      toast.success(salvageLabels[action]);
      await Promise.all([
        reload(),
        refreshInventory(),
        refreshWorkspace(),
      ]).catch(() =>
        toast.warning("Saved. Refresh the page to load the latest history."),
      );
    } finally {
      setBusy(false);
    }
  }
  const canIntake = isElevatedRole(effectiveRole);
  const canPull =
    permissions.canRecordGreenMachineEvents &&
    !machine?.archivedAt &&
    !machine?.deletedAt &&
    machine?.status !== "archived";
  const filtered = items.filter((item) => {
    const age = item.resolved_at
      ? (loadedAt - Date.parse(item.resolved_at)) / 86400000
      : 0;
    const names = (item.draft.compatibleModelIds ?? []).map(
      (id) => models.find((m) => m.id === id)?.name ?? "",
    );
    return (
      (machineId || age >= Number(minAge)) &&
      [
        item.component_name,
        item.category,
        item.actor_label,
        item.machine_snapshot.modelName,
        item.machine_snapshot.serialNumber,
        item.draft.isNpn ? "NPN" : item.draft.partNumber,
        ...names,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  if (!machine && !canIntake)
    return <p>Only Admin/Manager can process Pending Inventory.</p>;
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle>
          {machine ? "Salvage checklist" : "Pending Inventory — Service Bin"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-400">
          {machine
            ? "Resolve each tracked component. Saving to the shared Service Bin resolves it for this machine. All required components resolved will automatically archive the machine as Ready for Disposal."
            : "One shared physical bin. Complete intake using the information recorded by the technician."}
        </p>
        {machine?.readyForDisposalAt && (
          <p className="text-emerald-300">
            Ready for Disposal since{" "}
            {new Date(machine.readyForDisposalAt).toLocaleString()}
          </p>
        )}
        {machine && !sourceModelFor(machine, models) && (
          <p role="status" className="text-sm text-amber-300">
            Source model “{machine.modelName}” cannot be matched safely. Pull for Use remains available.
            Use Save / Inventory Later to record the removed part with its PN or NPN and original machine details.
            An Admin/Manager must confirm the source model in <Link href="/pending-inventory" className="underline">Pending Inventory</Link> before intake.
          </p>
        )}
        {!isSupabaseMode && <p>Salvage actions require online inventory.</p>}
        {error && (
          <p role="alert" className="text-amber-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Input
            aria-label="Filter salvage items"
            className="min-w-40 flex-1"
            placeholder="Search part/NPN, technician, component, model or serial"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!machine && (
            <label className="text-sm">
              Minimum age (days)
              <Input
                aria-label="Minimum age in days"
                className="w-28"
                type="number"
                min="0"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
            </label>
          )}
          <Button variant="outline" disabled={busy} onClick={() => reload()}>
            Refresh
          </Button>
        </div>
        {!error && isSupabaseMode && filtered.length === 0 && (
          <p className="text-slate-400">No matching items.</p>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            className="space-y-3 rounded-xl border border-white/10 p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">
                {item.component_name}
                {item.required ? "" : " (optional)"}
              </p>
              <span
                className={
                  item.status === "on_machine"
                    ? "text-amber-300"
                    : "text-emerald-300"
                }
              >
                {salvageLabels[item.status]}
              </span>
            </div>
            {item.resolved_at && (
              <p className="text-xs text-slate-400">
                {item.actor_label} ·{" "}
                {new Date(item.resolved_at).toLocaleString()} ·{" "}
                {Math.max(
                  0,
                  Math.floor(
                    (loadedAt - Date.parse(item.resolved_at)) / 86400000,
                  ),
                )}{" "}
                days old
              </p>
            )}
            {item.status !== "on_machine" && (
              <p className="text-sm">
                {item.draft.isNpn ? "NPN" : item.draft.partNumber} ·{" "}
                {item.machine_snapshot.modelName} / Serial{" "}
                {item.machine_snapshot.serialNumber ?? "unknown"}
              </p>
            )}
            {item.draft.compatibleModelIds && (
              <p className="text-xs text-slate-400">
                Compatible:{" "}
                {item.draft.compatibleModelIds
                  .map((id) => models.find((m) => m.id === id)?.name ?? id)
                  .join(", ")}
              </p>
            )}
            {item.part_id && (
              <Link
                className="text-emerald-300 underline"
                href={`/inventory/${item.part_id}`}
              >
                View inventory part
              </Link>
            )}
            {item.status === "on_machine" && canPull && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    act(item, "pulled_for_use").catch((e) =>
                      toast.error(e.message),
                    )
                  }
                >
                  Pull for Use
                </Button>
                {permissions.canManageParts && (
                  <Button
                    disabled={busy}
                    onClick={() => openEditor(item, "inventoried")}
                  >
                    Put in Inventory
                  </Button>
                )}
                <Button
                  disabled={busy}
                  onClick={() => openEditor(item, "pending_inventory")}
                >
                  Save / Inventory Later
                </Button>
                {(["scrapped", "missing", "not_salvageable"] as const).map(
                  (action) => (
                    <Button
                      key={action}
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act(item, action).catch((e) => toast.error(e.message))
                      }
                    >
                      {salvageLabels[action]}
                    </Button>
                  ),
                )}
              </div>
            )}
            {item.status === "pending_inventory" && canIntake && (
              item.draft.modelResolutionRequired ? (
                <div className="space-y-2">
                  <p className="text-sm text-amber-300">Source model needs management review. Original model: {item.machine_snapshot.modelName}. The removal and PN/NPN are saved; this part does not block machine disposal.</p>
                  <select aria-label={`Source model for ${item.component_name}`} className="w-full rounded border bg-slate-900 p-2" value={modelChoices[item.id] ?? ""} onChange={(event) => setModelChoices((current) => ({ ...current, [item.id]: event.target.value }))}>
                    <option value="">Select the verified source model</option>
                    {models.filter((model) => model.status === "active").map((model) => <option key={model.id} value={model.id}>{model.manufacturer} {model.name}</option>)}
                  </select>
                  <Button disabled={busy || !modelChoices[item.id]} onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await client.rpc("resolve_salvage_model", { p_id: item.id, p_model_id: modelChoices[item.id] });
                      if (result.error) throw new Error(result.error.message);
                      await reload();
                      toast.success("Source model confirmed. Complete inventory intake when ready.");
                    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Model was not saved."); }
                    finally { setBusy(false); }
                  }}>Confirm source model</Button>
                </div>
              ) : (
              <Button
                disabled={busy}
                onClick={() => openEditor(item, "inventoried")}
              >
                Complete inventory intake
              </Button>
              )
            )}
          </div>
        ))}
        {editor && (
          <PartEditorSheet
            key={`${editor.item.id}:${editor.action}`}
            open
            onOpenChange={(open) => {
              if (!open) setEditor(null);
            }}
            initialDraft={editor.draft}
            requiredModelIds={[
              sourceModelFor(editor.item.status === "pending_inventory" ? editor.item.machine_snapshot : machine ?? editor.item.machine_snapshot, models)
                ?.id,
            ].filter((id): id is string => Boolean(id))}
            sourceLabel={`${editor.item.component_name} · ${(machine ?? editor.item.machine_snapshot).modelName} / Serial ${(machine ?? editor.item.machine_snapshot).serialNumber ?? "unknown"}${editor.action === "pending_inventory" ? " · Shared Service Bin" : ""}`}
            saveLabel={
              editor.action === "pending_inventory"
                ? "Save to Service Bin"
                : "Add part"
            }
            onSave={(draft) => act(editor.item, editor.action, draft)}
          />
        )}
      </CardContent>
    </Card>
  );
}
