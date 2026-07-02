"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createEmptyState, createSeedState, inventoryStorageKey } from "@/lib/inventory-seed";
import { inventoryReducer, type PartImportRow } from "@/lib/inventory-reducer";
import type {
  Bin,
  BinDraft,
  DeviceModel,
  InventorySettings,
  InventoryState,
  ModelDraft,
  Part,
  PartDraft,
} from "@/lib/inventory-types";
import {
  getBinById,
  getCompatibleModels,
  getDashboardSummary,
  getDisplayPartNumber,
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

type InventoryDataSource = "demo" | "supabase";

type InventoryContextValue = InventoryState & {
  hydrated: boolean;
  dataSource: InventoryDataSource;
  isSupabaseMode: boolean;
  canResetDemoData: boolean;
  summary: ReturnType<typeof getDashboardSummary>;
  getPartById: (partId: string) => Part | undefined;
  getBinById: (binId: string) => Bin | null;
  getModelById: (modelId: string) => DeviceModel | undefined;
  getPartLocationLabel: (part: Part) => string;
  getDisplayPartNumber: (part: Part) => string;
  getCompatibleModels: (part: Part) => DeviceModel[];
  getPartStockStatus: (part: Part) => ReturnType<typeof getPartStockStatus>;
  requiresAttention: (part: Part) => boolean;
  addPart: (draft: PartDraft) => void;
  deletePart: (partId: string) => void;
  adjustPart: (partId: string, delta: number) => void;
  recordLabelPrint: (
    partIds: string[],
    options: {
      labelMode: string;
      copies: number;
      includeZero: boolean;
      copiesByPart?: Record<string, number>;
      layout?: string;
      totalCopies: number;
    },
  ) => void;
  saveBin: (draft: BinDraft) => void;
  deleteBin: (binId: string) => void;
  setBinStatus: (binId: string, status: "active" | "inactive") => void;
  saveModel: (draft: ModelDraft) => void;
  deleteModel: (modelId: string) => void;
  setModelStatus: (modelId: string, status: "active" | "inactive") => void;
  importParts: (rows: PartImportRow[]) => void;
  updateSettings: (settings: Partial<InventorySettings>) => void;
  resetDemoData: () => void;
  refreshInventory: () => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  );
}

function isDemoDataExplicitlyEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";
}

function safeParseState(raw: string | null): InventoryState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as InventoryState;
    if (
      parsed &&
      Array.isArray(parsed.parts) &&
      Array.isArray(parsed.bins) &&
      Array.isArray(parsed.models) &&
      Array.isArray(parsed.activity) &&
      parsed.settings
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeText(value: string) {
  return value.trim();
}

async function readSnapshotFromServer() {
  const response = await fetch("/api/inventory/snapshot", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "Failed to load inventory snapshot.");
  }

  const payload = (await response.json()) as { data?: InventoryState };
  if (!payload.data) {
    throw new Error("Inventory snapshot response did not include data.");
  }

  return payload.data;
}

