"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { CheckCircle2, KeyRound, Plus, Search, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRoleLabel } from "@/lib/auth";
import { mergeAdminUsers, type AdminUserRecord } from "@/lib/admin-users";
import type { ProfileRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type AdminUsersPageProps = {
  users: ProfileRow[];
  authUsers: SupabaseAuthUser[];
  currentUserId: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function summarizeUsers(users: AdminUserRecord[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.active).length,
    admins: users.filter((user) => user.role === "admin").length,
    needsPassword: users.filter((user) => user.must_change_password).length,
  };
}

function UserRow({
  user,
  currentUserId,
}: Readonly<{
  user: AdminUserRecord;
  currentUserId: string;
}>) {
  const displayName = user.full_name?.trim() || user.auth_email || user.email;
  const isCurrentUser = user.id === currentUserId;

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-white">{displayName}</p>
            {isCurrentUser && (
              <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                You
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-slate-400">{user.email}</p>

          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/10 bg-white/5 text-slate-200">
              {getRoleLabel(user.role)}
            </Badge>
            <Badge
              className={
                user.active
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "border-slate-500/20 bg-slate-500/10 text-slate-300"
              }
            >
              {user.active ? "Active" : "Inactive"}
            </Badge>
            {user.must_change_password && (
              <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                Password reset
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[24rem]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Created</p>
            <p className="mt-2 text-sm text-white">
              {formatDateTime(user.created_at ?? user.auth_created_at)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last sign-in</p>
            <p className="mt-2 text-sm text-white">{formatDateTime(user.last_sign_in_at)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/users/${user.id}/edit`}
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
          )}
        >
          Edit user
        </Link>
      </div>
    </div>
  );
}

export function AdminUsersPage({ users, authUsers, currentUserId }: Readonly<AdminUsersPageProps>) {
  const [query, setQuery] = useState("");

  const records = useMemo(() => mergeAdminUsers(users, authUsers), [authUsers, users]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return [...records].filter((user) => {
      if (!search) return true;

      return `${user.full_name ?? ""} ${user.email} ${user.role} ${user.active ? "active" : "inactive"} ${user.must_change_password ? "password reset" : ""} ${user.last_sign_in_at ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [query, records]);

  const stats = useMemo(() => summarizeUsers(records), [records]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Users"
        title="Manage Green NVentory accounts."
        description="Create admin-managed accounts, review roles, and keep passwords under control without exposing the service role key to the browser."
        actions={
          <Link
            href="/admin/users/new"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            New user
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={stats.total}
          hint="All profiles"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint="Can sign in"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Admins"
          value={stats.admins}
          hint="Elevated accounts"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          label="Needs password change"
          value={stats.needsPassword}
          hint="Temporary passwords still in use"
          icon={<KeyRound className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search users</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, or role"
                className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
            New users are created on a dedicated screen so this list can stay focused on account review.
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">User roster</CardTitle>
          <CardDescription className="text-slate-400">
            Open a profile to edit the name, role, password, or sign-in status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredUsers.length > 0 ? (
            <ScrollArea className="h-[clamp(24rem,60vh,42rem)] rounded-3xl border border-white/10 bg-slate-950/50">
              <div className="space-y-3 p-3 pr-4">
                {filteredUsers.map((user) => (
                  <UserRow key={user.id} user={user} currentUserId={currentUserId} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
              No users matched the current search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
