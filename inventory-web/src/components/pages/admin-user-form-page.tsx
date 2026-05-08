"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCcw,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { generateTemporaryPassword } from "@/lib/password";
import { getRoleLabel, type UserRole } from "@/lib/auth";
import type { AdminUserRecord } from "@/lib/admin-users";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/inventory-utils";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";

type UserDraft = {
  fullName: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
  active: boolean;
  mustChangePassword: boolean;
};

type AdminUserFormPageProps = {
  mode: "create" | "edit";
  user?: AdminUserRecord | null;
  currentUserId: string;
};

function createEmptyDraft(): UserDraft {
  return {
    fullName: "",
    email: "",
    role: "viewer",
    temporaryPassword: generateTemporaryPassword(),
    active: true,
    mustChangePassword: true,
  };
}

function draftFromUser(user?: AdminUserRecord | null): UserDraft {
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

function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text).catch(() => null);
}

export function AdminUserFormPage({ mode, user, currentUserId }: Readonly<AdminUserFormPageProps>) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const isCurrentUser = Boolean(user && user.id === currentUserId);
  const [draft, setDraft] = useState<UserDraft>(() => draftFromUser(user));
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"reset" | "delete" | "status" | null>(null);
  const [successPassword, setSuccessPassword] = useState("");

  const displayName = useMemo(() => {
    return (
      user?.full_name?.trim() ||
      draft.fullName.trim() ||
      user?.auth_email ||
      user?.email ||
      draft.email.trim() ||
      "New user"
    );
  }, [draft.email, draft.fullName, user]);

  const savePayload = async () => {
    if (!draft.fullName.trim()) {
      throw new Error("Please enter a full name.");
    }

    if (!isEditMode && !draft.email.trim()) {
      throw new Error("Please enter an email address.");
    }

    if (!isEditMode && draft.temporaryPassword.trim().length < 10) {
      throw new Error("Temporary passwords must be at least 10 characters long.");
    }

    if (isEditMode && !user) {
      throw new Error("That user could not be found.");
    }

    if (isEditMode) {
      const response = await fetch(`/api/admin/users/${user!.id}`, {
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

      return;
    }

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

    const payload = (await response.json().catch(() => null)) as { error?: string; user?: AdminUserRecord } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "We could not create that user.");
    }

    setSuccessPassword(draft.temporaryPassword);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await savePayload();

      if (isEditMode) {
        toast.success("User updated");
        router.refresh();
        return;
      }

      toast.success("User created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not save that user.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;

    const temporaryPassword = draft.temporaryPassword.trim() || generateTemporaryPassword();
    setBusyAction("reset");

    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          temporaryPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; temporaryPassword?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We could not reset that password.");
      }

      setDraft((current) => ({ ...current, temporaryPassword: "", mustChangePassword: true }));
      setSuccessPassword(payload?.temporaryPassword ?? temporaryPassword);
      toast.success("Password reset");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not reset that password.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleStatusToggle = async (nextActive: boolean) => {
    if (!user) return;

    const confirmText = nextActive
      ? "Reactivate this user so they can sign in again?"
      : "Deactivate this user so they cannot sign in?";

    if (!window.confirm(confirmText)) {
      return;
    }

    setBusyAction("status");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: draft.fullName.trim() || user.full_name || user.email,
          role: draft.role,
          active: nextActive,
          mustChangePassword: draft.mustChangePassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We could not change that account state.");
      }

      setDraft((current) => ({ ...current, active: nextActive }));
      toast.success(nextActive ? "User reactivated" : "User deactivated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not change that account state.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      "Delete this user permanently? Use deactivate instead if you want to keep the profile around.",
    );

    if (!confirmed) return;

    setBusyAction("delete");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We could not delete that user.");
      }

      toast.success("User deleted");
      router.replace("/admin/users");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not delete that user.");
    } finally {
      setBusyAction(null);
    }
  };

  if (isEditMode && !user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-300">That user could not be found.</p>
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to users
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEditMode && successPassword) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Users"
          title="New account created."
          description="Copy the temporary password below and give it to the new user. They will be forced to change it the first time they sign in."
          actions={
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Done
            </Link>
          }
        />
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
              <CardTitle className="text-white">{displayName}</CardTitle>
              <CardDescription className="text-slate-400">
                Temporary password shown once for this new account.
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/70">Temporary password</p>
              <p className="mt-2 font-mono text-lg font-semibold text-white">{successPassword}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => {
                  void copyToClipboard(successPassword);
                  toast.success("Temporary password copied.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy password
              </Button>
              <Link
                href="/admin/users"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to users
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passwordResetReady = draft.temporaryPassword.trim().length >= 10;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Users"
        title={isEditMode ? "Edit user account" : "Create user account"}
        description={
          isEditMode
            ? "Update the name, role, and sign-in status. Temporary password resets happen server-side and must change the password on next login."
            : "Create a Supabase Auth user with a temporary password. The new account will be forced to change it on the first login."
        }
        actions={
          <Link
            href="/admin/users"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to users
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Account details</CardTitle>
              <CardDescription className="text-slate-400">
                Use plain, friendly field labels so the admin flow stays easy to scan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Full name</Label>
                  <Input
                    value={draft.fullName}
                    onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    placeholder="Jane Technician"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Email</Label>
                  <Input
                    value={draft.email}
                    onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    placeholder="jane@novatech.com"
                    type="email"
                    disabled={isEditMode}
                  />
                </div>
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
                  disabled={isCurrentUser}
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

              {isEditMode ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">Active account</p>
                      <p className="text-xs text-slate-400">
                        Inactive accounts cannot sign in.
                      </p>
                    </div>
                    <Checkbox
                      checked={draft.active}
                      onCheckedChange={(checked) =>
                        setDraft((current) => ({ ...current, active: Boolean(checked) }))
                      }
                      disabled={isCurrentUser}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">Require password change</p>
                      <p className="text-xs text-slate-400">
                        The user must set a new password after the next login.
                      </p>
                    </div>
                    <Checkbox
                      checked={draft.mustChangePassword}
                      onCheckedChange={(checked) =>
                        setDraft((current) => ({ ...current, mustChangePassword: Boolean(checked) }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">Require password change</p>
                    <p className="text-xs text-slate-400">
                      Checked by default for new accounts.
                    </p>
                  </div>
                  <Checkbox
                    checked={draft.mustChangePassword}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, mustChangePassword: Boolean(checked) }))
                    }
                  />
                </div>
              )}

              {isCurrentUser && (
                <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                  You can change your name here, but your own role and active status are locked to keep your admin access safe.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isEditMode ? "Save changes" : "Create user"}
                </Button>
                <Link
                  href="/admin/users"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Cancel
                </Link>
              </div>
            </CardContent>
          </Card>

          {isEditMode && user && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Password reset</CardTitle>
                <CardDescription className="text-slate-400">
                  Generate a new temporary password and mark the account for a first-login password change.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={draft.temporaryPassword}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, temporaryPassword: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    placeholder="Temporary password"
                  />
                  <Button
                    variant="outline"
                    className="h-12 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      const nextPassword = generateTemporaryPassword();
                      setDraft((current) => ({ ...current, temporaryPassword: nextPassword }));
                      void copyToClipboard(nextPassword);
                      toast.success("Temporary password generated and copied.");
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => void copyToClipboard(draft.temporaryPassword)}
                    disabled={!draft.temporaryPassword}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                    onClick={() => void handleResetPassword()}
                    disabled={busyAction === "reset" || !passwordResetReady}
                  >
                    {busyAction === "reset" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Reset password
                  </Button>
                  {user && !isCurrentUser && (
                    <Button
                      variant="outline"
                      className={cn(
                        "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
                        user.active ? "text-amber-100" : "text-emerald-100",
                      )}
                      onClick={() => void handleStatusToggle(!user.active)}
                      disabled={busyAction === "status"}
                    >
                      {busyAction === "status" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : user.active ? (
                        <Shield className="mr-2 h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      {user.active ? "Deactivate user" : "Reactivate user"}
                    </Button>
                  )}
                  {user && !isCurrentUser && (
                    <Button
                      variant="outline"
                      className="border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 hover:text-white"
                      onClick={() => void handleDelete()}
                      disabled={busyAction === "delete"}
                    >
                      {busyAction === "delete" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete user
                    </Button>
                  )}
                </div>

                {isCurrentUser && (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                    This is your own account, so destructive access changes are disabled here.
                  </div>
                )}

                {successPassword && (
                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/70">
                      New temporary password
                    </p>
                    <p className="mt-2 font-mono text-lg font-semibold text-white">{successPassword}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={() => {
                          void copyToClipboard(successPassword);
                          toast.success("Temporary password copied.");
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy password
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          setSuccessPassword("");
                          setDraft((current) => ({ ...current, temporaryPassword: "" }));
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Account summary</CardTitle>
              <CardDescription className="text-slate-400">
                A quick review of the profile before you save changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Name</p>
                <p className="mt-2 text-sm font-semibold text-white">{draft.fullName || "New user"}</p>
                <p className="mt-1 text-sm text-slate-400">{draft.email || "No email yet"}</p>
              </div>

              <div className="grid gap-2">
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Role</span>
                  <span>{getRoleLabel(draft.role)}</span>
                </Badge>
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Status</span>
                  <span>{draft.active ? "Active" : "Inactive"}</span>
                </Badge>
                <Badge className="justify-between border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>Password change</span>
                  <span>{draft.mustChangePassword ? "Required" : "Off"}</span>
                </Badge>
              </div>

              {isEditMode && user && (
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-semibold text-white">{user.full_name || user.email}</p>
                  <p className="mt-2 text-slate-400">
                    Created {formatDateTime(user.created_at ?? user.auth_created_at)}.
                  </p>
                  <p className="mt-1 text-slate-400">
                    Last sign-in {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Unknown"}.
                  </p>
                </div>
              )}

              {!isEditMode && (
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                  The temporary password is shown above the first time you save the new account.
                </div>
              )}
            </CardContent>
          </Card>

          {!isEditMode && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Temporary password</CardTitle>
                <CardDescription className="text-slate-400">
                  Generate one that the user will change at first login.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={draft.temporaryPassword}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, temporaryPassword: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    placeholder="Temporary password"
                  />
                  <Button
                    variant="outline"
                    className="h-12 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      const nextPassword = generateTemporaryPassword();
                      setDraft((current) => ({ ...current, temporaryPassword: nextPassword }));
                      void copyToClipboard(nextPassword);
                      toast.success("Temporary password generated and copied.");
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => void copyToClipboard(draft.temporaryPassword)}
                    disabled={!draft.temporaryPassword}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                  New accounts will be created active and forced to change this password on first sign-in.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
