"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  PackageSearch,
  Save,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  categories,
  defaultCategory,
  manufacturers,
  type Part,
  type PartDraft,
} from "@/lib/inventory-types";
import {
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";
import { ModelFamilyPicker } from "@/components/model-family-picker";

type PartFormState = {
  partNumber: string;
  isNpn: boolean;
  partName: string;
  manufacturer: string;
  category: Part["category"];
  binId: string;
  quantityOnHand: string;
  reorderPoint: string;
  reorderTarget: string;
  notes: string;
  universal: boolean;
  compatibleModelIds: string[];
};

function formFromPart(part?: Part | null, defaultBinId?: string | null): PartFormState {
  if (!part) {
    return {
      partNumber: "",
      isNpn: false,
      partName: "",
      manufacturer: "Canon",
      category: defaultCategory,
      binId: defaultBinId ?? "",
      quantityOnHand: "0",
      reorderPoint: "5",
      reorderTarget: "12",
      notes: "",
      universal: false,
      compatibleModelIds: [],
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

export function PartEditorPage({
  mode,
  partId,
  defaultBinId,
}: Readonly<{
  mode: "create" | "edit";
  partId?: string;
  defaultBinId?: string | null;
}>) {
  const router = useRouter();
  const { permissions } = useAuth();
  const {
    addPart,
    bins,
    deletePart,
    getDisplayPartNumber,
    getCompatibleModels,
    getPartById,
    models,
  } = useInventory();

  const part = mode === "edit" && partId ? getPartById(partId) : undefined;
  const [form, setForm] = useState<PartFormState>(() => formFromPart(part, defaultBinId));
  const [binSearch, setBinSearch] = useState("");

  useEffect(() => {
    setForm(formFromPart(part, defaultBinId));
  }, [defaultBinId, part]);

  const availableBins = useMemo(() => {
    const search = binSearch.trim().toLowerCase();
    return [...bins]
      .sort((left, right) => left.code.localeCompare(right.code))
      .filter((bin) => {
        if (!search) return true;
        return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.row} ${bin.column} ${bin.manufacturer ?? ""} ${bin.status}`
          .toLowerCase()
          .includes(search);
      });
  }, [binSearch, bins]);

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
  } satisfies Part;

  const compatibleModels = getCompatibleModels(previewPart);
  const attentionPreview = requiresAttention(previewPart);
  const locationLabel = getPartLocationLabel(previewPart, bins);
  const displayPartNumber = getDisplayPartNumber(previewPart);
  const canSave = permissions.canManageParts;

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
    } satisfies PartDraft);

    toast.success(part ? "Part updated" : "Part added");
    router.push(part ? `/inventory/${part.id}` : "/inventory");
  };

  const deleteCurrentPart = () => {
    if (!part) return;
    if (!window.confirm(`Delete ${getDisplayPartNumber(part)}? This removes the part from the inventory.`)) {
      return;
    }

    deletePart(part.id);
    toast.success("Part removed");
    router.push("/inventory");
  };

  if (mode === "edit" && !part) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Part not found</h1>
                <p className="text-sm text-slate-400">
                  This part is not in the current inventory.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/inventory"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to parts
              </Link>
              <Link
                href="/inventory/new"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Add a part
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const editingPart = part as Part;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 overflow-x-hidden px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 px-5 py-5 shadow-2xl shadow-black/10 backdrop-blur-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
              {mode === "create" ? "New part" : "Edit part"}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {mode === "create"
                  ? "Add a part"
                  : `${getDisplayPartNumber(editingPart)} · ${editingPart.partName}`}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Keep the part number, category, location, and compatibility in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={mode === "edit" ? `/inventory/${editingPart.id}` : "/inventory"}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={savePart}
              disabled={!canSave}
            >
              <Save className="mr-2 h-4 w-4" />
              Save part
            </Button>
            {mode === "edit" && permissions.canManageParts && (
              <Button
                variant="destructive"
                onClick={deleteCurrentPart}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {!canSave && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can view this form, but editing is restricted. Ask an admin or manager for access.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">1. Part identity</CardTitle>
              <CardDescription className="text-slate-400">
                Start with a part number, or mark the item as NPN when it has no printed number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Part number</Label>
                  <Input
                    value={form.partNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partNumber: event.target.value }))
                    }
                    placeholder={form.isNpn ? "Optional for NPN" : "FM1-D581"}
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
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
                        Use this when the item has no printed part number. Labels will use the first
                        compatible model, or Unknown Model if none is linked.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Part name</Label>
                  <Input
                    value={form.partName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partName: event.target.value }))
                    }
                    placeholder="Fixing Assembly"
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Manufacturer</Label>
                <Select
                  value={form.manufacturer}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, manufacturer: value ?? "" }))
                  }
                >
                    <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
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
                        category: value as Part["category"],
                      }))
                    }
                  >
                    <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
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
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      universal: !current.universal,
                      compatibleModelIds: !current.universal ? [] : current.compatibleModelIds,
                    }))
                  }
                  className={cn(
                    "flex min-h-12 items-center justify-between rounded-2xl border px-4 text-sm transition-colors",
                    form.universal
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-slate-950/70 text-slate-200 hover:bg-white/10",
                  )}
                >
                  <span>{form.universal ? "Universal part" : "Mark as universal"}</span>
                  <Sparkles className="h-4 w-4" />
                </button>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Stock status</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {getPartStockStatus(previewPart) === "healthy"
                      ? "Healthy"
                      : getPartStockStatus(previewPart) === "critical"
                        ? "Critical"
                        : "Low stock"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Attention</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {attentionPreview ? "Needs review" : "Looks complete"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">2. Stock snapshot</CardTitle>
              <CardDescription className="text-slate-400">
                Set the current count for this part.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Quantity on hand</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.quantityOnHand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quantityOnHand: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Health</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {getPartStockStatus(previewPart) === "healthy"
                      ? "Healthy"
                      : getPartStockStatus(previewPart) === "critical"
                        ? "Critical"
                        : "Low stock"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {attentionPreview ? "Needs location or compatibility" : "Ready to save"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">3. Location/bin</CardTitle>
              <CardDescription className="text-slate-400">
                Pick a shelf location. Inactive locations stay visible but are clearly marked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <div className="space-y-2">
                  <Label className="text-slate-200">Search locations</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={binSearch}
                      onChange={(event) => setBinSearch(event.target.value)}
                      placeholder="Search by code, area, shelf, bin, or description"
                      className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Selected location</Label>
                  <div className="flex h-12 items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white">
                    <span className="truncate">{locationLabel}</span>
                    {form.binId && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white"
                        onClick={() => setForm((current) => ({ ...current, binId: "" }))}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="h-72 rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                <div className="space-y-2">
                  {availableBins.map((bin) => {
                    const active = form.binId === bin.id;
                    return (
                      <button
                        key={bin.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            binId: active ? "" : bin.id,
                          }))
                        }
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-emerald-400/30 bg-emerald-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                          bin.status === "inactive" && "opacity-80",
                        )}
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {bin.code} · {bin.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">{bin.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            {bin.aisle}-{bin.row}-{bin.column}
                          </Badge>
                          <Badge
                            className={cn(
                              "border",
                              bin.status === "inactive"
                                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
                            )}
                          >
                            {bin.status}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">4. Compatible models</CardTitle>
              <CardDescription className="text-slate-400">
                Search by manufacturer or series, then select whole families or individual models.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.compatibleModelIds.length > 0 && !form.universal && (
                <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Selected models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {compatibleModels.map((model) => (
                      <Badge key={model.id} className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                        {model.manufacturer} {model.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <ModelFamilyPicker
                models={models}
                selectedModelIds={form.compatibleModelIds}
                onSelectionChange={(nextIds) =>
                  setForm((current) => ({
                    ...current,
                    compatibleModelIds: nextIds,
                    universal: false,
                  }))
                }
                disabled={form.universal}
                compact
              />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">5. Notes and status</CardTitle>
              <CardDescription className="text-slate-400">
                Keep notes short and useful for the team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Shelf notes, handling notes, or anything a tech needs to know."
                  className="min-h-36 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <Separator className="bg-white/10" />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Location</p>
                  <p className="mt-2 text-sm font-semibold text-white">{locationLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Compatibility</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {form.universal ? "Universal" : `${compatibleModels.length} linked models`}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Attention</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {attentionPreview ? "Review needed" : "Ready"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:h-fit">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
            <CardTitle className="text-white">Part summary</CardTitle>
            <CardDescription className="text-slate-400">
                Quick preview of the saved record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Part</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {displayPartNumber || "New part"}
                </p>
                <p className="mt-1 text-sm text-slate-400">{form.partName || "Part name"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Quantity</span>
                  <span>{form.quantityOnHand || 0}</span>
                </Badge>
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Reorder</span>
                  <span>{form.reorderPoint || 0}</span>
                </Badge>
                <Badge
                  className={cn(
                    "justify-between border px-3 py-2",
                    getPartStockStatus(previewPart) === "critical"
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                      : getPartStockStatus(previewPart) === "low"
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
                  )}
                >
                  <span>Status</span>
                  <span>{getPartStockStatus(previewPart)}</span>
                </Badge>
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Location</span>
                  <span className="truncate pl-2 text-right">{locationLabel}</span>
                </Badge>
              </div>
              {attentionPreview && (
                <div className="flex items-start gap-3 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    This record will still show as needing attention until it has a location and compatibility data.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={mode === "edit" ? `/inventory/${editingPart.id}` : "/inventory"}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
            <CardTitle className="text-white">Compatibility preview</CardTitle>
            <CardDescription className="text-slate-400">
                What this part will match after save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.universal ? (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  This part is marked universal and applies across the fleet.
                </div>
              ) : compatibleModels.length > 0 ? (
                compatibleModels.map((model) => (
                  <div
                    key={model.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {model.manufacturer} {model.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {model.series || "No series"} · {model.status}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                  No compatible models have been selected yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5 text-slate-400">
            {attentionPreview
              ? "Add a location or compatibility to finish this record."
              : "Everything is ready to save."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={mode === "edit" ? `/inventory/${editingPart.id}` : "/inventory"}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={savePart}
              disabled={!canSave}
            >
              <Save className="mr-2 h-4 w-4" />
              Save part
            </Button>
            {mode === "edit" && permissions.canManageParts && (
              <Button
                variant="destructive"
                onClick={deleteCurrentPart}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
