"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bell, Lock, MessageSquareMore, Pin, Plus, Send, ShieldAlert } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { cn } from "@/lib/utils";
import type { ForumThreadStatus } from "@/lib/workspace-content-types";
import { getForumThreadArchiveRetentionLabel } from "@/lib/workspace-thread-retention";
import { isArchivedOrDeletedThreadStatus } from "@/lib/workspace-thread-utils";
import { formatThreadStatusLabel, getThreadStatusBadgeClass } from "@/lib/workspace-thread-utils";

export function ForumPage({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  const { permissions, effectiveRole } = useAuth();
  const {
    forumThreads,
    forumPosts,
    unreadNotificationCount,
    getThreadPosts,
    saveForumThread,
    addForumPost,
    setForumThreadStatus,
    setForumThreadPinned,
    setForumThreadLocked,
  } = useWorkspaceContent();

  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(searchParams?.threadId ?? null);

  const discussionThreads = useMemo(
    () => forumThreads.filter((thread) => thread.type === "general"),
    [forumThreads],
  );
  const visibleDiscussionThreads = useMemo(
    () => discussionThreads.filter((thread) => !isArchivedOrDeletedThreadStatus(thread.status)),
    [discussionThreads],
  );
  const archivedDiscussionThreads = useMemo(
    () => discussionThreads.filter((thread) => isArchivedOrDeletedThreadStatus(thread.status)),
    [discussionThreads],
  );
  const selectableDiscussionThreads = useMemo(
    () =>
      effectiveRole === "admin"
        ? [...visibleDiscussionThreads, ...archivedDiscussionThreads]
        : visibleDiscussionThreads,
    [archivedDiscussionThreads, effectiveRole, visibleDiscussionThreads],
  );

  const selectedThread = useMemo(() => {
    if (selectedThreadId) {
      return selectableDiscussionThreads.find((thread) => thread.id === selectedThreadId) ?? null;
    }

    return visibleDiscussionThreads[0] ?? null;
  }, [selectedThreadId, selectableDiscussionThreads, visibleDiscussionThreads]);

  const selectedThreadPosts = selectedThread ? getThreadPosts(selectedThread.id) : [];
  const replyCount = useMemo(
    () =>
      forumPosts.filter((post) => visibleDiscussionThreads.some((thread) => thread.id === post.threadId)).length,
    [forumPosts, visibleDiscussionThreads],
  );
  const selectedThreadEditable = Boolean(selectedThread && !isArchivedOrDeletedThreadStatus(selectedThread.status));

  const submitThread = () => {
    if (!threadTitle.trim() || !threadBody.trim()) {
      toast.error("Add a title and details before posting a discussion.");
      return;
    }

    const threadId = saveForumThread({
      title: threadTitle.trim(),
      body: threadBody.trim(),
      type: "general",
      status: "open",
    });

    setThreadTitle("");
    setThreadBody("");
    setSelectedThreadId(threadId);
    toast.success("Discussion posted");
  };

  const submitReply = () => {
    if (!selectedThread || !replyBody.trim() || !selectedThreadEditable) {
      toast.error("Write a reply before sending it.");
      return;
    }

    addForumPost(selectedThread.id, {
      body: replyBody.trim(),
    });
    setReplyBody("");
    toast.success("Reply posted");
  };

  const submitStatus = (nextStatus: ForumThreadStatus) => {
    if (!selectedThread || !permissions.canModerateSupport) {
      return;
    }

    setForumThreadStatus(selectedThread.id, nextStatus);
    toast.success("Thread status updated");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Forum"
        title="Technical discussion stays separate from support."
        description="Use the forum for parts, machines, bins, model questions, and teardown notes that help the crew work faster."
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
              href="/feature-requests"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Feature requests
            </Link>
            <Link
              href="/updates"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              Updates
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Threads"
          value={visibleDiscussionThreads.length}
          hint="General discussions"
          icon={<MessageSquareMore className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Replies"
          value={replyCount}
          hint="Comments across the forum"
          icon={<Send className="h-5 w-5" />}
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Start a discussion</CardTitle>
            <CardDescription className="text-slate-400">
              Ask about parts, machines, bins, models, or teardown notes that should be shared with the floor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Title</Label>
              <Input
                value={threadTitle}
                onChange={(event) => setThreadTitle(event.target.value)}
                placeholder="Example: Best notes format for stripped machines"
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Details</Label>
              <Textarea
                value={threadBody}
                onChange={(event) => setThreadBody(event.target.value)}
                placeholder="Describe the question, the part, or the workflow tip you want the team to weigh in on."
                className="min-h-32 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={submitThread}
              disabled={!permissions.canAccessSupport}
            >
              <Plus className="mr-2 h-4 w-4" />
              Post discussion
            </Button>
          </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">
              {permissions.canModerateSupport ? "Forum moderation" : "Discussion detail"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Open a thread to review replies and keep the conversation tidy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedThread ? (
              <>
                <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Forum</Badge>
                    <Badge className={cn("border", getThreadStatusBadgeClass(selectedThread.status))}>
                      {formatThreadStatusLabel(selectedThread.status, "forum")}
                    </Badge>
                    {selectedThread.isPinned && (
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">Pinned</Badge>
                    )}
                    {selectedThread.isLocked && (
                      <Badge className="border-rose-400/20 bg-rose-400/10 text-rose-100">Locked</Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{selectedThread.title}</p>
                  <p className="text-sm leading-6 text-slate-300">{selectedThread.body}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {permissions.canModerateSupport && (
                    <>
                      <Button
                        variant="outline"
                        className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => setForumThreadPinned(selectedThread.id, !selectedThread.isPinned)}
                      >
                        <Pin className="mr-2 h-4 w-4" />
                        {selectedThread.isPinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => setForumThreadLocked(selectedThread.id, !selectedThread.isLocked)}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {selectedThread.isLocked ? "Unlock" : "Lock"}
                      </Button>
                    </>
                  )}
                  <Select
                    value={selectedThread.status}
                    onValueChange={(value) => submitStatus(value as ForumThreadStatus)}
                    disabled={!permissions.canModerateSupport}
                  >
                    <SelectTrigger className="h-10 w-[180px] border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      {effectiveRole === "admin" && (
                        <>
                          <SelectItem value="archived">Archived</SelectItem>
                          <SelectItem value="deleted">Deleted</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-72 rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="space-y-3">
                    {selectedThreadPosts.map((post) => (
                      <div key={post.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-sm leading-6 text-slate-200">{post.body}</p>
                      </div>
                    ))}
                    {selectedThreadPosts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                        No replies yet.
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="space-y-2">
                  <Label className="text-slate-200">Reply</Label>
                  <Textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Add a clarification or a helpful answer."
                    className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    disabled={selectedThread.isLocked || !selectedThreadEditable}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      onClick={submitReply}
                      disabled={selectedThread.isLocked || !selectedThreadEditable}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Post reply
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      onClick={() => setReplyBody("")}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No discussion threads yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Forum threads</CardTitle>
          <CardDescription className="text-slate-400">
            Jump straight to a discussion without scrolling back through the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[24rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {visibleDiscussionThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-colors",
                    selectedThread?.id === thread.id
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/60 hover:bg-white/10",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Forum</Badge>
                    <Badge className={cn("border", getThreadStatusBadgeClass(thread.status))}>
                      {formatThreadStatusLabel(thread.status, "forum")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                </button>
              ))}
              {visibleDiscussionThreads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No forum threads yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {effectiveRole === "admin" && archivedDiscussionThreads.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Archived and deleted forum</CardTitle>
            <CardDescription className="text-slate-400">
              Review hidden discussions before they purge automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[20rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {archivedDiscussionThreads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-colors",
                      selectedThread?.id === thread.id
                        ? "border-emerald-400/30 bg-emerald-400/10"
                        : "border-white/10 bg-slate-950/60 hover:bg-white/10",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">Forum</Badge>
                      <Badge className={cn("border", getThreadStatusBadgeClass(thread.status))}>
                        {formatThreadStatusLabel(thread.status, "forum")}
                      </Badge>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {getForumThreadArchiveRetentionLabel(thread) ?? "Archived"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
