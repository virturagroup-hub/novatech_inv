"use client";

import { useMemo, useState } from "react";
import { Check, Search, SplitSquareHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Bin, DeviceModel, Part } from "@/lib/inventory-types";
import {
  getDisplayPartNumber,
  getPartLookupBlob,
  getPartLocationLabel,
  getPartStockStatus,
} from "@/lib/inventory-utils";

type MachinePartPickerProps = {
  parts: Part[];
  bins: Bin[];
  models: DeviceModel[];
  value: string | null;
  onChange: (part: Part | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function MachinePartPicker({
  parts,
  bins,
  models,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Search existing parts or switch to manual entry",
}: Readonly<MachinePartPickerProps>) {
  const [query, setQuery] = useState("");

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === value) ?? null,
    [parts, value],
  );

  const filteredParts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const matches = parts.filter((part) =>
      normalizedQuery ? getPartLookupBlob(part, bins, models).includes(normalizedQuery) : true,
    );

    return [...matches].sort((left, right) => {
      const leftNumber = getDisplayPartNumber(left, models);
      const rightNumber = getDisplayPartNumber(right, models);
      return leftNumber.localeCompare(rightNumber) || left.partName.localeCompare(right.partName);
    });
  }, [bins, models, parts, query]);

  const clearSelection = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-200">
            {selectedPart ? "Existing part selected" : "Manual entry ready"}
          </Badge>
          {selectedPart && (
            <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
              {getDisplayPartNumber(selectedPart, models)}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
          onClick={clearSelection}
          disabled={disabled && !selectedPart}
        >
          <SplitSquareHorizontal className="mr-2 h-4 w-4" />
          Manual entry
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
          disabled={disabled}
        />
      </div>

      <ScrollArea className="h-[18rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
        <div className="space-y-2">
          {filteredParts.map((part) => {
            const isSelected = part.id === value;
            const compatibleModels = part.compatibleModelIds.length;
            const stockStatus = getPartStockStatus(part);

            return (
              <button
                key={part.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(part)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {getDisplayPartNumber(part, models)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-400">
                    {part.partName} · {part.manufacturer} · {getPartLocationLabel(part, bins)}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Badge className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.16em] text-slate-200">
                      Qty {part.quantityOnHand}
                    </Badge>
                    <Badge
                      className={cn(
                        "border text-[11px] uppercase tracking-[0.16em]",
                        stockStatus === "critical"
                          ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                          : stockStatus === "low"
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                      )}
                    >
                      {stockStatus}
                    </Badge>
                    <Badge className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.16em] text-slate-200">
                      {compatibleModels} models
                    </Badge>
                  </span>
                </span>
                {isSelected && <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />}
              </button>
            );
          })}

          {filteredParts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              No parts matched the current search.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
