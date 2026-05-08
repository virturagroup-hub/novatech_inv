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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Bin, BinDraft } from "@/lib/inventory-types";
import { getBinSummary } from "@/lib/inventory-utils";

type LocationEditorPageProps = {
  mode: "create" | "edit";
  binId?: string;
};

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

export function LocationEditorPage({ mode, binId }: Readonly<LocationEditorPageProps>) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { parts, saveBin, deleteBin, setBinStatus, getBinById } = useInventory();
  const editingBin = mode === "edit" && binId ? getBinById(binId) : null;
  const [draft, setDraft] = useState<BinDraft>(() => binDraftFromBin(editingBin));
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"status" | "delete" | null>(null);
  const canManageLocation = permissions.canManageLocations;

  useEffect(() => {
    setDraft(binDraftFromBin(editingBin));
  }, [editingBin]);

  const summary = useMemo(() => {
    if (mode === "edit" && editingBin) {
      return getBinSummary(editingBin, parts);
    }

    return {
      parts: [],
      totalUnits: 0,
      lowStockCount: 0,
    };
  }, [editingBin, mode, parts]);

  const linkedPartCount = summary.parts.length;
  const canDelete = linkedPartCount === 0;

  if (mode === "edit" && !editingBin) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-300">That location could not be found.</p>
            <Link
              href="/locations"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to locations
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const saveLocation = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      throw new Error("Location code and name are required.");
    }

    const nextDraft: BinDraft = {
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      aisle: draft.aisle.trim(),
      row: Number(draft.row) || 1,
      column: Number(draft.column) || 1,
      manufacturer: draft.manufacturer?.trim() || null,
      notes: draft.notes.trim(),
      id: editingBin?.id,
    };

    saveBin(nextDraft);
  };

  const handleSave = async () => {
    if (!canManageLocation) {
      toast.error("Your current role cannot edit locations.");
      return;
    }

    setSaving(true);

    try {
      await saveLocation();
      toast.success(mode === "edit" ? "Location updated" : "Location added");
      router.push("/locations");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not save that location.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!editingBin) return;

    const nextStatus = editingBin.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${nextStatus === "active" ? "Restore" : "Archive"} ${editingBin.code}?`)) {
      return;
    }

    setBusyAction("status");
    try {
      setBinStatus(editingBin.id, nextStatus);
      setDraft((current) => ({ ...current, status: nextStatus }));
      toast.success(nextStatus === "active" ? "Location restored" : "Location archived");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!editingBin) return;

    if (!canDelete) {
      toast.error("Archive this location instead of deleting it because parts are assigned to it.");
      return;
    }

    if (!window.confirm(`Delete ${editingBin.code}?`)) {
      return;
    }

    setBusyAction("delete");
    try {
      deleteBin(editingBin.id);
      toast.success("Location deleted");
      router.push("/locations");
    } finally {
      setBusyAction(null);
    }
  };

  const pageTitle = mode === "create" ? "Create location" : `Edit ${editingBin?.code ?? "location"}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Locations"
        title={pageTitle}
        description={
          mode === "create"
            ? "Add a new shelf or bin location. Keep the wording short so technicians can scan and understand it quickly."
            : "Update the shelf details, status, or notes. Archive a location if parts are still assigned to it."
        }
        actions={
          <Link
            href="/locations"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to locations
          </Link>
        }
      />

      {!canManageLocation && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can view locations, but editing is restricted in this preview.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Location details</CardTitle>
            <CardDescription className="text-slate-400">
              Use simple location codes and plain language so the bin map stays easy to read.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Location code</Label>
                <Input
                  value={draft.code}
                  onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  placeholder="LOC-A1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Location name</Label>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  placeholder="Front cabinet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Description</Label>
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="What the team should know about this location."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-200">Area</Label>
                <Input
                  value={draft.aisle}
                  onChange={(event) => setDraft((current) => ({ ...current, aisle: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  placeholder="A"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Shelf</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.row}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, row: Number(event.target.value) || 1 }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Bin</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.column}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, column: Number(event.target.value) || 1 }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Manufacturer</Label>
              <Input
                value={draft.manufacturer ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, manufacturer: event.target.value || null }))
                }
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Notes</Label>
              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-24 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Simple shelf notes or handling notes."
              />
            </div>

            {mode === "edit" && editingBin && (
              <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Active location</p>
                  <p className="text-xs text-slate-400">
                    Inactive locations stay out of the normal part assignment flow.
                  </p>
                </div>
                <Checkbox
                  checked={draft.status === "active"}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      status: checked ? "active" : "inactive",
                    }))
                  }
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => void handleSave()}
                disabled={saving || !canManageLocation}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {mode === "edit" ? "Save changes" : "Add location"}
              </Button>
              <Link
                href="/locations"
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
                A quick preview of the shelf record before you save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Location</p>
                <p className="mt-2 text-lg font-semibold text-white">{draft.code || "New location"}</p>
                <p className="mt-1 text-sm text-slate-400">{draft.name || "Location name"}</p>
              </div>

              <div className="grid gap-2">
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Code</span>
                  <span>{draft.code || "—"}</span>
                </Badge>
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Area / shelf / bin</span>
                  <span>
                    {draft.aisle || "—"}-{draft.row || 1}-{draft.column || 1}
                  </span>
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
                  <p className="font-semibold text-white">{linkedPartCount} parts are assigned here.</p>
                  {linkedPartCount > 0 ? (
                    <p className="mt-2 text-slate-400">
                      Archive this location instead of deleting it so the assigned parts keep a safe home.
                    </p>
                  ) : (
                    <p className="mt-2 text-slate-400">This location is empty, so deleting it is safe.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {mode === "edit" && editingBin && permissions.canManageLocations && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Archive and delete</CardTitle>
                <CardDescription className="text-slate-400">
                  Use archive first when parts are still assigned to this location.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className={cn(
                    "w-full",
                    editingBin.status === "active"
                      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                  )}
                  onClick={() => void handleStatusToggle()}
                  disabled={busyAction === "status"}
                >
                  {busyAction === "status" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : editingBin.status === "active" ? (
                    <Archive className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {editingBin.status === "active" ? "Archive location" : "Restore location"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 hover:text-white"
                  onClick={() => void handleDelete()}
                  disabled={busyAction === "delete" || !canDelete}
                >
                  {busyAction === "delete" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {canDelete ? "Delete location" : "Delete unavailable while assigned"}
                </Button>
                {!canDelete && (
                  <p className="text-sm leading-6 text-slate-400">
                    This location has parts assigned to it, so delete is disabled. Archive is the safer option.
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
