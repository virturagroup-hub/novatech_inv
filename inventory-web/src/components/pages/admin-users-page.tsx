"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  UserCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/lib/auth";
import type { ProfileRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type AdminUsersPageProps = {
  users: ProfileRow[];
};

type UserDraft = {
  fullName: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
  active: boolean;
  mustChangePassword: boolean;
};

function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "technician":
      return "Technician";
    case "viewer":
    default:
      return "Viewer";
  }
}

function generateTemporaryPassword() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => characters[value % characters.length]).join("");
}

function createEmptyDraft(): UserDraft {
  return {
    fullName: "",
    email: "",
    role: "viewer",
    temporaryPassword: "",
    active: true,
    mustChangePassword: true,
  };
}

function draftFromUser(user?: ProfileRow | null): UserDraft {
  if (!user) {
    return createEmptyDraft();
  }

  return {
    fullName: user.full_name ?? "",
    email: user.email,
    role: user.role,
    temporaryPassword: "",
    active: user.active,
    mustChangePassword: user.must_change_password,
  };
}

type UserEditorProps = {
  user: ProfileRow | null;
  canManageUsers: boolean;
  busy: boolean;
  onCreate: (draft: UserDraft) => Promise<string>;
  onUpdate: (userId: string, draft: UserDraft) => Promise<void>;
  onSaved: (nextUserId?: string) => void;
  onCancel: () => void;
};