export function InventoryProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseConfigured = isSupabaseConfigured();
  const demoModeEnabled = isDemoDataExplicitlyEnabled();
  const isSupabaseMode = supabaseConfigured && !demoModeEnabled;
  const dataSource: InventoryDataSource = isSupabaseMode ? "supabase" : "demo";
  const [state, dispatch] = useReducer(
    inventoryReducer,
    isSupabaseMode ? createEmptyState("supabase") : createSeedState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [browserSupabase] = useState(() =>
    isSupabaseMode ? createBrowserSupabaseClient() : null,
  );

  const refreshInventory = useCallback(async () => {
    if (!isSupabaseMode) return;

    try {
      const snapshot = await readSnapshotFromServer();
      dispatch({ type: "hydrate", state: snapshot });
    } catch (error) {
      console.warn(
        error instanceof Error ? error.message : "Failed to refresh Supabase inventory state.",
      );
      dispatch({ type: "hydrate", state: createEmptyState("supabase") });
    }
  }, [isSupabaseMode]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!isSupabaseMode) {
        const stored = safeParseState(window.localStorage.getItem(inventoryStorageKey));
        if (stored && active) {
          dispatch({ type: "hydrate", state: stored });
        }
        if (active) setHydrated(true);
        return;
      }

      try {
        const snapshot = await readSnapshotFromServer();
        if (active) {
          dispatch({ type: "hydrate", state: snapshot });
        }
      } catch (error) {
        console.warn(
          error instanceof Error ? error.message : "Failed to bootstrap Supabase inventory state.",
        );
        if (active) {
          dispatch({ type: "hydrate", state: createEmptyState("supabase") });
        }
      } finally {
        if (active) setHydrated(true);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [isSupabaseMode]);

  useEffect(() => {
    if (!hydrated || isSupabaseMode) return;
    window.localStorage.setItem(inventoryStorageKey, JSON.stringify(state));
  }, [hydrated, isSupabaseMode, state]);

  const syncRemote = useCallback(
    (task: () => Promise<void>) => {
      if (!browserSupabase) return;

      void (async () => {
        try {
          await task();
        } catch (error) {
          console.error(
            error instanceof Error ? error.message : "Failed to sync inventory change to Supabase.",
          );
        } finally {
          await refreshInventory();
        }
      })();
    },
    [browserSupabase, refreshInventory],
  );

  const value = useMemo<InventoryContextValue>(() => {
    const summary = getDashboardSummary(state);

    return {
      ...state,
      hydrated,
      dataSource,
      isSupabaseMode,
      canResetDemoData: dataSource === "demo",
      summary,
      getPartById: (partId: string) => state.parts.find((part) => part.id === partId),
      getBinById: (binId: string) => getBinById(state.bins, binId),
      getModelById: (modelId: string) => state.models.find((model) => model.id === modelId),
      getPartLocationLabel: (part: Part) => getPartLocationLabel(part, state.bins),
      getDisplayPartNumber: (part: Part) => getDisplayPartNumber(part, state.models),
      getCompatibleModels: (part: Part) => getCompatibleModels(part, state.models),
      getPartStockStatus: (part: Part) => getPartStockStatus(part),
      requiresAttention: (part: Part) => requiresAttention(part),
      addPart: (draft: PartDraft) => {
        const isNpn = Boolean(draft.isNpn);
        const partDraft: PartDraft = {
          ...draft,
          id: draft.id ?? crypto.randomUUID(),
          isNpn,
          partNumber: isNpn ? "" : normalizeText(draft.partNumber).toUpperCase(),
          partName: normalizeText(draft.partName),
          manufacturer: normalizeText(draft.manufacturer),
          notes: normalizeText(draft.notes),
        };

        dispatch({ type: "upsertPart", part: partDraft });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error: partError } = await browserSupabase.from("parts").upsert(
            [
              {
                id: partDraft.id,
                part_number: partDraft.isNpn ? null : partDraft.partNumber || null,
                is_npn: partDraft.isNpn,
                part_name: partDraft.partName,
                manufacturer: partDraft.manufacturer,
                category: partDraft.category,
                location_id: partDraft.binId,
                quantity_on_hand: Math.max(0, Number(partDraft.quantityOnHand) || 0),
                reorder_point: Math.max(0, Number(partDraft.reorderPoint) || 0),
                reorder_target: Math.max(0, Number(partDraft.reorderTarget) || 0),
                universal: partDraft.universal,
                notes: partDraft.notes,
              },
            ],
            { onConflict: "id" },
          );

          if (partError) throw partError;

          const { error: deleteLinksError } = await browserSupabase
            .from("part_model_links")
            .delete()
            .eq("part_id", partDraft.id);

          if (deleteLinksError) throw deleteLinksError;

          if (partDraft.compatibleModelIds.length > 0) {
            const { error: linkError } = await browserSupabase.from("part_model_links").insert(
              partDraft.compatibleModelIds.map((modelId) => ({
                part_id: partDraft.id!,
                model_id: modelId,
              })),
            );

            if (linkError) throw linkError;
          }
        });
      },
      deletePart: (partId: string) => {
        dispatch({ type: "deletePart", partId });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("parts").delete().eq("id", partId);
          if (error) throw error;
        });
      },
      adjustPart: (partId: string, delta: number) => {
        const part = state.parts.find((item) => item.id === partId);
        if (!part) return;

        dispatch({ type: "adjustPart", partId, delta });
        if (!browserSupabase) return;

        const nextQuantity = Math.max(0, part.quantityOnHand + delta);
        syncRemote(async () => {
          const { error: updateError } = await browserSupabase
            .from("parts")
            .update({
              quantity_on_hand: nextQuantity,
            })
            .eq("id", partId);

          if (updateError) throw updateError;
        });
      },
      recordLabelPrint: (
        partIds: string[],
        options: {
          labelMode: string;
          copies: number;
          includeZero: boolean;
          copiesByPart?: Record<string, number>;
          layout?: string;
          totalCopies: number;
        },
      ) => {
        const printedParts = partIds
          .map((partId) => state.parts.find((part) => part.id === partId))
          .filter((part): part is Part => Boolean(part));

        if (printedParts.length === 0) {
          return;
        }

        dispatch({
          type: "logLabelPrint",
          partIds: printedParts.map((part) => part.id),
          labelMode: options.labelMode,
          copies: options.copies,
          includeZero: options.includeZero,
          copiesByPart: options.copiesByPart,
          layout: options.layout,
          totalCopies: options.totalCopies,
        });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("inventory_transactions").insert(
            printedParts.map((part) => ({
              part_id: part.id,
              transaction_type: "adjustment",
              delta: 0,
              audit_type: "label_printed",
              previous_quantity: part.quantityOnHand,
              next_quantity: part.quantityOnHand,
              previous_location_id: part.binId,
              next_location_id: part.binId,
              previous_part_number: part.isNpn ? null : part.partNumber || null,
              next_part_number: part.isNpn ? null : part.partNumber || null,
              previous_is_npn: part.isNpn,
              next_is_npn: part.isNpn,
              item_part_name: part.partName,
              item_manufacturer: part.manufacturer,
              item_category: part.category,
              item_snapshot: {
                partId: part.id,
                labelMode: options.labelMode,
                labelCopies: options.copies,
                includeZero: options.includeZero,
                copiesByPart: options.copiesByPart ?? null,
                layout: options.layout ?? null,
                totalCopies: options.totalCopies,
                displayPartNumber: getDisplayPartNumber(part, state.models),
              },
              label_mode: options.labelMode,
              label_copies: options.copiesByPart?.[part.id] ?? options.copies,
              note: `Printed ${options.labelMode} labels${options.layout ? ` (${options.layout})` : ""}`,
              created_by: null,
              actor_label: null,
            })),
          );

          if (error) throw error;
        });
      },
      saveBin: (draft: BinDraft) => {
        const binDraft: BinDraft = {
          ...draft,
          id: draft.id ?? crypto.randomUUID(),
          code: normalizeText(draft.code).toUpperCase(),
          name: normalizeText(draft.name),
          description: normalizeText(draft.description),
          aisle: normalizeText(draft.aisle).toUpperCase(),
          notes: normalizeText(draft.notes),
        };

        dispatch({ type: "upsertBin", bin: binDraft });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("locations").upsert(
            [
              {
                id: binDraft.id,
                location_code: binDraft.code,
                name: binDraft.name,
                area: binDraft.aisle,
                shelf: Number(binDraft.row) || 1,
                bin: Number(binDraft.column) || 1,
                description: binDraft.description,
                status: binDraft.status,
                notes: binDraft.notes || null,
              },
            ],
            { onConflict: "id" },
          );

          if (error) throw error;
        });
      },
      deleteBin: (binId: string) => {
        dispatch({ type: "deleteBin", binId });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("locations").delete().eq("id", binId);
          if (error) throw error;
        });
      },
      setBinStatus: (binId: string, status: "active" | "inactive") => {
        dispatch({ type: "setBinStatus", binId, status });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase
            .from("locations")
            .update({ status })
            .eq("id", binId);

          if (error) throw error;
        });
      },
      saveModel: (draft: ModelDraft) => {
        const modelDraft: ModelDraft = {
          ...draft,
          id: draft.id ?? crypto.randomUUID(),
          manufacturer: normalizeText(draft.manufacturer),
          name: normalizeText(draft.name),
          series: normalizeText(draft.series),
          notes: normalizeText(draft.notes),
        };

        dispatch({ type: "upsertModel", model: modelDraft });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("models").upsert(
            [
              {
                id: modelDraft.id,
                manufacturer: modelDraft.manufacturer,
                model_name: modelDraft.name,
                series: modelDraft.series,
                status: modelDraft.status,
                notes: modelDraft.notes || null,
              },
            ],
            { onConflict: "id" },
          );

          if (error) throw error;
        });
      },
      deleteModel: (modelId: string) => {
        dispatch({ type: "deleteModel", modelId });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase.from("models").delete().eq("id", modelId);
          if (error) throw error;
        });
      },
      setModelStatus: (modelId: string, status: "active" | "inactive") => {
        dispatch({ type: "setModelStatus", modelId, status });

        if (!browserSupabase) return;

        syncRemote(async () => {
          const { error } = await browserSupabase
            .from("models")
            .update({ status })
            .eq("id", modelId);

          if (error) throw error;
        });
      },
      importParts: (rows) => dispatch({ type: "importParts", rows }),
      updateSettings: (settings) =>
        dispatch({
          type: "updateSettings",
          settings,
        }),
      resetDemoData: () => {
        if (isSupabaseMode) {
          return;
        }

        dispatch({ type: "reset" });
      },
      refreshInventory,
    };
  }, [browserSupabase, dataSource, hydrated, isSupabaseMode, refreshInventory, state, syncRemote]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }

  return context;
}
