"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRoleLabel } from "@/lib/auth";
import { cn } from "@/lib/utils";

const rolePreviewOptions = [
  {
    value: "admin",
    label: "Admin (current)",
  },
  {
    value: "manager",
    label: "Manager",
  },
  {
    value: "technician",
    label: "Technician",
  },
  {
    value: "viewer",
    label: "Viewer",
  },
] as const;

export function RolePreviewPanel({
  className,
  compact = false,
  afterClearHref,
}: Readonly<{
  className?: string;
  compact?: boolean;
  afterClearHref?: string | null;
}>) {
  const router = useRouter();
  const {
    permissions,
    realRole,
    effectiveRole,
    previewRole,
    isRolePreviewActive,
    setRolePreview,
    clearRolePreview,
  } = useAuth();

  if (!permissions.canPreviewRoles) {
    return null;
  }

  const previewValue = previewRole ?? "admin";

  const handleClearPreview = () => {
    clearRolePreview();

    if (afterClearHref) {
      router.replace(afterClearHref);
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-amber-400/20 bg-amber-400/10 text-amber-50 shadow-lg shadow-amber-950/10",
        compact ? "p-4" : "p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">View as Role</p>
          <p className={cn("text-xs leading-5", compact ? "text-amber-100/85" : "text-amber-100/80")}>
            Preview the app as viewer, technician, or manager without changing your real Supabase role.
          </p>
        </div>
        <Badge className="shrink-0 border-white/10 bg-white/10 text-slate-200">
          {isRolePreviewActive ? `On · ${getRoleLabel(effectiveRole)}` : "Off"}
        </Badge>
      </div>

      {!compact && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Real role</p>
            <p className="mt-2 text-sm font-semibold text-white">{getRoleLabel(realRole ?? "viewer")}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Effective role</p>
            <p className="mt-2 text-sm font-semibold text-white">{getRoleLabel(effectiveRole)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Preview</p>
            <p className="mt-2 text-sm font-semibold text-white">{isRolePreviewActive ? "Active" : "Off"}</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Label className={cn("text-slate-200", compact ? "text-xs" : "")}>Preview role</Label>
        <Select
          value={previewValue}
          onValueChange={(value) => {
            if (value === "admin") {
              handleClearPreview();
              return;
            }

            setRolePreview(value as "viewer" | "technician" | "manager");
          }}
        >
          <SelectTrigger className={cn("h-12 w-full border-white/10 bg-slate-950/70 text-white", compact && "h-11")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rolePreviewOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("mt-4 rounded-2xl border border-white/10 bg-slate-950/50", compact ? "p-3" : "p-4")}>
        <p className="text-sm font-semibold text-white">Safe preview</p>
        <p className={cn("mt-2 text-slate-300", compact ? "text-xs leading-5" : "text-sm leading-6")}>
          This only changes what the browser shows. Server routes, admin actions, and saved data still use your real
          Supabase role.
        </p>
        {isRolePreviewActive && (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "mt-4 h-10 border-amber-200/30 bg-white/10 text-amber-50 hover:bg-white/20 hover:text-white",
              compact && "w-full",
            )}
            onClick={handleClearPreview}
          >
            Return to Admin
          </Button>
        )}
      </div>
    </div>
  );
}
