"use client";

import { useMemo, useState } from "react";
import type { Part } from "@/lib/inventory-types";
import { categories, manufacturers } from "@/lib/inventory-types";
import { requiresAttention } from "@/lib/inventory-utils";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, PackagePlus, Search } from "lucide-react";
import { toast } from "sonner";

type PartEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part?: Part | null;
  defaultBinId?: string | null;
  defaultFocus?: "create" | "edit";
};

type PartFormState = {
  partNumber: string;
  isNpn: boolean;
  partName: string;
  manufacturer: string;
  category: (typeof categories)[number];
  binId: string;
  quantityOnHand: string;
  reorderPoint: string;
  reorderTarget: string;
  notes: string;
  universal: boolean;
  compatibleModelIds: string[];
};

const blankForm: PartFormState = {
  partNumber: "",
  isNpn: false,
  partName: "",
  manufacturer: "Canon",
  category: "Accessory",
  binId: "",
  quantityOnHand: "0",
  reorderPoint: "5",
  reorderTarget: "12",
  notes: "",
  universal: false,
  compatibleModelIds: [],
};

function formFromPart(part?: Part | null, defaultBinId?: string | null): PartFormState {
  if (!part) {
    return {
      ...blankForm,
      binId: defaultBinId ?? "",
    };
  }

  return {
    partNumber: part.isNpn ? "" : part.partNumber,
    isNpn: Boolean(part.isNpn),
    partName: part.partName,
    manufacturer: part.manufacturer,
    category: part.category,
    binId: part.binId ?? "",
    quantityOnHand: String(part.quantityOnHand),
    reorderPoint: String(part.reorderPoint),
    reorderTarget: String(part.reorderTarget),
    notes: part.notes,
    universal: part.universal,
    compatibleModelIds: part.compatibleModelIds,
  };
}

