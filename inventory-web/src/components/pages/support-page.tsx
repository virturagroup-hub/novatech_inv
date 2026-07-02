"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bell, BookOpen, Lock, MessageSquareMore, Pin, Plus, Send, ShieldAlert } from "lucide-react";
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
import type { Faq, FaqDraft, ForumThreadStatus } from "@/lib/workspace-content-types";
import { formatThreadStatusLabel, getThreadStatusBadgeClass } from "@/lib/workspace-thread-utils";

function emptyFaqDraft(): FaqDraft {
  return {
    question: "",
    answer: "",
    category: "General",
    sortOrder: 0,
    isPublished: true,
  };
}

function faqDraftFromFaq(faq: Faq): FaqDraft {
  return {
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    sortOrder: faq.sortOrder,
    isPublished: faq.isPublished,
  };
}

export function SupportPage({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  const { permissions, session, effectiveRole } = useAuth();
  const {
    faqs,
    publishedFaqs,
    unreadNotificationCount,
    supportThreads,
    getThreadPosts,
    saveFaq,
    deleteFaq,
    saveForumThread,
    addForumPost,
    setForumThreadStatus,
    setForumThreadPinned,
    setForumThreadLocked,
  } = useWorkspaceContent();

  const [supportTitle, setSupportTitle] = useState("");
  const [supportBody, setSupportBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(searchParams?.threadId ?? null);
  const [selectedFaqId, setSelectedFaqId] = useState<string | null>(null);
  const [faqDraft, setFaqDraft] = useState<FaqDraft>(emptyFaqDraft());

  const visibleSupportThreads = useMemo(() => {
    if (permissions.canModerateSupport) {
      return supportThreads;
    }

    return supportThreads.filter((thread) => thread.createdBy === session?.id);
  }, [permissions.canModerateSupport, session?.id, supportThreads]);

  const selectedThread = useMemo(() => {
    if (selectedThreadId) {
      return visibleSupportThreads.find((thread) => thread.id === selectedThreadId) ?? null;
    }

    return visibleSupportThreads[0] ?? null;
  }, [selectedThreadId, visibleSupportThreads]);

  const selectedThreadPosts = selectedThread ? getThreadPosts(selectedThread.id) : [];
  const openSupportCount = supportThreads.filter((thread) => thread.status === "open").length;

  const selectFaq = (faq: Faq) => {
    setSelectedFaqId(faq.id);
    setFaqDraft(faqDraftFromFaq(faq));
  };

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
    setSelectedThreadId(threadId);
    toast.success("Support request submitted");
  };

  const submitReply = () => {
    if (!selectedThread || !replyBody.trim()) {
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

  const saveCurrentFaq = () => {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) {
      toast.error("Add a question and answer before saving the FAQ.");
      return;
    }

    const faqId = selectedFaqId ?? crypto.randomUUID();
    saveFaq({
      ...faqDraft,
      id: faqId,
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim(),
      category: faqDraft.category.trim() || "General",
      sortOrder: Number(faqDraft.sortOrder) || 0,
    });
    setSelectedFaqId(faqId);
    toast.success("FAQ saved");
  };

  const removeFaq = () => {
    if (!selectedFaqId) {
      return;
    }

    if (!window.confirm("Delete this FAQ?")) {
      return;
    }

    deleteFaq(selectedFaqId);
    setSelectedFaqId(null);
    toast.success("FAQ deleted");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Support"
        title="Support requests and floor FAQs stay in one place."
        description="Use support for help requests, then keep the answers the team needs close by with published FAQs."
        actions={
          <>
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
          label="Open support"
          value={openSupportCount}
          hint="Requests waiting on action"
          icon={<MessageSquareMore className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="FAQs"
          value={publishedFaqs.length}
          hint="Published answers"
          icon={<BookOpen className="h-5 w-5" />}
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
            <CardTitle className="text-white">Submit support request</CardTitle>
            <CardDescription className="text-slate-400">
              Open a support request for a floor issue and track it from the queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label className="text-slate-200">Details</Label>
              <Textarea
                value={supportBody}
                onChange={(event) => setSupportBody(event.target.value)}
                placeholder="Include model, machine location, and the next step you need."
                className="min-h-32 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
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
            <CardTitle className="text-white">
              {permissions.canModerateSupport ? "Support queue" : "My support requests"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {permissions.canModerateSupport
                ? "Open a request to review replies, pin it, or move the status forward."
                : "Track the requests you have opened and jump back in when you need a reply."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedThread ? (
              <>
                <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Support</Badge>
                    <Badge className={cn("border", getThreadStatusBadgeClass(selectedThread.status))}>
                      {formatThreadStatusLabel(selectedThread.status, "support")}
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
                    onValueChange={(value) => submitStatus(value as ForumThreadStatus)}
                    disabled={!permissions.canModerateSupport}
                  >
                    <SelectTrigger className="h-10 w-[190px] border-white/10 bg-slate-950/70 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
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
                No support requests yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Support queue</CardTitle>
          <CardDescription className="text-slate-400">
            Open a request to jump straight to the thread detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[24rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {visibleSupportThreads.map((thread) => (
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
                    <Badge className={cn("border", getThreadStatusBadgeClass(thread.status))}>
                      {formatThreadStatusLabel(thread.status, "support")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{thread.body}</p>
                </button>
              ))}
              {visibleSupportThreads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No support requests yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">FAQs</CardTitle>
          <CardDescription className="text-slate-400">
            Quick answers for common requests and floor questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {publishedFaqs.map((faq) => (
            <details
              key={faq.id}
              className="rounded-3xl border border-white/10 bg-slate-950/50 p-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                {faq.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-300">{faq.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="border-white/10 bg-white/5 text-slate-200">{faq.category}</Badge>
              </div>
            </details>
          ))}
          {publishedFaqs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              No FAQs have been published yet.
            </div>
          )}
        </CardContent>
      </Card>

      {permissions.canManageSupportContent && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">FAQ management</CardTitle>
            <CardDescription className="text-slate-400">
              Add, edit, publish, or remove the answers the floor relies on.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <ScrollArea className="h-[32rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => selectFaq(faq)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-colors",
                      selectedFaqId === faq.id
                        ? "border-emerald-400/30 bg-emerald-400/10"
                        : "border-white/10 bg-slate-950/60 hover:bg-white/10",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">{faq.category}</Badge>
                      <Badge
                        className={faq.isPublished
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          : "border-amber-400/20 bg-amber-400/10 text-amber-100"}
                      >
                        {faq.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{faq.question}</p>
                  </button>
                ))}
                {faqs.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    No FAQ entries yet.
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Question</Label>
                  <Input
                    value={faqDraft.question}
                    onChange={(event) => setFaqDraft((current) => ({ ...current, question: event.target.value }))}
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Category</Label>
                  <Input
                    value={faqDraft.category}
                    onChange={(event) => setFaqDraft((current) => ({ ...current, category: event.target.value }))}
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Sort order</Label>
                  <Input
                    type="number"
                    value={faqDraft.sortOrder}
                    onChange={(event) =>
                      setFaqDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))
                    }
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Publish state</Label>
                  <Select
                    value={faqDraft.isPublished ? "published" : "draft"}
                    onValueChange={(value) =>
                      setFaqDraft((current) => ({ ...current, isPublished: value === "published" }))
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
                <Label className="text-slate-200">Answer</Label>
                <Textarea
                  value={faqDraft.answer}
                  onChange={(event) => setFaqDraft((current) => ({ ...current, answer: event.target.value }))}
                  className="min-h-40 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  onClick={saveCurrentFaq}
                >
                  Save FAQ
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setSelectedFaqId(null);
                    setFaqDraft(emptyFaqDraft());
                  }}
                >
                  New FAQ
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={removeFaq}
                  disabled={!selectedFaqId}
                >
                  Delete FAQ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
