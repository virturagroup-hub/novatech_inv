"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Camera, CheckCircle2, MapPin, Save, Send, Sparkles, Wrench } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildAbsoluteAppUrl } from "@/lib/navigation";
import { formatDateTime, formatRelative } from "@/lib/inventory-utils";
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

export function GreenMachineDetailPage({ machineId }: Readonly<{ machineId: string }>) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { bins, getBinById, getDisplayPartNumber, parts } = useInventory();
  const {
    getGreenMachineById,
    greenMachineEventsFor,
    saveGreenMachine,
    archiveGreenMachine,
    addGreenMachineEvent,
  } = useWorkspaceContent();

  const machine = getGreenMachineById(machineId);
  const [draft, setDraft] = useState<GreenMachineDraft | null>(null);
  const [eventDraft, setEventDraft] = useState<GreenMachineEventDraft>({
    eventType: "taken",
    partId: null,
    partName: "",
    quantity: "1",
    condition: "",
    note: "",
  });

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
    });
  }, [machine]);

  const location = useMemo(() => (machine ? getBinById(machine.locationId ?? "") : null), [getBinById, machine]);
  const events = machine ? greenMachineEventsFor(machine.id) : [];

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
                  The Green Machine record is not available in the current workspace.
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
              Back to Green Machines
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventCount = events.length;
  const pulledCount = events.filter((event) => event.eventType === "taken" || event.eventType === "transferred_to_inventory").length;
  const qrValue = buildAbsoluteAppUrl(`/green-machines/${machine.id}`);

  const saveMachine = () => {
    if (!draft) return;
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

  const saveEvent = () => {
    addGreenMachineEvent(machine.id, {
      ...eventDraft,
      partName: eventDraft.partName.trim(),
      note: eventDraft.note.trim(),
      condition: eventDraft.condition.trim(),
    });
    setEventDraft({
      eventType: "taken",
      partId: null,
      partName: "",
      quantity: "1",
      condition: "",
      note: "",
    });
    toast.success("Event added");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Green Machine detail"
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
            {permissions.canManageGreenMachines && machine.status !== "archived" && (
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  archiveGreenMachine(machine.id);
                  toast.success("Machine archived");
                  router.refresh();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
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
          hint="Current machine state"
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
                  disabled={!permissions.canManageGreenMachines}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save machine
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">QR and timeline</CardTitle>
            <CardDescription className="text-slate-400">
              The QR code opens this machine record, and the timeline records every pull.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <QRCodeSVG
                  value={qrValue}
                  includeMargin
                  size={128}
                  className="w-full rounded-2xl bg-white p-2"
                />
              </div>
              <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border", statusTone(machine.status))}>
                    {statusLabel(machine.status)}
                  </Badge>
                  {location && (
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {location.code} · {location.name}
                    </Badge>
                  )}
                  {machine.modelId && (
                    <Badge className="border-slate-500/30 bg-slate-900/60 text-slate-200">
                      {machine.modelName}
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-6 text-slate-300">{machine.notes || "No machine notes yet."}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Log an event</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Event type</Label>
                  <Select
                    value={eventDraft.eventType}
                    onValueChange={(value) =>
                      setEventDraft((current) => ({ ...current, eventType: value as GreenMachineEventDraft["eventType"] }))
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
                <div className="space-y-2">
                  <Label className="text-slate-200">Part</Label>
                  <Select
                    value={eventDraft.partId ?? "manual"}
                    onValueChange={(value) => {
                      const part = parts.find((item) => item.id === value) ?? null;
                      setEventDraft((current) => ({
                        ...current,
                        partId: value === "manual" ? null : value,
                        partName: part ? getDisplayPartNumber(part) : current.partName,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Manual entry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual entry</SelectItem>
                      {parts.map((part) => (
                        <SelectItem key={part.id} value={part.id}>
                          {getDisplayPartNumber(part)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
                  <Label className="text-slate-200">Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={eventDraft.quantity}
                    onChange={(event) =>
                      setEventDraft((current) => ({ ...current, quantity: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-slate-950/70 text-white"
                  />
                </div>
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
              </div>

              <Textarea
                value={eventDraft.note}
                onChange={(event) => setEventDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="Add a short note about what happened."
                className="min-h-28 border-white/10 bg-slate-950/70 text-white"
              />

              <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={saveEvent}>
                <Send className="mr-2 h-4 w-4" />
                Add event
              </Button>
            </div>

            <ScrollArea className="h-[24rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {event.eventType.replace(/_/g, " ")}
                      </Badge>
                      {event.partName && (
                        <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                          {event.partName}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{event.note || "No note added."}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    No events logged yet.
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
