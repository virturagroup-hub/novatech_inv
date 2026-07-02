"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Lock, Pin, Plus, Send, ShieldAlert, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
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

export function FeatureRequestsPage({
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
    getThreadPosts,
    getFeatureRequestScore,
    saveForumThread,
    addForumPost,
    voteFeatureRequest,
    setForumThreadStatus,
    setForumThreadPinned,
    setForumThreadLocked,
  } = useWorkspaceContent();

  const [requestTitle, setRequestTitle] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(searchParams?.threadId ?? null);

  const requestThreads = useMemo(
    () => forumThreads.filter((thread) => thread.type === "feature_request"),
    [forumThreads],
  );
  const visibleRequestThreads = useMemo(
    () => requestThreads.filter((thread) => !isArchivedOrDeletedThreadStatus(thread.status)),
    [requestThreads],
  );
  const archivedRequestThreads = useMemo(
    () => requestThreads.filter((thread) => isArchivedOrDeletedThreadStatus(thread.status)),
    [requestThreads],
  );
  const selectableRequestThreads = useMemo(
    () =>
      effectiveRole === "admin"
        ? [...visibleRequestThreads, ...archivedRequestThreads]
        : visibleRequestThreads,
    [archivedRequestThreads, effectiveRole, visibleRequestThreads],
  );

  const selectedThread = useMemo(() => {
    if (selectedThreadId) {
      return selectableRequestThreads.find((thread) => thread.id === selectedThreadId) ?? null;
    }

    return visibleRequestThreads[0] ?? null;
  }, [selectedThreadId, selectableRequestThreads, visibleRequestThreads]);

  const selectedThreadPosts = selectedThread ? getThreadPosts(selectedThread.id) : [];
  const activeRequestCount = visibleRequestThreads.filter(
    (thread) => thread.status === "open" || thread.status === "under_review",
  ).length;
  const totalVotes = visibleRequestThreads.reduce((sum, thread) => sum + getFeatureRequestScore(thread.id), 0);
  const replyCount = useMemo(
    () =>
      forumPosts.filter((post) => visibleRequestThreads.some((thread) => thread.id === post.threadId)).length,
    [forumPosts, visibleRequestThreads],
  );
  const selectedThreadEditable = Boolean(selectedThread && !isArchivedOrDeletedThreadStatus(selectedThread.status));

  const submitRequest = () => {
    if (!requestTitle.trim() || !requestBody.trim()) {
      toast.error("Add a title and details before submitting a feature request.");
      return;
    }

    const threadId = saveForumThread({
      title: requestTitle.trim(),
      body: requestBody.trim(),
      type: "feature_request",
      status: "open",
    });

    setRequestTitle("");
    setRequestBody("");
    setSelectedThreadId(threadId);
    toast.success("Feature request submitted");
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

    if (selectedThread.status === nextStatus) {
      return;
    }

    if (nextStatus === "archived" || nextStatus === "deleted") {
      const action = nextStatus === "archived" ? "Archive" : "Delete";

      if (
        !window.confirm(
          `${action} this feature request? It will be hidden from non-admins and purged after 30 days.`,
        )
      ) {
        return;
      }
    }

    setForumThreadStatus(selectedThread.id, nextStatus);
    toast.success("Feature request status updated");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Feature requests"
        title="Ideas get their own lane and a clear status."
        description="Capture product improvements here, vote on what matters, and show the team what is new, under review, or planned."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Requests"
          value={visibleRequestThreads.length}
          hint="Submitted ideas"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Active"
          value={activeRequestCount}
          hint="New or under review"
          icon={<Send className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Votes"
          value={totalVotes}
          hint="Total score across requests"
          icon={<ThumbsUp className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Replies"
          value={replyCount}
          hint="Comments in the request threads"
          icon={<Send className="h-5 w-5" />}
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
            <CardTitle className="text-white">Submit feature request</CardTitle>
            <CardDescription className="text-slate-400">
              Share a workflow improvement, then vote on the requests the crew should tackle next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Title</Label>
              <Input
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="Add a thermal label mode for single parts"
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Details</Label>
              <Textarea
                value={requestBody}
                onChange={(event) => setRequestBody(event.target.value)}
                placeholder="Explain the problem and how the new workflow would help."
                className="min-h-32 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={submitRequest}
              disabled={!permissions.canCreateFeatureRequests}
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit feature request
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Request detail</CardTitle>
            <CardDescription className="text-slate-400">
              Review the latest discussion, vote on it, and move the status forward.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedThread ? (
              <>
                <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                      {getFeatureRequestScore(selectedThread.id)} votes
                    </Badge>
                    <Badge className={cn("border", getThreadStatusBadgeClass(selectedThread.status))}>
                      {formatThreadStatusLabel(selectedThread.status, "feature_request")}
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
                    <SelectTrigger className="h-10 w-[190px] border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">New</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      {effectiveRole === "admin" && (
                        <>
                          <SelectItem value="archived">Archived</SelectItem>
                          <SelectItem value="deleted">Deleted</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => voteFeatureRequest(selectedThread.id, 1)}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Upvote
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => voteFeatureRequest(selectedThread.id, -1)}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    Downvote
                  </Button>
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
                    placeholder="Add the next update for the team."
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
                No feature requests yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Feature request board</CardTitle>
          <CardDescription className="text-slate-400">
            Open a request to review the details, vote, and jump to the reply thread.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[24rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {visibleRequestThreads.map((thread) => (
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
                    <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                      {getFeatureRequestScore(thread.id)} votes
                    </Badge>
                    <Badge className={cn("border", getThreadStatusBadgeClass(thread.status))}>
                      {formatThreadStatusLabel(thread.status, "feature_request")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                </button>
              ))}
              {visibleRequestThreads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No feature requests yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {effectiveRole === "admin" && archivedRequestThreads.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Archived and deleted requests</CardTitle>
            <CardDescription className="text-slate-400">
              Review hidden requests before they purge automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[20rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {archivedRequestThreads.map((thread) => (
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
                      <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                        {getFeatureRequestScore(thread.id)} votes
                      </Badge>
                      <Badge className={cn("border", getThreadStatusBadgeClass(thread.status))}>
                        {formatThreadStatusLabel(thread.status, "feature_request")}
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
