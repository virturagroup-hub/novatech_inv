"use client";

import Link from "next/link";
import { ArrowRight, Bell, CheckCheck, MessageSquareMore, RefreshCw, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { cn } from "@/lib/utils";

function notificationLink(notification: { entityType: string; entityId: string }) {
  if (notification.entityType === "forum_thread") {
    return `/support?threadId=${encodeURIComponent(notification.entityId)}`;
  }

  if (notification.entityType === "green_machine") {
    return `/green-machines/${encodeURIComponent(notification.entityId)}`;
  }

  return null;
}

export function NotificationsPage() {
  const { permissions } = useAuth();
  const { visibleNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } =
    useWorkspaceContent();

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Notifications"
        title="One inbox for support replies, feature changes, and content updates."
        description="Use this inbox to keep up with the latest workspace activity without hunting through each module."
        actions={
          <>
            <Link
              href="/support"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <MessageSquareMore className="mr-2 h-4 w-4" />
              Support hub
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
          label="Unread"
          value={unreadNotificationCount}
          hint="Waiting for you"
          icon={<Bell className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Visible"
          value={visibleNotifications.length}
          hint="Filtered for your role"
          icon={<RefreshCw className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Role"
          value={permissions.canViewNotifications ? "On" : "Off"}
          hint="Notification access"
          icon={<CheckCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Inbox"
          value={visibleNotifications.filter((item) => item.isRead).length}
          hint="Already read"
          icon={<Bell className="h-5 w-5" />}
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-white">Notification inbox</CardTitle>
            <CardDescription className="text-slate-400">
              Mark individual notifications as read or clear the whole inbox in one click.
            </CardDescription>
          </div>
          <Button
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            onClick={markAllNotificationsRead}
            disabled={unreadNotificationCount === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[34rem] rounded-3xl border border-white/10 bg-slate-950/50 p-3">
            <div className="space-y-3">
              {visibleNotifications.map((notification) => {
                const href = notificationLink(notification);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      notification.isRead
                        ? "border-white/10 bg-slate-950/60"
                        : "border-emerald-400/20 bg-emerald-400/10",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            {notification.type}
                          </Badge>
                          {!notification.isRead && (
                            <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                              Unread
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white">{notification.title}</p>
                        <p className="text-sm leading-6 text-slate-300">{notification.body}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {href && (
                          <Link
                            href={href}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "default" }),
                              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            Open
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="outline"
                            className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                            onClick={() => markNotificationRead(notification.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {visibleNotifications.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No notifications yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