function UserEditor({
  user,
  canManageUsers,
  busy,
  onCreate,
  onUpdate,
  onSaved,
  onCancel,
}: UserEditorProps) {
  const [draft, setDraft] = useState<UserDraft>(() => draftFromUser(user));
  const isExistingUser = Boolean(user);

  const handleSave = async () => {
    if (!canManageUsers) {
      toast.error("Your role can only view this page.");
      return;
    }

    if (!draft.fullName.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    if (!isExistingUser) {
      if (!draft.email.trim()) {
        toast.error("Please enter an email address.");
        return;
      }

      if (draft.temporaryPassword.length < 10) {
        toast.error("Temporary passwords must be at least 10 characters long.");
        return;
      }
    }

    try {
      if (isExistingUser && user) {
        await onUpdate(user.id, draft);
        toast.success("User updated");
        onSaved();
        return;
      }

      const nextUserId = await onCreate(draft);
      toast.success("User created");
      onSaved(nextUserId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not save that user.");
    }
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-white">{user ? "Edit user" : "Create user"}</CardTitle>
        <CardDescription className="text-slate-400">
          {user
            ? "Change the role, mark the account active or inactive, and force a new password on the next login."
            : "Create an account with a temporary password. The user must change it when they first sign in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-200">Full name</Label>
          <Input
            value={draft.fullName}
            onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
            className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
            placeholder="Jane Technician"
            disabled={!canManageUsers}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-200">Email</Label>
          <Input
            value={draft.email}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
            placeholder="jane@novatech.com"
            disabled={!canManageUsers || isExistingUser}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-200">Role</Label>
          <Select
            value={draft.role}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                role: value as UserRole,
              }))
            }
            disabled={!canManageUsers}
          >
            <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {user ? (
          <>
            <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Active account</p>
                <p className="text-xs text-slate-400">
                  Deactivated users are banned from signing in until reactivated.
                </p>
              </div>
              <Checkbox
                checked={draft.active}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, active: Boolean(checked) }))
                }
                disabled={!canManageUsers}
              />
            </div>

            <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Force password change</p>
                <p className="text-xs text-slate-400">
                  The user must change their password on the next login.
                </p>
              </div>
              <Checkbox
                checked={draft.mustChangePassword}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, mustChangePassword: Boolean(checked) }))
                }
                disabled={!canManageUsers}
              />
            </div>
          </>
        ) : canManageUsers ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
            New users receive the temporary password below, and the app will require a first-login password change automatically.
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
            Manager access is view-only here. Select a user to review their details.
          </div>
        )}

        {!user && canManageUsers && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-slate-200">Temporary password</Label>
              <Button
                variant="outline"
                className="h-9 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const nextPassword = generateTemporaryPassword();
                  setDraft((current) => ({ ...current, temporaryPassword: nextPassword }));
                  void navigator.clipboard.writeText(nextPassword).catch(() => null);
                  toast.success("Temporary password generated and copied.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Generate
              </Button>
            </div>
            <Input
              value={draft.temporaryPassword}
              onChange={(event) =>
                setDraft((current) => ({ ...current, temporaryPassword: event.target.value }))
              }
              className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              placeholder="Enter or generate a temporary password"
              type="text"
            />
          </div>
        )}

        {user && (
          <div className="rounded-3xl border border-slate-500/20 bg-slate-950/50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {user.full_name || user.email}
                </p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {canManageUsers ? (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-11 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {user ? "Save changes" : "Create user"}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            Manager access is view-only in this release.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUsersPage({ users }: AdminUsersPageProps) {
  const router = useRouter();
  const { permissions, hydrated } = useAuth();
  const canViewUsers = permissions.canViewUsers || permissions.canManageUsers;
  const canManageUsers = permissions.canManageUsers;
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | "new">("new");
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return [...users].filter((user) => {
      if (!search) return true;

      return `${user.full_name ?? ""} ${user.email} ${user.role} ${user.active ? "active" : "inactive"} ${user.must_change_password ? "password reset" : ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [query, users]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.active).length,
      admins: users.filter((user) => user.role === "admin").length,
      needsPassword: users.filter((user) => user.must_change_password).length,
    };
  }, [users]);

  const visibleSelectedUserId =
    selectedUserId === "new"
      ? !canManageUsers && users[0]
        ? users[0].id
        : "new"
      : users.find((user) => user.id === selectedUserId)?.id ?? users[0]?.id ?? "new";
  const selectedUser = visibleSelectedUserId === "new"
    ? null
    : users.find((user) => user.id === visibleSelectedUserId) ?? null;

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-sm text-slate-400">Loading users...</CardContent>
        </Card>
      </div>
    );
  }

  const saveNewUser = async (draft: UserDraft) => {
    setBusy(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: draft.fullName.trim(),
          email: draft.email.trim(),
          role: draft.role,
          temporaryPassword: draft.temporaryPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; user?: ProfileRow } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We could not save that user.");
      }

      router.refresh();
      return payload?.user?.id ?? "";
    } finally {
      setBusy(false);
    }
  };

  const saveExistingUser = async (userId: string, draft: UserDraft) => {
    setBusy(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: draft.fullName.trim(),
          role: draft.role,
          active: draft.active,
          mustChangePassword: draft.mustChangePassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We could not update that user.");
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!canViewUsers) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Users are not available</h1>
                <p className="text-sm text-slate-400">
                  Your role does not have access to the user management area.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 px-5 py-5 shadow-2xl shadow-black/10 backdrop-blur-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
              Admin users
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Manage who can use Green NVentory.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Admins create accounts here with a temporary password. New users are forced to change that password on first login.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Users", value: stats.total, hint: "All profiles", icon: <Users className="h-5 w-5" /> },
          { label: "Active", value: stats.active, hint: "Can sign in", icon: <CheckCircle2 className="h-5 w-5" /> },
          { label: "Admins", value: stats.admins, hint: "Elevated accounts", icon: <Shield className="h-5 w-5" /> },
          {
            label: "Needs password change",
            value: stats.needsPassword,
            hint: "Temporary passwords still in use",
            icon: <KeyRound className="h-5 w-5" />,
          },
        ].map((metric) => (
          <Card key={metric.label} className="border-white/10 bg-white/5">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-slate-100">
                {metric.icon}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-400">{metric.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
            {canManageUsers
              ? "Admins can create, edit, deactivate, and force password resets. Managers can review the list, but they do not get create or edit access."
              : "You can review the roster here. Ask an admin to make changes."}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Users</CardTitle>
            <CardDescription className="text-slate-400">
              Select a record to edit, or open a new user form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManageUsers && (
              <Button
                className="h-11 w-full justify-start bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => {
                  setSelectedUserId("new");
                  setFormVersion((value) => value + 1);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New user
              </Button>
            )}

            {filteredUsers.map((user) => {
              const active = visibleSelectedUserId === user.id;

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setFormVersion((value) => value + 1);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{user.full_name || user.email}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {roleLabel(user.role)}
                      </Badge>
                      <Badge
                        className={cn(
                          "border",
                          user.active
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                            : "border-slate-500/20 bg-slate-500/10 text-slate-300",
                        )}
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
                  {active && <Badge className="border-white/10 bg-white/5 text-slate-200">Selected</Badge>}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <UserEditor
            key={`${visibleSelectedUserId}:${formVersion}`}
            user={selectedUser}
            canManageUsers={canManageUsers}
            busy={busy}
            onCreate={saveNewUser}
            onUpdate={saveExistingUser}
            onSaved={(nextUserId) => {
              if (nextUserId) {
                setSelectedUserId(nextUserId);
              }
              setFormVersion((value) => value + 1);
            }}
            onCancel={() => {
              setFormVersion((value) => value + 1);
            }}
          />
        </Card>
      </div>
    </div>
  );
}