export function PartEditorSheet({
  open,
  onOpenChange,
  part,
  defaultBinId,
}: PartEditorSheetProps) {
  const { bins, models, addPart, getCompatibleModels } = useInventory();
  const [form, setForm] = useState<PartFormState>(() => formFromPart(part, defaultBinId));
  const [modelSearch, setModelSearch] = useState("");
  const [modelManufacturer, setModelManufacturer] = useState("");

  const availableModels = useMemo(() => {
    const search = modelSearch.trim().toLowerCase();
    return models.filter((model) => {
      if (modelManufacturer && model.manufacturer !== modelManufacturer) {
        return false;
      }
      if (!search) return true;
      return (
        model.name.toLowerCase().includes(search) ||
        model.manufacturer.toLowerCase().includes(search) ||
        model.series.toLowerCase().includes(search)
      );
    });
  }, [models, modelManufacturer, modelSearch]);

  const attentionPreview = requiresAttention({
    id: part?.id ?? "",
    partNumber: form.isNpn ? "" : form.partNumber,
    isNpn: form.isNpn,
    partName: form.partName,
    manufacturer: form.manufacturer,
    category: form.category,
    binId: form.binId || null,
    quantityOnHand: Number(form.quantityOnHand) || 0,
    reorderPoint: Number(form.reorderPoint) || 0,
    reorderTarget: Number(form.reorderTarget) || 0,
    compatibleModelIds: form.compatibleModelIds,
    universal: form.universal,
    notes: form.notes,
    receivedAt: part?.receivedAt ?? new Date().toISOString(),
    updatedAt: part?.updatedAt ?? new Date().toISOString(),
    lastCountedAt: part?.lastCountedAt ?? new Date().toISOString(),
  });

  const savePart = () => {
    if (!form.partName.trim() || (!form.isNpn && !form.partNumber.trim())) {
      toast.error(form.isNpn ? "Part name is required." : "Part number and part name are required.");
      return;
    }

    addPart({
      id: part?.id,
      partNumber: form.isNpn ? "" : form.partNumber.trim(),
      isNpn: form.isNpn,
      partName: form.partName.trim(),
      manufacturer: form.manufacturer.trim(),
      category: form.category,
      binId: form.binId || null,
      quantityOnHand: Math.max(0, Number(form.quantityOnHand) || 0),
      reorderPoint: Math.max(0, Number(form.reorderPoint) || 0),
      reorderTarget: Math.max(0, Number(form.reorderTarget) || 0),
      compatibleModelIds: form.compatibleModelIds,
      universal: form.universal,
      notes: form.notes.trim(),
    });
    onOpenChange(false);
  };

  const previewPart = {
    id: part?.id ?? "",
    partNumber: form.isNpn ? "" : form.partNumber,
    isNpn: form.isNpn,
    partName: form.partName,
    manufacturer: form.manufacturer,
    category: form.category,
    binId: form.binId || null,
    quantityOnHand: Number(form.quantityOnHand) || 0,
    reorderPoint: Number(form.reorderPoint) || 0,
    reorderTarget: Number(form.reorderTarget) || 0,
    compatibleModelIds: form.compatibleModelIds,
    universal: form.universal,
    notes: form.notes,
    receivedAt: part?.receivedAt ?? new Date().toISOString(),
    updatedAt: part?.updatedAt ?? new Date().toISOString(),
    lastCountedAt: part?.lastCountedAt ?? new Date().toISOString(),
  };

  const selectedCompatibleModels = getCompatibleModels(previewPart);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-white/10 bg-slate-950 text-slate-50 sm:max-w-3xl">
        <SheetHeader className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-white">
                {part ? "Edit part" : "Add part"}
              </SheetTitle>
              <SheetDescription className="text-slate-400">
                Keep part numbers, NPN status, locations, and model compatibility in sync.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber" className="text-slate-200">
                  Part number
                </Label>
                <Input
                  id="partNumber"
                  value={form.partNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, partNumber: event.target.value }))
                  }
                  placeholder={form.isNpn ? "Optional for NPN" : "FM1-D581"}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Checkbox
                    checked={form.isNpn}
                    onCheckedChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        isNpn: Boolean(next),
                      }))
                    }
                    className="mt-0.5 border-white/20 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-950"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">Mark as NPN</p>
                    <p className="text-xs leading-5 text-slate-400">
                      No Part Number items can be saved without a part number. Labels will use the
                      first compatible model, or Unknown Model if none is linked.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partName" className="text-slate-200">
                  Part name
                </Label>
                <Input
                  id="partName"
                  value={form.partName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, partName: event.target.value }))
                  }
                  placeholder="Fixing Assembly"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Manufacturer</Label>
                <Select
                  value={form.manufacturer}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      manufacturer: value ?? current.manufacturer,
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      category: (value ?? current.category) as PartFormState["category"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Storage bin</Label>
                <Select
                  value={form.binId || "unassigned"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      binId: value && value !== "unassigned" ? value : "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select bin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {bins.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.code} · {bin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Universal part</Label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      universal: !current.universal,
                    }))
                  }
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors",
                    form.universal
                      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span>{form.universal ? "Universal enabled" : "Mark as universal"}</span>
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-slate-200">
                  Quantity on hand
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  value={form.quantityOnHand}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantityOnHand: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderPoint" className="text-slate-200">
                  Reorder point
                </Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min={0}
                  value={form.reorderPoint}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reorderPoint: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderTarget" className="text-slate-200">
                  Reorder target
                </Label>
                <Input
                  id="reorderTarget"
                  type="number"
                  min={0}
                  value={form.reorderTarget}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reorderTarget: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Compatible printer/copier models
                  </p>
                  <p className="text-xs text-slate-400">
                    Search or filter models, then tick the ones this part fits.
                  </p>
                </div>
                {form.universal ? (
                  <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                    Universal
                  </Badge>
                ) : (
                  <Badge className="border-slate-500/30 bg-slate-900/60 text-slate-200">
                    {selectedCompatibleModels.length} selected
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="Search models"
                    className="border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
                  />
                </div>
                <Select
                  value={modelManufacturer || "all"}
                  onValueChange={(value) =>
                    setModelManufacturer(value && value !== "all" ? value : "")
                  }
                >
                  <SelectTrigger className="w-full border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Filter manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All manufacturers</SelectItem>
                    {manufacturers.filter((item) => item !== "Universal").map((manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4">
                <ScrollArea className="h-56 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="space-y-2">
                    {availableModels.map((model) => {
                      const checked = form.compatibleModelIds.includes(model.id);
                      return (
                        <label
                          key={model.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 transition-colors",
                            checked
                              ? "border-amber-400/30 bg-amber-400/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              setForm((current) => ({
                                ...current,
                                compatibleModelIds: next
                                  ? [...current.compatibleModelIds, model.id]
                                  : current.compatibleModelIds.filter(
                                      (modelId) => modelId !== model.id,
                                    ),
                              }));
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {model.manufacturer} {model.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {model.series} · {model.status}
                            </p>
                          </div>
                        </label>
                      );
                    })}

                    {availableModels.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                        No models match the current filter.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {!form.universal && form.compatibleModelIds.length === 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    This part will show as attention-needed until a compatible
                    model is selected or the part is marked universal.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-200">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Internal repair notes, shelf notes, special handling, or prep work."
                className="min-h-32 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-white/10 px-6 py-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-400">
              {attentionPreview
                ? "This part will be highlighted for review after save."
                : "Compatibility and location look complete."}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                onClick={savePart}
              >
                {part ? "Save changes" : "Add part"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
