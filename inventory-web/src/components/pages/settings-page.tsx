/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Database,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getRoleLabel } from "@/lib/auth";
import { getBinSummary, countCompatiblePartsForModel } from "@/lib/inventory-utils";
import type { Bin, BinDraft, DeviceModel, ModelDraft } from "@/lib/inventory-types";

function emptyBinDraft(): BinDraft {
  return {
    code: "",
    name: "",
    description: "",
    aisle: "",
    row: 1,
    column: 1,
    manufacturer: null,
    status: "active",
    notes: "",
  };
}

function binDraftFromBin(bin?: Bin | null): BinDraft {
  if (!bin) return emptyBinDraft();
  return {
    code: bin.code,
    name: bin.name,
    description: bin.description,
    aisle: bin.aisle,
    row: bin.row,
    column: bin.column,
    manufacturer: bin.manufacturer,
    status: bin.status,
    notes: bin.notes ?? "",
  };
}

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

export function SettingsPage() {
  const {
    permissions,
    realRole,
    effectiveRole,
    previewRole,
    isRolePreviewActive,
    setRolePreview,
    clearRolePreview,
  } = useAuth();
  const {
    bins,
    models,
    parts,
    settings,
    summary,
    saveBin,
    deleteBin,
    saveModel,
    deleteModel,
    updateSettings,
    resetDemoData,
  } = useInventory();

  const [lowStockThreshold, setLowStockThreshold] = useState(String(settings.lowStockThreshold));
  const [defaultPrintCopies, setDefaultPrintCopies] = useState(String(settings.defaultPrintCopies));
  const [selectedBinId, setSelectedBinId] = useState<string | "new">(bins[0]?.id ?? "new");
  const [selectedModelId, setSelectedModelId] = useState<string | "new">(models[0]?.id ?? "new");
  const [binDraft, setBinDraft] = useState<BinDraft>(binDraftFromBin(bins[0] ?? null));
  const [modelDraft, setModelDraft] = useState<ModelDraft>(modelDraftFromModel(models[0] ?? null));
  const canManageWorkspace =
    permissions.canManageParts &&
    permissions.canManageModels &&
    permissions.canManageLocations &&
    permissions.canExportReports;
  const canAccessWorkspaceSettings = canManageWorkspace || permissions.canPreviewRoles;

  useEffect(() => {
    setLowStockThreshold(String(settings.lowStockThreshold));
    setDefaultPrintCopies(String(settings.defaultPrintCopies));
  }, [settings.defaultPrintCopies, settings.lowStockThreshold]);

  useEffect(() => {
    if (selectedBinId === "new") {
      setBinDraft(emptyBinDraft());
      return;
    }

    if (bins.some((bin) => bin.id === selectedBinId)) {
      setBinDraft(binDraftFromBin(bins.find((bin) => bin.id === selectedBinId) ?? null));
      return;
    }

    setSelectedBinId(bins[0]?.id ?? "new");
    setBinDraft(binDraftFromBin(bins[0] ?? null));
  }, [bins, selectedBinId]);

  useEffect(() => {
    if (selectedModelId === "new") {
      setModelDraft(emptyModelDraft());
      return;
    }

    if (models.some((model) => model.id === selectedModelId)) {
      setModelDraft(modelDraftFromModel(models.find((model) => model.id === selectedModelId) ?? null));
      return;
    }

    setSelectedModelId(models[0]?.id ?? "new");
    setModelDraft(modelDraftFromModel(models[0] ?? null));
  }, [models, selectedModelId]);

  const activeBin = selectedBinId === "new" ? null : bins.find((bin) => bin.id === selectedBinId) ?? null;
  const activeModel = selectedModelId === "new" ? null : models.find((model) => model.id === selectedModelId) ?? null;

  const handleSettingsSave = () => {
    updateSettings({
      lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
      defaultPrintCopies: Math.max(1, Number(defaultPrintCopies) || 1),
    });
  };

  const handleBinSave = () => {
    if (!binDraft.code.trim() || !binDraft.name.trim()) {
      window.alert("Bin code and bin name are required.");
      return;
    }

    saveBin({
      ...binDraft,
      code: binDraft.code.trim(),
      name: binDraft.name.trim(),
      description: binDraft.description.trim(),
      aisle: binDraft.aisle.trim(),
      row: Number(binDraft.row) || 1,
      column: Number(binDraft.column) || 1,
      manufacturer: binDraft.manufacturer?.trim() || null,
      notes: binDraft.notes.trim(),
      id: activeBin?.id,
    });
  };

  const handleModelSave = () => {
    if (!modelDraft.manufacturer.trim() || !modelDraft.name.trim()) {
      window.alert("Manufacturer and model name are required.");
      return;
    }

    saveModel({
      ...modelDraft,
      manufacturer: modelDraft.manufacturer.trim(),
      name: modelDraft.name.trim(),
      series: modelDraft.series.trim(),
      notes: modelDraft.notes.trim(),
      id: activeModel?.id,
    });
  };

  const sortedBins = useMemo(() => [...bins].sort((left, right) => left.code.localeCompare(right.code)), [bins]);
  const sortedModels = useMemo(
    () =>
      [...models].sort((left, right) =>
        `${left.manufacturer} ${left.name}`.localeCompare(`${right.manufacturer} ${right.name}`),
      ),
    [models],
  );

  if (!canAccessWorkspaceSettings) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Admin settings"
          title="Settings are restricted to admin and manager users."
          description="Viewer and technician accounts can still search inventory, but the master-data controls live here for elevated users only."
          actions={
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              Inventory
            </Link>
          }
        />
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can view inventory data, but model, location, and workspace settings are reserved
            for admin and manager users.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Admin settings"
        title="Fine-tune locations, models, and local inventory behavior."
        description="The current app is browser-local, but these controls mirror the structure we will need when we connect Supabase in Phase 2."
        actions={
          <>
            <Link
              href="/import-export"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Import / export
            </Link>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              Inventory
            </Link>
          </>
        }
      />

      {permissions.canPreviewRoles && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardHeader className="space-y-2">
            <CardTitle className="text-white">View as Role</CardTitle>
            <CardDescription className="text-amber-100/80">
              Preview the interface as viewer, technician, or manager. This only changes the UI for your current
              browser session and never changes your real Supabase role.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Real role</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {getRoleLabel(realRole ?? "viewer")}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Effective role</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {getRoleLabel(effectiveRole)}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Preview</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {isRolePreviewActive ? "Active" : "Off"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Preview role</Label>
                <Select
                  value={previewRole ?? "admin"}
                  onValueChange={(value) => {
                    if (value === "admin") {
                      clearRolePreview();
                      return;
                    }

                    setRolePreview(value as "viewer" | "technician" | "manager");
                  }}
                >
                  <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (current)</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
              <p className="font-semibold text-white">Safe preview</p>
              <p className="mt-2">
                The preview only changes what the app shows in this browser. Server actions, admin routes, and user
                management still use your real Supabase role.
              </p>
              {isRolePreviewActive && (
                <Button
                  className="mt-4 h-11 bg-amber-400 text-slate-950 hover:bg-amber-300"
                  onClick={clearRolePreview}
                >
                  Return to Admin
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Low-stock threshold"
          value={settings.lowStockThreshold}
          hint="Used by dashboard badges"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Default print copies"
          value={settings.defaultPrintCopies}
          hint="Used by tag workflow"
          icon={<Database className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Bins"
          value={summary.binCount}
          hint="Cataloged locations"
          icon={<MapPin className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Models"
          value={summary.modelCount}
          hint="Compatibility references"
          icon={<Boxes className="h-5 w-5" />}
        />
      </div>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-4 bg-white/5 p-1">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Workspace
          </TabsTrigger>
          <TabsTrigger value="locations" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Locations
          </TabsTrigger>
          <TabsTrigger value="models" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Models
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Local inventory settings</CardTitle>
              <CardDescription className="text-slate-400">
                These values shape badges, tag defaults, and future migration behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-200">Low-stock threshold</Label>
                <Input
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(event) => setLowStockThreshold(event.target.value)}
                  className="border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Default print copies</Label>
                <Input
                  type="number"
                  min={1}
                  value={defaultPrintCopies}
                  onChange={(event) => setDefaultPrintCopies(event.target.value)}
                  className="border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Theme</Label>
                <Input value={settings.theme} readOnly className="border-white/10 bg-slate-950/70 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Storage mode</Label>
                <Input
                  value={settings.storageMode}
                  readOnly
                  className="border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Sync mode</Label>
                <Input value={settings.syncMode} readOnly className="border-white/10 bg-slate-950/70 text-white" />
              </div>
              <div className="flex items-end">
                <Button className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={handleSettingsSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Edit bin</CardTitle>
                <CardDescription className="text-slate-400">
                  Keep the physical storage map aligned with what the crew sees on the shelf.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Code</Label>
                    <Input
                      value={binDraft.code}
                      onChange={(event) => setBinDraft((current) => ({ ...current, code: event.target.value }))}
                      className="border-white/10 bg-slate-950/70 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Name</Label>
                    <Input
                      value={binDraft.name}
                      onChange={(event) => setBinDraft((current) => ({ ...current, name: event.target.value }))}
                      className="border-white/10 bg-slate-950/70 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Description</Label>
                  <Textarea
                    value={binDraft.description}
                    onChange={(event) =>
                      setBinDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    className="min-h-24 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Aisle</Label>
                    <Input
                      value={binDraft.aisle}
                      onChange={(event) => setBinDraft((current) => ({ ...current, aisle: event.target.value }))}
                      className="border-white/10 bg-slate-950/70 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Row</Label>
                    <Input
                      type="number"
                      min={1}
                      value={binDraft.row}
                      onChange={(event) => setBinDraft((current) => ({ ...current, row: Number(event.target.value) || 1 }))}
                      className="border-white/10 bg-slate-950/70 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Column</Label>
                    <Input
                      type="number"
                      min={1}
                      value={binDraft.column}
                      onChange={(event) =>
                        setBinDraft((current) => ({ ...current, column: Number(event.target.value) || 1 }))
                      }
                      className="border-white/10 bg-slate-950/70 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Manufacturer</Label>
                  <Input
                    value={binDraft.manufacturer ?? ""}
                    onChange={(event) =>
                      setBinDraft((current) => ({
                        ...current,
                        manufacturer: event.target.value || null,
                      }))
                    }
                    className="border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Notes</Label>
                  <Textarea
                    value={binDraft.notes}
                    onChange={(event) => setBinDraft((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-24 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={handleBinSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save bin
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setSelectedBinId("new");
                      setBinDraft(emptyBinDraft());
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New bin
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Bin catalog</CardTitle>
                <CardDescription className="text-slate-400">
                  Choose a bin to edit, or delete one after moving the contents elsewhere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedBins.map((bin) => {
                  const summaryForBin = getBinSummary(bin, parts);
                  const active = selectedBinId === bin.id;

                  return (
                    <div
                      key={bin.id}
                      onClick={() => setSelectedBinId(bin.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition-colors",
                        active
                          ? "border-amber-400/30 bg-amber-400/10"
                          : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {bin.code} · {bin.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{bin.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge className="border-white/10 bg-white/5 text-slate-200">{bin.aisle}-{bin.row}-{bin.column}</Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-200">{summaryForBin.parts.length} parts</Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-200">{summaryForBin.lowStockCount} low</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={(event) => {
                            event.stopPropagation();
                            setSelectedBinId(bin.id);
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-300 hover:bg-white/10 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete ${bin.code}? Parts assigned to it will become unassigned.`)) {
                              deleteBin(bin.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Edit model</CardTitle>
                <CardDescription className="text-slate-400">
                  Keep compatibility records clean so search and tags stay useful.
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
                    className="border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Model name</Label>
                  <Input
                    value={modelDraft.name}
                    onChange={(event) => setModelDraft((current) => ({ ...current, name: event.target.value }))}
                    className="border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Series</Label>
                    <Input
                      value={modelDraft.series}
                      onChange={(event) =>
                        setModelDraft((current) => ({ ...current, series: event.target.value }))
                      }
                      className="border-white/10 bg-slate-950/70 text-white"
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
                    >
                      <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
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
                    className="min-h-24 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={handleModelSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save model
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setSelectedModelId("new");
                      setModelDraft(emptyModelDraft());
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New model
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Model catalog</CardTitle>
                <CardDescription className="text-slate-400">
                  Active and legacy devices are both preserved to keep compatibility lookups accurate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedModels.map((model) => {
                  const compatibleCount = countCompatiblePartsForModel(parts, model.id);
                  const active = selectedModelId === model.id;

                  return (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition-colors",
                        active
                          ? "border-amber-400/30 bg-amber-400/10"
                          : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {model.manufacturer} {model.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{model.series}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge className="border-white/10 bg-white/5 text-slate-200">{model.status}</Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-200">{compatibleCount} parts</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-300 hover:bg-white/10 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedModelId(model.id);
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-300 hover:bg-white/10 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete ${model.manufacturer} ${model.name}?`)) {
                              deleteModel(model.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Reset and recover</CardTitle>
              <CardDescription className="text-slate-400">
                Use these controls when you want to go back to the seeded Phase 1 dataset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                Resetting the demo store is safe for development, but it will overwrite any local browser changes.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                  onClick={() => {
                    if (window.confirm("Reset the local browser store back to the demo seed data?")) {
                      resetDemoData();
                    }
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset demo data
                </Button>
                <Link
                  href="/activity"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  View activity
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Current state</CardTitle>
              <CardDescription className="text-slate-400">
                These values make the app easy to migrate later without changing the UI shape.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Storage mode", value: settings.storageMode },
                { label: "Sync mode", value: settings.syncMode },
                { label: "Theme", value: settings.theme },
                { label: "Coverage", value: `${summary.coverage}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
