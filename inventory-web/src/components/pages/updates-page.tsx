"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { cn } from "@/lib/utils";
import type { ComingSoonItem, ComingSoonItemDraft, UpdateLog, UpdateLogDraft } from "@/lib/workspace-content-types";
import { formatDateTime, formatRelative } from "@/lib/inventory-utils";

function toDatetimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromDatetimeLocal(value: string) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function emptyUpdateDraft(): UpdateLogDraft {
  return {
    title: "",
    body: "",
    version: "",
    publishedAt: new Date().toISOString(),
    isPublished: true,
  };
}

function updateDraftFromLog(log: UpdateLog): UpdateLogDraft {
  return {
    title: log.title,
    body: log.body,
    version: log.version ?? "",
    publishedAt: log.publishedAt,
    isPublished: log.isPublished,
  };
}

function emptyComingSoonDraft(): ComingSoonItemDraft {
  return {
    title: "",
    description: "",
    status: "planned",
    targetDate: "",
    sortOrder: 0,
    isPublished: true,
  };
}

function comingSoonDraftFromItem(item: ComingSoonItem): ComingSoonItemDraft {
  return {
    title: item.title,
    description: item.description,
    status: item.status,
    targetDate: item.targetDate ?? "",
    sortOrder: item.sortOrder,
    isPublished: item.isPublished,
  };
}

