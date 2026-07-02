"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Lock,
  MessageSquareMore,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
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

function formatThreadType(type: "support" | "general" | "feature_request") {
  switch (type) {
    case "support":
      return "Support";
    case "feature_request":
      return "Feature request";
    default:
      return "Forum";
  }
}

function statusTone(status: string) {
  switch (status) {
    case "planned":
    case "in_progress":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "completed":
    case "released":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "rejected":
    case "closed":
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  }
}

export function SupportHubPage({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  const { permissions, effectiveRole } = useAuth();
  const {
    publishedFaqs,
    publishedComingSoonItems,
    publishedUpdateLogs,
    visibleSops,
    supportThreads,
    featureRequests,
    unreadNotificationCount,
    getThreadById,
    getThreadPosts,
    getFeatureRequestScore,
    saveForumThread,
    addForumPost,
    voteFeatureRequest,
    setForumThreadStatus,
    setForumThreadPinned,
    setForumThreadLocked,
  } = useWorkspaceContent();

  const [supportTitle, setSupportTitle] = useState("");
  const [supportBody, setSupportBody] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureBody, setFeatureBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(searchParams?.threadId ?? null);

  const selectedThread = useMemo(() => {
    if (selectedThreadId) {
      return getThreadById(selectedThreadId);
    }

    return supportThreads[0] ?? featureRequests[0] ?? null;
  }, [featureRequests, getThreadById, selectedThreadId, supportThreads]);

  const selectedThreadPosts = selectedThread ? getThreadPosts(selectedThread.id) : [];

  const openSupportCount = supportThreads.filter((thread) => thread.status === "open").length;
  const openFeatureCount = featureRequests.filter((thread) => thread.status !== "completed").length;

  const submitSupportRequest = () => {
    if (!supportTitle.trim() || !supportBody.trim()) {
      toast.error("Add a title and details before submitting a support request.");
      return;
    }

    const threadId = saveForumThread({
      title: supportTitle.trim(),
      body: supportBody.trim(),
      type: "support",
      status: "open",
    });

    setSupportTitle("");
    setSupportBody("");
    toast.success("Support request submitted");
    setSelectedThreadId(threadId);
  };

  const submitFeatureRequest = () => {
    if (!featureTitle.trim() || !featureBody.trim()) {
      toast.error("Add a title and details before submitting a feature request.");
      return;
    }

    const threadId = saveForumThread({
      title: featureTitle.trim(),
      body: featureBody.trim(),
      type: "feature_request",
      status: "open",
    });

    setFeatureTitle("");
    setFeatureBody("");
    toast.success("Feature request submitted");
    setSelectedThreadId(threadId);
  };

  const submitReply = () => {
    if (!selectedThread || !replyBody.trim()) {
      toast.error("Write a reply before sending it.");
      return;
    }

    addForumPost(selectedThread.id, {
      body: replyBody.trim(),
      taggedTarget: selectedThread.type === "feature_request" ? "thread_creator" : null,
    });
    setReplyBody("");
    toast.success("Reply posted");
  };

  const submitStatus = (nextStatus: string) => {
    if (!selectedThread || !permissions.canModerateSupport) {
      return;
    }

    setForumThreadStatus(selectedThread.id, nextStatus as typeof selectedThread.status);
    toast.success("Thread status updated");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Support hub"
        title="Keep support requests, ideas, and reference notes in one place."
        description="Use the hub to submit requests, follow replies, and keep SOPs and updates close by."
        actions={
          <>
            <Link
              href="/notifications"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </Link>
            <Link
              href="/green-machines"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Green Machines
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Support"
          value={openSupportCount}
          hint="Open requests"
          icon={<MessageSquareMore className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Feature requests"
          value={openFeatureCount}
          hint="Waiting on action"
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Submit support</CardTitle>
            <CardDescription className="text-slate-400">
              Open a support request for a floor issue and track it from the detail panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Title</Label>
                <Input
                  value={supportTitle}
                  onChange={(event) => setSupportTitle(event.target.value)}
                  placeholder="Example: C5840 fuser sleeve missing"
                  className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Body</Label>
                <Textarea
                  value={supportBody}
                  onChange={(event) => setSupportBody(event.target.value)}
                  placeholder="Include model, machine location, and the next step you need."
                  className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={submitSupportRequest}
              disabled={!permissions.canCreateSupportRequests}
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit support request
            </Button>
            {!permissions.canCreateSupportRequests && (
              <p className="text-sm text-slate-400">
                Your current role can read support content, but not open new requests.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Thread detail</CardTitle>
          <CardDescription className="text-slate-400">
              Open a thread from the list to review replies and status.
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedThread ? (
              <>
                <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {formatThreadType(selectedThread.type)}
                    </Badge>
                    <Badge className={cn("border", statusTone(selectedThread.status))}>
                      {selectedThread.status}
                    </Badge>
                    {selectedThread.isPinned && (
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                        Pinned
                      </Badge>
                    )}
                    {selectedThread.isLocked && (
                      <Badge className="border-rose-400/20 bg-rose-400/10 text-rose-100">
                        Locked
                      </Badge>
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
                    onValueChange={(value) => submitStatus(value ?? selectedThread.status)}
                    disabled={!permissions.canModerateSupport}
                  >
                    <SelectTrigger className="h-10 w-[180px] border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-72 rounded-3xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="space-y-3">
                    {selectedThreadPosts.map((post) => (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            Reply
                          </Badge>
                          {post.taggedTarget && (
                            <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                              {post.taggedTarget}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-200">{post.body}</p>
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
                    placeholder="Add the next update or the answer for the team."
                    className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    disabled={selectedThread.isLocked}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      onClick={submitReply}
                      disabled={selectedThread.isLocked}
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
                No thread selected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Thread index</CardTitle>
          <CardDescription className="text-slate-400">
            Jump to any request without leaving the hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <ScrollArea className="h-[22rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {supportThreads.map((thread) => (
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
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Support</Badge>
                    <Badge className={cn("border", statusTone(thread.status))}>{thread.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                </button>
              ))}
              {supportThreads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No support threads yet.
                </div>
              )}
            </div>
          </ScrollArea>

          <ScrollArea className="h-[22rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {featureRequests.map((thread) => (
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
                    <Badge className={cn("border", statusTone(thread.status))}>{thread.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                </button>
              ))}
              {featureRequests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No feature requests yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Feature requests</CardTitle>
          <CardDescription className="text-slate-400">
            Capture ideas from the floor and vote on the ones that should move next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">New request</p>
              <Input
                value={featureTitle}
                onChange={(event) => setFeatureTitle(event.target.value)}
                placeholder="Add a thermal label mode"
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
              <Textarea
                value={featureBody}
                onChange={(event) => setFeatureBody(event.target.value)}
                placeholder="Explain the problem and the workflow improvement you want."
                className="min-h-28 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={submitFeatureRequest}
                disabled={!permissions.canCreateFeatureRequests}
              >
                <Plus className="mr-2 h-4 w-4" />
                Submit feature request
              </Button>
            </div>

            <ScrollArea className="h-[26rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {featureRequests.map((thread) => (
                  <div
                    key={thread.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                            {getFeatureRequestScore(thread.id)} votes
                          </Badge>
                          <Badge className={cn("border", statusTone(thread.status))}>
                            {thread.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{thread.body}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => voteFeatureRequest(thread.id, 1)}
                        >
                          <ThumbsUp className="mr-2 h-4 w-4" />
                          Upvote
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => voteFeatureRequest(thread.id, -1)}
                        >
                          <ThumbsDown className="mr-2 h-4 w-4" />
                          Downvote
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {featureRequests.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    No feature requests yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Reference content</CardTitle>
          <CardDescription className="text-slate-400">
            FAQs, update notes, coming-soon items, and SOPs for the floor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ResourceStack
            title="FAQs"
            icon={<BookOpen className="h-4 w-4" />}
            items={publishedFaqs.map((item) => `${item.question}`)}
          />
          <ResourceStack
            title="Update logs"
            icon={<RefreshCw className="h-4 w-4" />}
            items={publishedUpdateLogs.map((item) => `${item.title}`)}
          />
          <ResourceStack
            title="Coming soon"
            icon={<Sparkles className="h-4 w-4" />}
            items={publishedComingSoonItems.map((item) => `${item.title}`)}
          />
          <ResourceStack
            title="SOPs"
            icon={<CheckCircle2 className="h-4 w-4" />}
            items={visibleSops.map((item) => `${item.title}`)}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Notifications have their own inbox.</p>
            <p className="text-sm text-slate-400">
              Open the notification center to mark messages as read or jump into the related thread.
            </p>
          </div>
          <Link
            href="/notifications"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
            )}
          >
            Open notifications
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceStack({
  title,
  icon,
  items,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  items: string[];
}>) {
  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">{icon}</span>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <div className="space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200">
            {item}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
            Nothing published yet.
          </div>
        )}
      </div>
    </div>
  );
}
