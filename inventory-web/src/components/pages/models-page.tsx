"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Layers3, PackageSearch, Plus, Search, Sparkles, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DeviceModel, ModelDraft } from "@/lib/inventory-types";
import { countCompatiblePartsForModel, getModelStatusLabel } from "@/lib/inventory-utils";

function emptyModelDraft(): ModelDraft {
  return {
    manufacturer: "",
    name: "",
    series: "",
    status: "active",
    notes: "",
  };
}

function modelDraftFromModel(model?: DeviceModel | null): ModelDraft {
  if (!model) return emptyModelDraft();
  return {
    manufacturer: model.manufacturer,
    name: model.name,
    series: model.series,
    status: model.status,
    notes: model.notes ?? "",
  };
}

export function ModelsPage() {
  const { permissions } = useAuth();
  const {
    models,
    parts,
    saveModel,
    setModelStatus,
  } = useInventory();
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("all");
  const [selectedModelId, setSelectedModelId] = useState<string | "new">(models[0]?.id ?? "new");
  const [modelDraft, setModelDraft] = useState<ModelDraft>(modelDraftFromModel(models[0] ?? null));

  useEffect(() => {
    if (selectedModelId === "new") {
      setModelDraft(emptyModelDraft());
      return;
    }

    const selectedModel = models.find((model) => model.id === selectedModelId);
    if (selectedModel) {
      setModelDraft(modelDraftFromModel(selectedModel));
      return;
    }

    const firstModel = models[0] ?? null;
    setSelectedModelId(firstModel?.id ?? "new");
    setModelDraft(modelDraftFromModel(firstModel));
  }, [models, selectedModelId]);

  const manufacturerOptions = useMemo(
    () => Array.from(new Set(models.map((model) => model.manufacturer))).sort(),
    [models],
  );

  const filteredModels = useMemo(() => {
    const search = query.trim().toLowerCase();
    return models.filter((model) => {
      if (manufacturer !== "all" && model.manufacturer !== manufacturer) return false;
      if (!search) return true;
      return `${model.manufacturer} ${model.name} ${model.series} ${model.status} ${model.notes ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [manufacturer, models, query]);

  const selectedModel =
    selectedModelId === "new"
      ? null
      : models.find((model) => model.id === selectedModelId) ?? null;
  const activeCount = models.filter((model) => model.status === "active").length;
  const inactiveCount = models.filter((model) => model.status === "inactive").length;
  const compatiblePartTotal = parts.filter((part) => part.compatibleModelIds.length > 0).length;

  const handleSave = () => {
    if (!permissions.canManageModels) {
      toast.error("Your role cannot edit models.");
      return;
    }

    if (!modelDraft.manufacturer.trim() || !modelDraft.name.trim()) {
      toast.error("Manufacturer and model name are required.");
      return;
    }

    saveModel({
      ...modelDraft,
      manufacturer: modelDraft.manufacturer.trim(),
      name: modelDraft.name.trim(),
      series: modelDraft.series.trim(),
      notes: modelDraft.notes.trim(),
      id: selectedModel?.id,
    });

    toast.success(selectedModel ? "Model updated" : "Model added");
    setSelectedModelId(selectedModel?.id ?? "new");
  };

  const toggleStatus = () => {
    if (!selectedModel || !permissions.canManageModels) return;

    const nextStatus = selectedModel.status === "active" ? "inactive" : "active";
    setModelStatus(selectedModel.id, nextStatus);
    setModelDraft((current) => ({ ...current, status: nextStatus }));
    toast.success(nextStatus === "active" ? "Model restored" : "Model archived");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Models"
        title="Manage printer and copier compatibility with confidence."
        description="Keep active and inactive device models organized, search what is already linked, and archive older records instead of deleting them."
        actions={
          <>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              Inventory
            </Link>
            <Link
              href="/lookup"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <Boxes className="mr-2 h-4 w-4" />
              Lookup
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Models"
          value={models.length}
          hint="Fleet records"
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={activeCount}
          hint="Current fleet support"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          hint="Archived or retired"
          icon={<Layers3 className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Parts linked"
          value={compatiblePartTotal}
          hint="Have compatibility data"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search manufacturer, model name, series, or note"
                className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Manufacturer</p>
            <Select value={manufacturer} onValueChange={(value) => setManufacturer(value ?? "all")}>
              <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                <SelectValue placeholder="All manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All manufacturers</SelectItem>
                {manufacturerOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!permissions.canManageModels && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can search and view models, but only admins and managers can add or archive records.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">
              {permissions.canManageModels ? "Edit model" : "Model details"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {permissions.canManageModels
                ? "Update the record that part compatibility uses."
                : "Select a model to review its status and linked parts."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Manufacturer</Label>
              <Input
                value={modelDraft.manufacturer}
                onChange={(event) =>
                  setModelDraft((current) => ({ ...current, manufacturer: event.target.value }))
                }
                className="h-12 border-white/10 bg-slate-950/70 text-white"
                disabled={!permissions.canManageModels}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Model name</Label>
              <Input
                value={modelDraft.name}
                onChange={(event) =>
                  setModelDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="h-12 border-white/10 bg-slate-950/70 text-white"
                disabled={!permissions.canManageModels}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Series / family</Label>
                <Input
                  value={modelDraft.series}
                  onChange={(event) =>
                    setModelDraft((current) => ({ ...current, series: event.target.value }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageModels}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Status</Label>
                <Select
                  value={modelDraft.status}
                  onValueChange={(value) =>
                    setModelDraft((current) => ({
                      ...current,
                      status: value as ModelDraft["status"],
                    }))
                  }
                  disabled={!permissions.canManageModels}
                >
                  <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Notes</Label>
              <Textarea
                value={modelDraft.notes}
                onChange={(event) =>
                  setModelDraft((current) => ({ ...current, notes: event.target.value }))
                }
                className="min-h-28 border-white/10 bg-slate-950/70 text-white"
                disabled={!permissions.canManageModels}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {permissions.canManageModels && (
                <>
                  <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={handleSave}>
                    <Plus className="mr-2 h-4 w-4" />
                    {selectedModel ? "Save model" : "Add model"}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setSelectedModelId("new");
                      setModelDraft(emptyModelDraft());
                    }}
                  >
                    New model
                  </Button>
                  {selectedModel && (
                    <Button
                      variant="outline"
                      className={cn(
                        "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
                        selectedModel.status === "active"
                          ? "text-amber-100"
                          : "text-emerald-100",
                      )}
                      onClick={toggleStatus}
                    >
                      {selectedModel.status === "active" ? (
                        <>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Model catalog</CardTitle>
            <CardDescription className="text-slate-400">
              Choose a record to review compatibility and archive older devices instead of deleting them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredModels.map((model) => {
              const compatibleCount = countCompatiblePartsForModel(parts, model.id);
              const active = selectedModelId === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setModelDraft(modelDraftFromModel(model));
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {model.manufacturer} {model.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{model.series || "No series"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        className={cn(
                          "border",
                          model.status === "inactive"
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
                        )}
                      >
                        {getModelStatusLabel(model)}
                      </Badge>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {compatibleCount} parts
                      </Badge>
                    </div>
                  </div>
                  {active && <Badge className="border-white/10 bg-white/5 text-slate-200">Selected</Badge>}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