export function UpdatesPage() {
  const { permissions, effectiveRole } = useAuth();
  const {
    updateLogs,
    comingSoonItems,
    publishedUpdateLogs,
    publishedComingSoonItems,
    unreadNotificationCount,
    saveUpdateLog,
    deleteUpdateLog,
    saveComingSoonItem,
    deleteComingSoonItem,
  } = useWorkspaceContent();

  const [selectedUpdateLogId, setSelectedUpdateLogId] = useState<string | null>(null);
  const [updateDraft, setUpdateDraft] = useState<UpdateLogDraft>(emptyUpdateDraft());
  const [selectedComingSoonId, setSelectedComingSoonId] = useState<string | null>(null);
  const [comingSoonDraft, setComingSoonDraft] = useState<ComingSoonItemDraft>(emptyComingSoonDraft());

  const updateCount = publishedUpdateLogs.length;
  const comingSoonCount = publishedComingSoonItems.length;

  const selectUpdateLog = (log: UpdateLog) => {
    setSelectedUpdateLogId(log.id);
    setUpdateDraft(updateDraftFromLog(log));
  };

  const selectComingSoonItem = (item: ComingSoonItem) => {
    setSelectedComingSoonId(item.id);
    setComingSoonDraft(comingSoonDraftFromItem(item));
  };

  const saveCurrentUpdateLog = () => {
    if (!updateDraft.title.trim() || !updateDraft.body.trim()) {
      toast.error("Add a title and body before saving the update log.");
      return;
    }

    const id = selectedUpdateLogId ?? crypto.randomUUID();
    saveUpdateLog({
      ...updateDraft,
      id,
      title: updateDraft.title.trim(),
      body: updateDraft.body.trim(),
      version: updateDraft.version.trim(),
      publishedAt: updateDraft.publishedAt,
      isPublished: updateDraft.isPublished,
    });
    setSelectedUpdateLogId(id);
    toast.success("Update log saved");
  };

  const saveCurrentComingSoon = () => {
    if (!comingSoonDraft.title.trim() || !comingSoonDraft.description.trim()) {
      toast.error("Add a title and description before saving the coming-soon item.");
      return;
    }

    const id = selectedComingSoonId ?? crypto.randomUUID();
    saveComingSoonItem({
      ...comingSoonDraft,
      id,
      title: comingSoonDraft.title.trim(),
      description: comingSoonDraft.description.trim(),
      targetDate: comingSoonDraft.targetDate,
      sortOrder: Number(comingSoonDraft.sortOrder) || 0,
      isPublished: comingSoonDraft.isPublished,
    });
    setSelectedComingSoonId(id);
    toast.success("Coming-soon item saved");
  };

  const removeUpdateLog = () => {
    if (!selectedUpdateLogId) {
      return;
    }

    if (!window.confirm("Delete this update log?")) {
      return;
    }

    deleteUpdateLog(selectedUpdateLogId);
    setSelectedUpdateLogId(null);
    toast.success("Update log deleted");
  };

  const removeComingSoonItem = () => {
    if (!selectedComingSoonId) {
      return;
    }

    if (!window.confirm("Delete this coming-soon item?")) {
      return;
    }

    deleteComingSoonItem(selectedComingSoonId);
    setSelectedComingSoonId(null);
    toast.success("Coming-soon item deleted");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Updates"
        title="Changelog and coming-soon work stay visible."
        description="Show the floor what shipped, what is still coming, and which fixes are already in motion."
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
              href="/forum"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Forum
            </Link>
            <Link
              href="/feature-requests"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              Feature requests
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Updates"
          value={updateCount}
          hint="Published release notes"
          icon={<RefreshCw className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Coming soon"
          value={comingSoonCount}
          hint="Published upcoming work"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Notifications"
          value={unreadNotificationCount}
          hint="Unread workspace updates"
          icon={<Bell className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Role"
          value={effectiveRole}
          hint="Current access"
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Release notes</CardTitle>
            <CardDescription className="text-slate-400">
              Published change logs and release notes for the floor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {publishedUpdateLogs.map((log) => (
              <div key={log.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {log.version ? `v${log.version}` : "No version"}
                  </Badge>
                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                    Published
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{log.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{log.body}</p>
                <p className="mt-3 text-xs text-slate-500">{formatDateTime(log.publishedAt)}</p>
              </div>
            ))}
            {publishedUpdateLogs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No release notes have been published yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Coming soon</CardTitle>
            <CardDescription className="text-slate-400">
              Planned work and items already moving through the pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {publishedComingSoonItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                    {item.status.replace(/_/g, " ")}
                  </Badge>
                  {item.targetDate && (
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {item.targetDate}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                <p className="mt-3 text-xs text-slate-500">{formatRelative(item.updatedAt)}</p>
              </div>
            ))}
            {publishedComingSoonItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No coming-soon items have been published yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {permissions.canAccessSettings && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Content management</CardTitle>
            <CardDescription className="text-slate-400">
              Add, edit, publish, or remove update entries and coming-soon items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="changelog" className="space-y-4">
              <TabsList className="grid h-auto grid-cols-2 bg-white/5 p-1">
                <TabsTrigger
                  value="changelog"
                  className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
                >
                  Changelog
                </TabsTrigger>
                <TabsTrigger
                  value="coming-soon"
                  className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
                >
                  Coming soon
                </TabsTrigger>
              </TabsList>

              <TabsContent value="changelog" className="space-y-4">
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <ScrollArea className="h-[32rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="space-y-3">
                      {updateLogs.map((log) => (
                        <button
                          key={log.id}
                          type="button"
                          onClick={() => selectUpdateLog(log)}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left transition-colors",
                            selectedUpdateLogId === log.id
                              ? "border-emerald-400/30 bg-emerald-400/10"
                              : "border-white/10 bg-slate-950/60 hover:bg-white/10",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-white/10 bg-white/5 text-slate-200">
                              {log.version ? `v${log.version}` : "No version"}
                            </Badge>
                            <Badge
                              className={
                                log.isPublished
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
                              }
                            >
                              {log.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">{log.title}</p>
                        </button>
                      ))}
                      {updateLogs.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                          No update logs yet.
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Title</Label>
                        <Input
                          value={updateDraft.title}
                          onChange={(event) =>
                            setUpdateDraft((current) => ({ ...current, title: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Version</Label>
                        <Input
                          value={updateDraft.version}
                          onChange={(event) =>
                            setUpdateDraft((current) => ({ ...current, version: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Published at</Label>
                        <Input
                          type="datetime-local"
                          value={toDatetimeLocalValue(updateDraft.publishedAt)}
                          onChange={(event) =>
                            setUpdateDraft((current) => ({
                              ...current,
                              publishedAt: toIsoFromDatetimeLocal(event.target.value),
                            }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Publish state</Label>
                        <Select
                          value={updateDraft.isPublished ? "published" : "draft"}
                          onValueChange={(value) =>
                            setUpdateDraft((current) => ({ ...current, isPublished: value === "published" }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Body</Label>
                      <Textarea
                        value={updateDraft.body}
                        onChange={(event) =>
                          setUpdateDraft((current) => ({ ...current, body: event.target.value }))
                        }
                        className="min-h-40 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={saveCurrentUpdateLog}
                      >
                        Save changelog entry
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          setSelectedUpdateLogId(null);
                          setUpdateDraft(emptyUpdateDraft());
                        }}
                      >
                        New entry
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={removeUpdateLog}
                        disabled={!selectedUpdateLogId}
                      >
                        Delete entry
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="coming-soon" className="space-y-4">
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <ScrollArea className="h-[32rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="space-y-3">
                      {comingSoonItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectComingSoonItem(item)}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left transition-colors",
                            selectedComingSoonId === item.id
                              ? "border-emerald-400/30 bg-emerald-400/10"
                              : "border-white/10 bg-slate-950/60 hover:bg-white/10",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-white/10 bg-white/5 text-slate-200">
                              {item.status.replace(/_/g, " ")}
                            </Badge>
                            <Badge
                              className={
                                item.isPublished
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
                              }
                            >
                              {item.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                        </button>
                      ))}
                      {comingSoonItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                          No coming-soon items yet.
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Title</Label>
                        <Input
                          value={comingSoonDraft.title}
                          onChange={(event) =>
                            setComingSoonDraft((current) => ({ ...current, title: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Target date</Label>
                        <Input
                          type="date"
                          value={comingSoonDraft.targetDate}
                          onChange={(event) =>
                            setComingSoonDraft((current) => ({ ...current, targetDate: event.target.value }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-200">Sort order</Label>
                        <Input
                          type="number"
                          value={comingSoonDraft.sortOrder}
                          onChange={(event) =>
                            setComingSoonDraft((current) => ({
                              ...current,
                              sortOrder: Number(event.target.value) || 0,
                            }))
                          }
                          className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Publish state</Label>
                        <Select
                          value={comingSoonDraft.isPublished ? "published" : "draft"}
                          onValueChange={(value) =>
                            setComingSoonDraft((current) => ({ ...current, isPublished: value === "published" }))
                          }
                        >
                          <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Status</Label>
                      <Select
                        value={comingSoonDraft.status}
                        onValueChange={(value) =>
                          setComingSoonDraft((current) => ({
                            ...current,
                            status: value as ComingSoonItemDraft["status"],
                          }))
                        }
                      >
                        <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
                          <SelectItem value="released">Released</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Description</Label>
                      <Textarea
                        value={comingSoonDraft.description}
                        onChange={(event) =>
                          setComingSoonDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        className="min-h-40 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={saveCurrentComingSoon}
                      >
                        Save coming-soon item
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          setSelectedComingSoonId(null);
                          setComingSoonDraft(emptyComingSoonDraft());
                        }}
                      >
                        New item
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={removeComingSoonItem}
                        disabled={!selectedComingSoonId}
                      >
                        Delete item
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
