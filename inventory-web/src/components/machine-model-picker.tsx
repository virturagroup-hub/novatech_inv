"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DeviceModel } from "@/lib/inventory-types";
import { getModelDisplayName, getModelSearchBlob, getModelSeriesLabel } from "@/lib/model-search";
import { cn } from "@/lib/utils";

type MachineModelPickerProps = {
  models: DeviceModel[];
  value: string | null;
  onChange: (model: DeviceModel | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function statusTone(status: DeviceModel["status"]) {
  return status === "active"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-amber-400/20 bg-amber-400/10 text-amber-100";
}

export function MachineModelPicker({
  models,
  value,
  onChange,
  disabled = false,
  placeholder = "Search or choose a model",
  className,
}: Readonly<MachineModelPickerProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === value) ?? null,
    [models, value],
  );

  const filteredModels = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const matches = models.filter((model) =>
      normalizedQuery ? getModelSearchBlob(model).includes(normalizedQuery) : true,
    );

    return [...matches].sort((left, right) =>
      getModelDisplayName(left).localeCompare(getModelDisplayName(right)),
    );
  }, [models, query]);

  const chooseManualEntry = () => {
    onChange(null);
    setOpen(false);
    setQuery("");
  };

  const chooseModel = (model: DeviceModel) => {
    onChange(model);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-left text-white outline-none transition-colors hover:bg-slate-950/80 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {selectedModel ? getModelDisplayName(selectedModel) : placeholder}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {selectedModel ? getModelSeriesLabel(selectedModel) : "Manual entry stays available"}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        initialFocus={(openType) => (openType === "keyboard" ? searchInputRef.current : false)}
        className="w-[min(92vw,34rem)] gap-3 border border-white/10 bg-slate-950/95 p-3 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Pick a model</p>
            <p className="text-xs leading-5 text-slate-400">
              Search the fleet list, or switch to manual entry for a custom machine record.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={chooseManualEntry}
          >
            Manual entry
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search manufacturer, model, series, or notes"
            className="h-12 border-white/10 bg-slate-900/80 pl-9 text-white placeholder:text-slate-500"
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {filteredModels.length} model{filteredModels.length === 1 ? "" : "s"} available
          </span>
          {selectedModel && (
            <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
              Currently selected
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[20rem] rounded-2xl border border-white/10 bg-slate-950/50 p-2">
          <div className="space-y-2">
            {filteredModels.map((model) => {
              const isSelected = model.id === value;

              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => chooseModel(model)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/60 hover:bg-white/5",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {getModelDisplayName(model)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-400">
                      {getModelSeriesLabel(model)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2">
                    <Badge className={cn("border", statusTone(model.status))}>
                      {model.status}
                    </Badge>
                    {isSelected && <Check className="h-4 w-4 text-emerald-200" />}
                  </span>
                </button>
              );
            })}

            {filteredModels.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No models matched. Use manual entry instead.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
