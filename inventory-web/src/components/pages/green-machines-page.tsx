"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, Bike, CheckCircle2, Plus, Printer, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { MachineModelPicker } from "@/components/machine-model-picker";
import { useInventory } from "@/components/inventory-provider";
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
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { cn } from "@/lib/utils";
import { buildMachinePrintHref } from "@/lib/labels";
import { formatRelative } from "@/lib/inventory-utils";
import { getModelDisplayName } from "@/lib/model-search";
import type { DeviceModel } from "@/lib/inventory-types";
import type { GreenMachineDraft } from "@/lib/workspace-content-types";

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

function createEmptyMachineDraft(): GreenMachineDraft {
  return {
    modelId: null,
    modelName: "",
    seriesFamily: "",
    serialNumber: "",
    locationId: null,
    status: "active",
    notes: "",
  };
}

export function GreenMachinesPage() {
  const router = useRouter();
  const { permissions } = useAuth();
  const { bins, models } = useInventory();
  const { greenMachines, greenMachineEventsFor, saveGreenMachine, archiveGreenMachine } =
    useWorkspaceContent();
  const [draft, setDraft] = useState<GreenMachineDraft>(() => createEmptyMachineDraft());
  const canManageGreenMachines = permissions.canManageGreenMachines;

  const activeMachines = greenMachines.filter((machine) => machine.status !== "archived").length;
  const archivedMachines = greenMachines.filter((machine) => machine.status === "archived").length;
  const strippedMachines = greenMachines.filter(
    (machine) => machine.status === "partially_stripped" || machine.status === "depleted",
  ).length;
  const totalEvents = greenMachines.reduce((sum, machine) => sum + greenMachineEventsFor(machine.id).length, 0);

  const locationOptions = useMemo(
    () => [...bins].sort((left, right) => left.code.localeCompare(right.code)),
    [bins],
  );

  const handleModelChange = (model: DeviceModel | null) => {
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
        modelName: getModelDisplayName(model),
        seriesFamily: model.series.trim() || current.seriesFamily,
      };
    });
  };

  const saveMachine = () => {
    if (!canManageGreenMachines) {
      return;
    }

    if (!draft.modelName.trim() || !draft.seriesFamily.trim()) {
      toast.error("Add a model name and series/family before saving the machine.");
      return;
    }

    const machineId = saveGreenMachine({
      ...draft,
      modelName: draft.modelName.trim(),
      seriesFamily: draft.seriesFamily.trim(),
      serialNumber: draft.serialNumber.trim(),
      notes: draft.notes.trim(),
    });

    toast.success("Machine saved");
    setDraft(createEmptyMachineDraft());

    router.push(`/green-machines/${machineId}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Machines"
        title="Track stripped machines, pull reusable parts, and keep the fleet moving."
        description="This workspace gives each machine a QR-linked record, a teardown timeline, and a clean place to log parts removed from the chassis."
        actions={
          <>
            <Link
              href="/support"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Support
            </Link>
            <Link
              href="/notifications"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Notifications
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active"
          value={activeMachines}
          hint="Machines still in play"
          icon={<Bike className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Stripped"
          value={strippedMachines}
          hint="Partially stripped or depleted"
          icon={<Wrench className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Archived"
          value={archivedMachines}
          hint="Out of service records"
          icon={<Archive className="h-5 w-5" />}
          tone="rose"
        />
        <StatCard
          label="Events"
          value={totalEvents}
          hint="Timeline entries logged"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {canManageGreenMachines ? (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">New machine</CardTitle>
              <CardDescription className="text-slate-400">
                Add a stripped or salvage machine, then open the detail page to log each pull.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    onChange={(event) => setDraft((current) => ({ ...current, modelName: event.target.value }))}
                    placeholder="imageRUNNER ADVANCE DX C5840"
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Series / family</Label>
                  <Input
                    value={draft.seriesFamily}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, seriesFamily: event.target.value }))
                    }
                    placeholder="C5800"
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Serial number</Label>
                  <Input
                    value={draft.serialNumber}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, serialNumber: event.target.value }))
                    }
                    placeholder="Optional"
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Location</Label>
                  <Select
                    value={draft.locationId ?? "unassigned"}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        locationId: value === "unassigned" ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {locationOptions.map((bin) => (
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
                      setDraft((current) => ({
                        ...current,
                        status: value as GreenMachineDraft["status"],
                      }))
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
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="What has been removed already, what still remains, and anything else the next tech needs to know."
                    className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={saveMachine}
              >
                <Plus className="mr-2 h-4 w-4" />
                Save machine
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Machine intake</CardTitle>
              <CardDescription className="text-slate-400">
                Managers create and update machine records from here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">Read only</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Open any machine in the index to review its QR record and timeline.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Machine index</CardTitle>
            <CardDescription className="text-slate-400">
              Open a detail page for QR scanning, timeline review, and event logging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[36rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {greenMachines.map((machine) => {
                  const latestEvent = greenMachineEventsFor(machine.id)[0];
                  const location = machine.locationId
                    ? bins.find((bin) => bin.id === machine.locationId) ?? null
                    : null;

                  return (
                    <div
                      key={machine.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("border", statusTone(machine.status))}>
                              {statusLabel(machine.status)}
                            </Badge>
                            {machine.serialNumber && (
                              <Badge className="border-white/10 bg-white/5 text-slate-200">
                                SN {machine.serialNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white">{machine.modelName}</p>
                          <p className="text-sm text-slate-300">
                            {machine.seriesFamily}
                            {location ? ` · ${location.code} · ${location.name}` : " · Unassigned"}
                          </p>
                          {latestEvent && (
                            <p className="text-xs text-slate-400">
                              Latest event: {latestEvent.eventType.replace(/_/g, " ")} · {formatRelative(latestEvent.createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/green-machines/${machine.id}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "default" }),
                              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            Open
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                          {permissions.canManageGreenMachines && (
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
                          )}
                          {permissions.canManageGreenMachines && machine.status !== "archived" && (
                            <Button
                              variant="outline"
                              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                              onClick={() => {
                                archiveGreenMachine(machine.id);
                                toast.success("Machine archived");
                              }}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {greenMachines.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    No machines yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
