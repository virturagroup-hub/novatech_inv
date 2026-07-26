"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Boxes, Layers3, PackageSearch, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { countCompatiblePartsForModel, getModelStatusLabel } from "@/lib/inventory-utils";
import {
  getModelDisplayName,
  getModelSearchReason,
  groupModelsForSearch,
} from "@/lib/model-search";
import { parseModelCsv, type ModelCsvPreview } from "@/lib/model-csv";

export function ModelsPage() {
  const { permissions, effectiveRole } = useAuth();
  const { models, parts, deleteModel, setModelStatus, refreshInventory } = useInventory();
  const [query, setQuery] = useState("");
  const [modelImportPreview, setModelImportPreview] = useState<ModelCsvPreview | null>(null);
  const [modelImportText, setModelImportText] = useState("");
  const [modelImportBusy, setModelImportBusy] = useState(false);

  const groupedModels = useMemo(() => groupModelsForSearch(models, query), [models, query]);

  const activeCount = models.filter((model) => model.status === "active").length;
  const inactiveCount = models.filter((model) => model.status === "inactive").length;
  const linkedModelCount = models.filter((model) => countCompatiblePartsForModel(parts, model.id) > 0).length;

  const handleStatusToggle = (modelId: string, nextStatus: "active" | "inactive", label: string) => {
    if (!window.confirm(`${nextStatus === "active" ? "Restore" : "Archive"} ${label}?`)) {
      return;
    }

    setModelStatus(modelId, nextStatus);
    toast.success(nextStatus === "active" ? "Model restored" : "Model archived");
  };

  const handleDelete = (modelId: string, label: string) => {
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    deleteModel(modelId);
    toast.success("Model deleted");
  };

  const canImportModels = effectiveRole === "admin";

  const handleModelImportFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      const text = await file.text();
      const preview = parseModelCsv(text);
      setModelImportText(text);
      setModelImportPreview(preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the model CSV.");
    }
  };

  const commitModelImport = async () => {
    if (!canImportModels || !modelImportText || !modelImportPreview || modelImportPreview.readyRows === 0) {
      return;
    }

    if (!window.confirm(`Import ${modelImportPreview.readyRows} valid model rows? Existing models will not be deleted.`)) {
      return;
    }

    setModelImportBusy(true);
    try {
      const response = await fetch("/api/models/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText: modelImportText }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        modelsCreated?: number;
        modelsUpdated?: number;
        invalidRows?: number;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Model import failed.");
      }

      await refreshInventory();
      toast.success(
        `Model import complete: ${payload.modelsCreated ?? 0} created, ${payload.modelsUpdated ?? 0} updated, ${payload.invalidRows ?? 0} invalid.`,
      );
      setModelImportPreview(null);
      setModelImportText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Model import failed.");
    } finally {
      setModelImportBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Models"
        title="Manage printer and copier compatibility."
        description="Keep manufacturer, model, and series records clean so parts stay easy to match. Archive retired devices instead of deleting them when parts still depend on them."
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.canManageModels && (
              <Link
                href="/models/new"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                New model
              </Link>
            )}
            {canImportModels && (
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "cursor-pointer border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => void handleModelImportFile(event.target.files?.[0])}
                />
              </label>
            )}
          </div>
        }
      />

      {canImportModels && modelImportPreview && (
        <Card className="border-sky-400/20 bg-sky-400/10">
          <CardHeader>
            <CardTitle className="text-white">Model import preview</CardTitle>
            <CardDescription className="text-slate-300">
              {modelImportPreview.totalRows} rows · {modelImportPreview.readyRows} ready · {modelImportPreview.invalidRows} invalid · {modelImportPreview.duplicateRows} duplicate CSV rows skipped
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={() => void commitModelImport()}
              disabled={modelImportBusy || modelImportPreview.readyRows === 0}
            >
              {modelImportBusy ? "Importing..." : "Commit import"}
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setModelImportPreview(null);
                setModelImportText("");
              }}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
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
          icon={<Boxes className="h-5 w-5" />}
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
          label="Linked models"
          value={linkedModelCount}
          hint="Have compatibility data"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search models</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search manufacturer, model, series, or notes"
                className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
            Open a model to edit the compatibility record, or archive it if the device is retired.
          </div>
        </CardContent>
      </Card>

      {!permissions.canManageModels && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-sm text-slate-300">
            You can view the model list and compatibility counts. Admins and managers can add or edit the records.
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Model catalog</CardTitle>
          <CardDescription className="text-slate-400">
            Open a model to review its details. Edit and archive controls appear for elevated users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupedModels.length > 0 ? (
            <ScrollArea className="h-[clamp(24rem,60vh,42rem)] rounded-3xl border border-white/10 bg-slate-950/50">
              <div className="space-y-4 p-3 pr-4">
                {groupedModels.map((group) => (
                  <Card key={group.familyKey} className="border-white/10 bg-slate-950/50">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          Series / family
                        </Badge>
                        <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                          {group.label}
                        </Badge>
                        <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                          {group.models.length} model{group.models.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-white">
                            {group.manufacturer} family
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            {getModelSearchReason(group)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.models.map((model) => {
                        const compatibleCount = countCompatiblePartsForModel(parts, model.id);
                        const safeToDelete = compatibleCount === 0;

                        return (
                          <div
                            key={model.id}
                            className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-white">
                                    {getModelDisplayName(model)}
                                  </p>
                                  <Badge
                                    className={
                                      model.status === "inactive"
                                        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                    }
                                  >
                                    {getModelStatusLabel(model)}
                                  </Badge>
                                  {compatibleCount > 0 && (
                                    <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                                      {compatibleCount} parts
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400">
                                  {model.series || "No series listed"}
                                </p>
                                {model.notes && <p className="text-sm text-slate-300">{model.notes}</p>}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/models/${model.id}`}
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "default" }),
                                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                                  )}
                                >
                                  View
                                </Link>
                                {permissions.canManageModels && (
                                  <Link
                                    href={`/models/${model.id}/edit`}
                                    className={cn(
                                      buttonVariants({ variant: "outline", size: "default" }),
                                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                                    )}
                                  >
                                    Edit
                                  </Link>
                                )}
                                {permissions.canManageModels && (
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
                                      model.status === "active" ? "text-amber-100" : "text-emerald-100",
                                    )}
                                    onClick={() =>
                                      handleStatusToggle(
                                        model.id,
                                        model.status === "active" ? "inactive" : "active",
                                        getModelDisplayName(model),
                                      )
                                    }
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    {model.status === "active" ? "Archive" : "Restore"}
                                  </Button>
                                )}
                                {permissions.canManageModels && safeToDelete && (
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleDelete(model.id, getModelDisplayName(model))}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
              No models matched the current search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
