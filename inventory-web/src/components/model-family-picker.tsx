"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DeviceModel } from "@/lib/inventory-types";
import {
  getModelDisplayName,
  getModelSearchReason,
  groupModelsForSearch,
} from "@/lib/model-search";
import { CheckSquare2, Search, X } from "lucide-react";

type ModelFamilyPickerProps = {
  models: DeviceModel[];
  selectedModelIds: string[];
  onSelectionChange: (modelIds: string[]) => void;
  disabled?: boolean;
  className?: string;
  scrollClassName?: string;
  compact?: boolean;
};

export function ModelFamilyPicker({
  models,
  selectedModelIds,
  onSelectionChange,
  disabled = false,
  className,
  scrollClassName,
  compact = false,
}: ModelFamilyPickerProps) {
  const [search, setSearch] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");

  const groupedModels = useMemo(
    () =>
      groupModelsForSearch(models, search, {
        manufacturer: manufacturerFilter === "all" ? undefined : manufacturerFilter,
      }),
    [manufacturerFilter, models, search],
  );

  const manufacturerOptions = useMemo(
    () =>
      [...new Set(models.map((model) => model.manufacturer))]
        .sort((left, right) => left.localeCompare(right)),
    [models],
  );

  const selectedModels = useMemo(
    () =>
      selectedModelIds
        .map((modelId) => models.find((model) => model.id === modelId))
        .filter((model): model is DeviceModel => Boolean(model)),
    [models, selectedModelIds],
  );

  const updateSelection = (nextIds: string[]) => {
    onSelectionChange(Array.from(new Set(nextIds)));
  };

  const toggleModel = (modelId: string) => {
    updateSelection(
      selectedModelIds.includes(modelId)
        ? selectedModelIds.filter((item) => item !== modelId)
        : [...selectedModelIds, modelId],
    );
  };

  const toggleFamily = (familyIds: string[], checked: boolean) => {
    if (checked) {
      updateSelection([...selectedModelIds, ...familyIds]);
      return;
    }

    updateSelection(selectedModelIds.filter((item) => !familyIds.includes(item)));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-200">
            {selectedModelIds.length} selected
          </Badge>
          {selectedModels.length > 0 && (
            <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
              {selectedModels[0].manufacturer}
              {selectedModels.length > 1 ? ` +${selectedModels.length - 1}` : ""}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
          onClick={() => updateSelection([])}
          disabled={disabled || selectedModelIds.length === 0}
        >
          <X className="mr-2 h-4 w-4" />
          Clear selected
        </Button>
      </div>

      <div className={compact ? "grid gap-3 md:grid-cols-[1fr_220px]" : "grid gap-3 lg:grid-cols-[1fr_240px]"}>
        <div className="space-y-2">
          <Label className="text-slate-200">Search models</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search manufacturer, model, series, or notes"
              className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">Manufacturer</Label>
          <Select
            value={manufacturerFilter}
            onValueChange={(value) => setManufacturerFilter(value ?? "all")}
            disabled={disabled}
          >
            <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
              <SelectValue placeholder="All manufacturers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All manufacturers</SelectItem>
              {manufacturerOptions.map((manufacturer) => (
                <SelectItem key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea
        className={cn(
          compact ? "h-[20rem]" : "h-[28rem]",
          "rounded-3xl border border-white/10 bg-slate-950/50 p-3",
          scrollClassName,
        )}
      >
        <div className="space-y-3">
          {groupedModels.map((group) => {
            const familyIds = group.models.map((model) => model.id);
            const selectedCount = familyIds.filter((modelId) => selectedModelIds.includes(modelId)).length;
            const isFullySelected = selectedCount === familyIds.length && familyIds.length > 0;
            const isPartiallySelected = selectedCount > 0 && !isFullySelected;

            return (
              <div
                key={group.familyKey}
                className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        Series / family
                      </Badge>
                      <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                        {group.label}
                      </Badge>
                      <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                        {selectedCount}/{familyIds.length}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {group.manufacturer} family
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {getModelSearchReason(group)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      onClick={() => toggleFamily(familyIds, !isFullySelected)}
                      disabled={disabled}
                    >
                      <CheckSquare2 className="mr-2 h-4 w-4" />
                      {isFullySelected ? "Clear family" : "Select family"}
                    </Button>
                    {isPartiallySelected && (
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                        Partial
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {group.models.map((model) => {
                    const checked = selectedModelIds.includes(model.id);

                    return (
                      <label
                        key={model.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors",
                          checked
                            ? "border-emerald-400/30 bg-emerald-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                          model.status === "inactive" && "opacity-80",
                          disabled && "pointer-events-none opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleModel(model.id)}
                          disabled={disabled}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {getModelDisplayName(model)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {model.series || "No series listed"} · {model.status}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "border",
                            model.status === "inactive"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
                          )}
                        >
                          {model.status}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {groupedModels.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              No models matched the current search.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
