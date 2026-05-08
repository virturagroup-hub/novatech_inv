/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { createSeedState, inventoryStorageKey } from "@/lib/inventory-seed";
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
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

type InventoryContextValue = InventoryState & {
  hydrated: boolean;
  summary: ReturnType<typeof getDashboardSummary>;
  getPartById: (partId: string) => Part | undefined;
  getBinById: (binId: string) => Bin | null;
  getModelById: (modelId: string) => DeviceModel | undefined;
  getPartLocationLabel: (part: Part) => string;
  getCompatibleModels: (part: Part) => DeviceModel[];
  getPartStockStatus: (part: Part) => ReturnType<typeof getPartStockStatus>;
  requiresAttention: (part: Part) => boolean;
  addPart: (draft: PartDraft) => void;
  deletePart: (partId: string) => void;
  adjustPart: (partId: string, delta: number) => void;
  saveBin: (draft: BinDraft) => void;
  deleteBin: (binId: string) => void;
  setBinStatus: (binId: string, status: "active" | "inactive") => void;
  saveModel: (draft: ModelDraft) => void;
  deleteModel: (modelId: string) => void;
  setModelStatus: (modelId: string, status: "active" | "inactive") => void;
  importParts: (rows: PartImportRow[]) => void;
  updateSettings: (settings: Partial<InventorySettings>) => void;
  resetDemoData: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

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

export function InventoryProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [state, dispatch] = useReducer(inventoryReducer, createSeedState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = safeParseState(window.localStorage.getItem(inventoryStorageKey));
    if (stored) {
      dispatch({ type: "hydrate", state: stored });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(inventoryStorageKey, JSON.stringify(state));
  }, [state, hydrated]);

  const value = useMemo<InventoryContextValue>(() => {
    const summary = getDashboardSummary(state);

    return {
      ...state,
      hydrated,
      summary,
      getPartById: (partId: string) =>
        state.parts.find((part) => part.id === partId),
      getBinById: (binId: string) => getBinById(state.bins, binId),
      getModelById: (modelId: string) =>
        state.models.find((model) => model.id === modelId),
      getPartLocationLabel: (part: Part) => getPartLocationLabel(part, state.bins),
      getCompatibleModels: (part: Part) => getCompatibleModels(part, state.models),
      getPartStockStatus: (part: Part) => getPartStockStatus(part),
      requiresAttention: (part: Part) => requiresAttention(part),
      addPart: (draft: PartDraft) => dispatch({ type: "upsertPart", part: draft }),
      deletePart: (partId: string) => dispatch({ type: "deletePart", partId }),
      adjustPart: (partId: string, delta: number) =>
        dispatch({ type: "adjustPart", partId, delta }),
      saveBin: (draft: BinDraft) => dispatch({ type: "upsertBin", bin: draft }),
      deleteBin: (binId: string) => dispatch({ type: "deleteBin", binId }),
      setBinStatus: (binId: string, status: "active" | "inactive") =>
        dispatch({ type: "setBinStatus", binId, status }),
      saveModel: (draft: ModelDraft) =>
        dispatch({
          type: "upsertModel",
          model: {
            id: draft.id,
            manufacturer: draft.manufacturer,
            name: draft.name,
            series: draft.series,
            status: draft.status,
            notes: draft.notes,
          },
        }),
      deleteModel: (modelId: string) => dispatch({ type: "deleteModel", modelId }),
      setModelStatus: (modelId: string, status: "active" | "inactive") =>
        dispatch({ type: "setModelStatus", modelId, status }),
      importParts: (rows) => dispatch({ type: "importParts", rows }),
      updateSettings: (settings) => dispatch({ type: "updateSettings", settings }),
      resetDemoData: () => dispatch({ type: "reset" }),
    };
  }, [hydrated, state]);

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
