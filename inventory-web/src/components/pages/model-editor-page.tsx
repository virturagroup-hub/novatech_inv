"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DeviceModel, ModelDraft } from "@/lib/inventory-types";
import { countCompatiblePartsForModel } from "@/lib/inventory-utils";

type ModelEditorPageProps = {
  mode: "create" | "edit";
  modelId?: string;
};

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

export function ModelEditorPage({ mode, modelId }: Readonly<ModelEditorPageProps>) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { parts, saveModel, deleteModel, setModelStatus, getModelById } = useInventory();
  const editingModel = mode === "edit" && modelId ? getModelById(modelId) ?? null : null;
  const [draft, setDraft] = useState<ModelDraft>(() => modelDraftFromModel(editingModel));
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"status" | "delete" | null>(null);
  const canManageModel = permissions.canManageModels;

  useEffect(() => {
    setDraft(modelDraftFromModel(editingModel));
  }, [editingModel]);

  const compatibleCount = useMemo(() => {
    if (mode === "edit" && editingModel) {
      return countCompatiblePartsForModel(parts, editingModel.id);
    }

    return 0;
  }, [editingModel, mode, parts]);

  const canDelete = compatibleCount === 0;

  if (mode === "edit" && !editingModel) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-300">That model could not be found.</p>
            <Link
              href="/models"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to models
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    if (!canManageModel) {
      toast.error("Your current role cannot edit models.");
      return;
    }

    if (!draft.manufacturer.trim() || !draft.name.trim()) {
      toast.error("Manufacturer and model name are required.");
      return;
    }

    setSaving(true);
    try {
      saveModel({
        ...draft,
        manufacturer: draft.manufacturer.trim(),
        name: draft.name.trim(),
        series: draft.series.trim(),
        notes: draft.notes.trim(),
        id: editingModel?.id,
      });
      toast.success(mode === "edit" ? "Model updated" : "Model added");
      router.push("/models");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!editingModel) return;

    const nextStatus = editingModel.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${nextStatus === "active" ? "Restore" : "Archive"} ${editingModel.manufacturer} ${editingModel.name}?`)) {
      return;
    }

    setBusyAction("status");
    try {
      setModelStatus(editingModel.id, nextStatus);
      setDraft((current) => ({ ...current, status: nextStatus }));
      toast.success(nextStatus === "active" ? "Model restored" : "Model archived");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!editingModel) return;

    if (!canDelete) {
      toast.error("Archive this model instead of deleting it because parts are still linked to it.");
      return;
    }

    if (!window.confirm(`Delete ${editingModel.manufacturer} ${editingModel.name}?`)) {
      return;
    }

    setBusyAction("delete");
    try {
      deleteModel(editingModel.id);
      toast.success("Model deleted");
      router.push("/models");
    } finally {
      setBusyAction(null);
    }
  };

  const pageTitle = mode === "create" ? "Create model" : `Edit ${editingModel?.manufacturer ?? "model"}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Models"
        title={pageTitle}
        description={
          mode === "create"
            ? "Add a new printer or copier model so parts can be matched to it later."
            : "Update the model record and keep the compatibility list tidy."
        }
        actions={
          <Link
            href="/models"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to models
          </Link>
        }
      />

      {!canManageModel && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can view models, but editing is restricted in this preview.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Model details</CardTitle>
            <CardDescription className="text-slate-400">
              Keep the manufacturer, model name, and series clean so compatibility search stays useful.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Manufacturer</Label>
              <Input
                value={draft.manufacturer}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, manufacturer: event.target.value }))
                }
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Canon"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Model name</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="iR-ADV C5500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Series / family</Label>
                <Input
                  value={draft.series}
                  onChange={(event) => setDraft((current) => ({ ...current, series: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  placeholder="C5500 series"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      status: value as ModelDraft["status"],
                    }))
                  }
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
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Any compatibility notes that help the team."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => void handleSave()}
                disabled={saving || !canManageModel}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {mode === "edit" ? "Save changes" : "Add model"}
              </Button>
              <Link
                href="/models"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                Cancel
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Summary</CardTitle>
              <CardDescription className="text-slate-400">
                A quick preview of the compatibility record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Model</p>
                <p className="mt-2 text-lg font-semibold text-white">{draft.manufacturer || "Manufacturer"}</p>
                <p className="mt-1 text-sm text-slate-400">{draft.name || "Model name"}</p>
              </div>

              <div className="grid gap-2">
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Series</span>
                  <span>{draft.series || "—"}</span>
                </Badge>
                <Badge
                  className={
                    draft.status === "active"
                      ? "justify-between border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-100"
                      : "justify-between border-amber-400/20 bg-amber-400/10 px-3 py-2 text-amber-100"
                  }
                >
                  <span>Status</span>
                  <span>{draft.status === "active" ? "Active" : "Inactive"}</span>
                </Badge>
              </div>

              {mode === "edit" && (
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-semibold text-white">{compatibleCount} parts are linked to this model.</p>
                  {compatibleCount > 0 ? (
                    <p className="mt-2 text-slate-400">
                      Archive this model instead of deleting it if you want to keep compatibility history intact.
                    </p>
                  ) : (
                    <p className="mt-2 text-slate-400">This model is not linked to any parts yet, so delete is safe.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {mode === "edit" && editingModel && permissions.canManageModels && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Archive and delete</CardTitle>
                <CardDescription className="text-slate-400">
                  Archive first if parts still depend on this compatibility record.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className={cn(
                    "w-full",
                    editingModel.status === "active"
                      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                  )}
                  onClick={() => void handleStatusToggle()}
                  disabled={busyAction === "status"}
                >
                  {busyAction === "status" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : editingModel.status === "active" ? (
                    <Archive className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {editingModel.status === "active" ? "Archive model" : "Restore model"}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => void handleDelete()}
                  disabled={busyAction === "delete" || !canDelete}
                >
                  {busyAction === "delete" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {canDelete ? "Delete model" : "Delete unavailable while linked"}
                </Button>
                {!canDelete && (
                  <p className="text-sm leading-6 text-slate-400">
                    Parts are linked to this model, so delete is disabled. Archive is the safer option.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
