"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  Printer,
  Save,
  Send,
  RotateCcw,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { MachinePartPicker } from "@/components/machine-part-picker";
import { MachineModelPicker } from "@/components/machine-model-picker";
import { useInventory } from "@/components/inventory-provider";
import { ModelFamilyPicker } from "@/components/model-family-picker";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildMachinePrintHref } from "@/lib/labels";
import { getGreenMachineArchiveRetentionLabel } from "@/lib/green-machine-retention";
import { formatDateTime, formatRelative } from "@/lib/inventory-utils";
import { categories, defaultCategory, manufacturers, type Part } from "@/lib/inventory-types";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import type { GreenMachineDraft, GreenMachineEventDraft } from "@/lib/workspace-content-types";

function statusTone(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "partially_stripped":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "depleted":
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
    case "scrapped":
    case "archived":
    default:
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }
}

function statusLabel(status: GreenMachineDraft["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "partially_stripped":
      return "Partially stripped";
    case "depleted":
      return "Depleted";
    case "scrapped":
      return "Scrapped";
    case "archived":
    default:
      return "Archived";
  }
}

type MachineTransferDraft = {
  selectedPartId: string | null;
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

function createBlankTransferDraft(): MachineTransferDraft {
  return {
    selectedPartId: null,
    partNumber: "",
    isNpn: false,
    partName: "",
    manufacturer: "Canon",
    category: defaultCategory,
    binId: "",
    quantityOnHand: "1",
    reorderPoint: "5",
    reorderTarget: "12",
    notes: "",
    universal: false,
    compatibleModelIds: [],
  };
}

function createTransferDraftFromPart(part: Part): MachineTransferDraft {
  return {
    selectedPartId: part.id,
    partNumber: part.isNpn ? "" : part.partNumber,
    isNpn: Boolean(part.isNpn),
    partName: part.partName,
    manufacturer: part.manufacturer,
    category: part.category,
    binId: part.binId ?? "",
    quantityOnHand: "1",
    reorderPoint: String(part.reorderPoint),
    reorderTarget: String(part.reorderTarget),
    notes: part.notes,
    universal: part.universal,
    compatibleModelIds: part.compatibleModelIds,
  };
}

export function GreenMachineDetailPage({ machineId }: Readonly<{ machineId: string }>) {
  const { permissions } = useAuth();
  const { bins, getBinById, getDisplayPartNumber, models, parts, addPart } = useInventory();
  const {
    getGreenMachineById,
    greenMachineEventsFor,
    saveGreenMachine,
    archiveGreenMachine,
    deleteGreenMachine,
    restoreGreenMachine,
    addGreenMachineEvent,
  } = useWorkspaceContent();

  const router = useRouter();
  const machine = getGreenMachineById(machineId);
  const [draft, setDraft] = useState<GreenMachineDraft | null>(null);
  const [eventDraft, setEventDraft] = useState<GreenMachineEventDraft>({
    eventType: "taken",
    partId: null,
    partName: "",
    partCategory: defaultCategory,
    quantity: "1",
    condition: "",
    note: "",
  });
  const [transferDraft, setTransferDraft] = useState<MachineTransferDraft>(() => createBlankTransferDraft());
  const canManageGreenMachines = permissions.canManageGreenMachines;
  const canRecordGreenMachineEvents = permissions.canRecordGreenMachineEvents;

  useEffect(() => {
    if (!machine) return;

    queueMicrotask(() => {
      setDraft({
        id: machine.id,
        modelId: machine.modelId,
        modelName: machine.modelName,
        seriesFamily: machine.seriesFamily,
        serialNumber: machine.serialNumber ?? "",
        locationId: machine.locationId,
        status: machine.status,
        notes: machine.notes,
      });
      setTransferDraft(createBlankTransferDraft());
    });
  }, [machine]);

  const location = useMemo(() => (machine ? getBinById(machine.locationId ?? "") : null), [getBinById, machine]);
  const events = machine ? greenMachineEventsFor(machine.id) : [];
  const selectedTransferPart = transferDraft.selectedPartId
    ? parts.find((part) => part.id === transferDraft.selectedPartId) ?? null
    : null;
  const handleModelChange = (model: (typeof models)[number] | null) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      if (!model) {
        return { ...current, modelId: null };
      }

      return {
        ...current,
        modelId: model.id,
        modelName: model.manufacturer ? `${model.manufacturer} ${model.name}` : model.name,
        seriesFamily: model.series.trim() || current.seriesFamily,
      };
    });
  };

  if (!machine) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Machine not found</h1>
                <p className="text-sm text-slate-400">
                  The machine record is not available in the current workspace.
                </p>
              </div>
            </div>
            <Link
              href="/green-machines"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Machines
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventCount = events.length;
  const pulledCount = events.filter((event) => event.eventType === "taken" || event.eventType === "transferred_to_inventory").length;
  const machineLabel = `${machine.modelName}${machine.serialNumber ? ` · SN ${machine.serialNumber}` : ""}`;

  const saveMachine = () => {
    if (!canManageGreenMachines || !draft) {
      return;
    }

    if (!draft.modelName.trim() || !draft.seriesFamily.trim()) {
      toast.error("Model name and series/family are required.");
      return;
    }

    saveGreenMachine({
      ...draft,
      modelName: draft.modelName.trim(),
      seriesFamily: draft.seriesFamily.trim(),
      serialNumber: draft.serialNumber?.trim() ?? "",
      notes: draft.notes.trim(),
    });
    toast.success("Machine updated");
  };

  const resetEventDraft = () => {
    setEventDraft({
      eventType: "taken",
      partId: null,
      partName: "",
      partCategory: defaultCategory,
      quantity: "1",
      condition: "",
      note: "",
    });
    setTransferDraft(createBlankTransferDraft());
  };

  const saveEvent = () => {
    if (!canRecordGreenMachineEvents) {
      return;
    }

    if (eventDraft.eventType === "transferred_to_inventory") {
      const normalizedPartName = transferDraft.partName.trim();
      const normalizedPartNumber = transferDraft.isNpn ? "" : transferDraft.partNumber.trim().toUpperCase();
      const transferQuantity = Math.max(1, Number(transferDraft.quantityOnHand) || 1);
      const matchedPartByNumber = transferDraft.isNpn
        ? null
        : parts.find(
            (part) =>
              !part.isNpn &&
              part.partNumber.trim().toUpperCase() === normalizedPartNumber,
          ) ?? null;

      if (!normalizedPartName) {
        toast.error("Add a part name before transferring it to inventory.");
        return;
      }

      if (!transferDraft.isNpn && !normalizedPartNumber) {
        toast.error("Add a part number or mark the item as NPN.");
        return;
      }

      const quantityBasePart = selectedTransferPart ?? matchedPartByNumber;
      const nextPartId = quantityBasePart?.id ?? crypto.randomUUID();
      const nextQuantity = (quantityBasePart?.quantityOnHand ?? 0) + transferQuantity;

      addPart({
        id: nextPartId,
        partNumber: normalizedPartNumber,
        isNpn: transferDraft.isNpn,
        partName: normalizedPartName,
        manufacturer: transferDraft.manufacturer.trim(),
        category: transferDraft.category,
        binId: transferDraft.binId || null,
        quantityOnHand: nextQuantity,
        reorderPoint: Math.max(0, Number(transferDraft.reorderPoint) || 0),
        reorderTarget: Math.max(0, Number(transferDraft.reorderTarget) || 0),
        compatibleModelIds: transferDraft.compatibleModelIds,
        universal: transferDraft.universal,
        notes: transferDraft.notes.trim(),
      });

      addGreenMachineEvent(machine.id, {
        eventType: "transferred_to_inventory",
        partId: nextPartId,
        partName: normalizedPartName,
        partCategory: transferDraft.category,
        quantity: String(transferQuantity),
        condition: "",
        note: eventDraft.note.trim(),
      });
      resetEventDraft();
      toast.success("Part transferred to inventory");
      return;
    }

    const normalizedPartName = eventDraft.partName.trim();
    const requiresPartContext =
      eventDraft.eventType === "taken" || eventDraft.eventType === "status_change";

    if (requiresPartContext && !normalizedPartName) {
      toast.error("Add a part name before saving the event.");
      return;
    }

    addGreenMachineEvent(machine.id, {
      ...eventDraft,
      partName: normalizedPartName,
      partCategory: eventDraft.partCategory.trim() || defaultCategory,
      note: eventDraft.note.trim(),
      condition: eventDraft.condition.trim(),
    });
    resetEventDraft();
    toast.success("Event added");
  };

  const confirmArchiveMachine = () => {
    if (!window.confirm(`Archive ${machineLabel}? It will be hidden for 30 days.`)) {
      return;
    }

    archiveGreenMachine(machine.id);
    toast.success("Machine archived for 30 days");
  };

  const confirmDeleteMachine = () => {
    if (
      !window.confirm(
        `Delete ${machineLabel} permanently? This removes the machine and its timeline.`,
      )
    ) {
      return;
    }

    deleteGreenMachine(machine.id);
    toast.success("Machine deleted");
    router.replace("/green-machines");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Machine detail"
        title={machine.modelName}
        description={`${machine.seriesFamily}${machine.serialNumber ? ` · SN ${machine.serialNumber}` : ""}${location ? ` · ${location.code}` : ""}`}
        actions={
          <>
            <Link
              href="/green-machines"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              All machines
            </Link>
            {permissions.canManageGreenMachines && (
              <>
                <Link
                  href={buildMachinePrintHref({ machineId: machine.id, layout: "thermal" })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print label
                </Link>
                {machine.status === "archived" ? (
                  <Button
                    variant="outline"
                    className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 hover:text-white"
                    onClick={() => {
                      restoreGreenMachine(machine.id);
                      toast.success("Machine restored");
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={confirmArchiveMachine}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                )}
                <Button
                  variant="destructive"
                  className="bg-rose-500 text-white hover:bg-rose-400"
                  onClick={confirmDeleteMachine}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events"
          value={eventCount}
          hint="Timeline entries"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Pulled parts"
          value={pulledCount}
          hint="Taken or transferred"
          icon={<Wrench className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Status"
          value={statusLabel(machine.status)}
          hint={
            machine.status === "archived"
              ? getGreenMachineArchiveRetentionLabel(machine) ?? "Archived machine"
              : "Current machine state"
          }
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Updated"
          value={formatRelative(machine.updatedAt)}
          hint={formatDateTime(machine.updatedAt)}
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {canManageGreenMachines ? (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Machine record</CardTitle>
              <CardDescription className="text-slate-400">
                Edit the machine details and keep the teardown notes current.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft && (
                <>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Inventory model</Label>
                    <MachineModelPicker
                      models={models}
                      value={draft.modelId}
                      onChange={handleModelChange}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Model name</Label>
                      <Input
                        value={draft.modelName}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, modelName: event.target.value } : current))
                        }
                        className="h-12 border-white/10 bg-slate-950/70 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Series / family</Label>
                      <Input
                        value={draft.seriesFamily}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, seriesFamily: event.target.value } : current,
                          )
                        }
                        className="h-12 border-white/10 bg-slate-950/70 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Serial number</Label>
                      <Input
                        value={draft.serialNumber}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, serialNumber: event.target.value } : current,
                          )
                        }
                        className="h-12 border-white/10 bg-slate-950/70 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Location</Label>
                      <Select
                        value={draft.locationId ?? "unassigned"}
                        onValueChange={(value) =>
                          setDraft((current) =>
                            current
                              ? { ...current, locationId: value === "unassigned" ? null : value }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {[...bins].sort((left, right) => left.code.localeCompare(right.code)).map((bin) => (
                            <SelectItem key={bin.id} value={bin.id}>
                              {bin.code} · {bin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Status</Label>
                      <Select
                        value={draft.status}
                        onValueChange={(value) =>
                          setDraft((current) =>
                            current ? { ...current, status: value as GreenMachineDraft["status"] } : current,
                          )
                        }
                      >
                        <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="partially_stripped">Partially stripped</SelectItem>
                          <SelectItem value="depleted">Depleted</SelectItem>
                          <SelectItem value="scrapped">Scrapped</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Notes</Label>
                      <Textarea
                        value={draft.notes}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, notes: event.target.value } : current))
                        }
                        className="min-h-28 border-white/10 bg-slate-950/70 text-white"
                      />
                    </div>
                  </div>

                  <Button
                    className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    onClick={saveMachine}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save machine
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Machine record</CardTitle>
              <CardDescription className="text-slate-400">
                Read-only machine summary for floor lookups and QR scans.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model</p>
                  <p className="mt-2 text-sm font-semibold text-white">{machine.modelName}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Series / family</p>
                  <p className="mt-2 text-sm font-semibold text-white">{machine.seriesFamily}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Serial</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {machine.serialNumber || "Unlisted"}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {location ? `${location.code} · ${location.name}` : "Unassigned"}
                  </p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border", statusTone(machine.status))}>
                    {statusLabel(machine.status)}
                  </Badge>
                  {machine.modelId && (
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      Linked to inventory model
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {machine.notes || "No machine notes yet."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Timeline and part transfer</CardTitle>
            <CardDescription className="text-slate-400">
              Add a taken note, transfer reusable parts back into inventory, and keep the machine log easy to read on mobile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canRecordGreenMachineEvents && (
              <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Event type</Label>
                  <Select
                    value={eventDraft.eventType}
                    onValueChange={(value) =>
                      setEventDraft((current) => ({
                        ...current,
                        eventType: value as GreenMachineEventDraft["eventType"],
                      }))
                    }
                  >
                    <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taken">Taken</SelectItem>
                      <SelectItem value="transferred_to_inventory">Transferred to inventory</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="status_change">Status change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {eventDraft.eventType === "transferred_to_inventory" ? (
                  <div className="space-y-5">
                    <MachinePartPicker
                      parts={parts}
                      bins={bins}
                      models={models}
                      value={transferDraft.selectedPartId}
                      onChange={(part) =>
                        setTransferDraft(part ? createTransferDraftFromPart(part) : createBlankTransferDraft())
                      }
                    />

                    {selectedTransferPart && (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                        {getDisplayPartNumber(selectedTransferPart)} will be updated and the entered quantity
                        will be added to the current stock count.
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Part number</Label>
                        <Input
                          value={transferDraft.partNumber}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, partNumber: event.target.value }))
                          }
                          placeholder="FM1-D581"
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Part name</Label>
                        <Input
                          value={transferDraft.partName}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, partName: event.target.value }))
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
                          value={transferDraft.manufacturer}
                          onValueChange={(value) =>
                            setTransferDraft((current) => ({
                              ...current,
                              manufacturer: value ?? current.manufacturer,
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
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
                          value={transferDraft.category}
                          onValueChange={(value) =>
                            setTransferDraft((current) => ({
                              ...current,
                              category: value as MachineTransferDraft["category"],
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
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

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={transferDraft.quantityOnHand}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, quantityOnHand: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Reorder point</Label>
                        <Input
                          type="number"
                          min={0}
                          value={transferDraft.reorderPoint}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, reorderPoint: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Reorder target</Label>
                        <Input
                          type="number"
                          min={0}
                          value={transferDraft.reorderTarget}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, reorderTarget: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Storage bin</Label>
                        <Select
                          value={transferDraft.binId || "unassigned"}
                          onValueChange={(value) =>
                            setTransferDraft((current) => ({
                              ...current,
                              binId: value === "unassigned" ? "" : value ?? "",
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                            <SelectValue placeholder="Unassigned" />
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
                        <Label className="text-slate-200">Notes</Label>
                        <Textarea
                          value={transferDraft.notes}
                          onChange={(event) =>
                            setTransferDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          placeholder="Shelf notes, handling notes, or anything a tech needs to know."
                          className="min-h-32 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Compatible models</Label>
                        {transferDraft.compatibleModelIds.length > 0 && !transferDraft.universal && (
                          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                            {transferDraft.compatibleModelIds.map((modelId) => {
                              const model = models.find((item) => item.id === modelId);
                              if (!model) {
                                return null;
                              }

                              return (
                                <Badge key={model.id} className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                                  {model.manufacturer} {model.name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        <ModelFamilyPicker
                          models={models}
                          selectedModelIds={transferDraft.compatibleModelIds}
                          onSelectionChange={(nextIds) =>
                            setTransferDraft((current) => ({
                              ...current,
                              compatibleModelIds: nextIds,
                              universal: false,
                            }))
                          }
                          disabled={transferDraft.universal}
                          compact
                        />
                      </div>
                    </div>

                    <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={saveEvent}>
                      <Send className="mr-2 h-4 w-4" />
                      Transfer to inventory
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Part name</Label>
                        <Input
                          value={eventDraft.partName}
                          onChange={(event) =>
                            setEventDraft((current) => ({ ...current, partName: event.target.value }))
                          }
                          placeholder="Fuser sleeve"
                          className="h-12 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Part category</Label>
                        <Select
                          value={eventDraft.partCategory}
                          onValueChange={(value) =>
                            setEventDraft((current) => ({
                              ...current,
                              partCategory: value ?? current.partCategory,
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
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

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Condition</Label>
                        <Input
                          value={eventDraft.condition}
                          onChange={(event) =>
                            setEventDraft((current) => ({ ...current, condition: event.target.value }))
                          }
                          placeholder="Good / damaged / missing"
                          className="h-12 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Notes</Label>
                        <Textarea
                          value={eventDraft.note}
                          onChange={(event) =>
                            setEventDraft((current) => ({ ...current, note: event.target.value }))
                          }
                          placeholder="Add a short note about what happened."
                          className="min-h-32 border-white/10 bg-slate-950/70 text-white"
                        />
                      </div>
                    </div>

                    <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={saveEvent}>
                      <Send className="mr-2 h-4 w-4" />
                      Add event
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">Timeline</p>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {events.length} event{events.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <ScrollArea className="h-[24rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          {event.eventType.replace(/_/g, " ")}
                        </Badge>
                        {event.partCategory && (
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            {event.partCategory}
                          </Badge>
                        )}
                        {event.partName && (
                          <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                            {event.partName}
                          </Badge>
                        )}
                        {event.quantity !== null && (
                          <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                            Qty {event.quantity}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{event.note || "No note added."}</p>
                      {event.condition && (
                        <p className="mt-2 text-xs text-slate-500">Condition: {event.condition}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                      No events logged yet.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
