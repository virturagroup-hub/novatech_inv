"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, UserCircle2, Wrench, MonitorSmartphone } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { APP_DESCRIPTION, APP_NAME, APP_SUBTITLE, COMPANY_NAME } from "@/lib/brand";
import { getPermissions, getRoleDescription, getRoleLabel, roleOptions, type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function LoginScreen({
  nextPath = "/",
}: Readonly<{
  nextPath?: string;
}>) {
  const router = useRouter();
  const { signIn, isAuthenticated, session } = useAuth();
  const [displayName, setDisplayName] = useState("Field Tech");
  const [email, setEmail] = useState("tech@novatech.local");
  const [role, setRole] = useState<UserRole>("technician");
  const permissions = useMemo(() => getPermissions(role), [role]);

  useEffect(() => {
    if (isAuthenticated && session) {
      router.replace(nextPath || "/");
    }
  }, [isAuthenticated, nextPath, router, session]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(180deg,#04110d_0%,#050d13_55%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8 lg:p-10">
          <BrandLockup className="mb-8" />
          <div className="max-w-2xl space-y-5">
            <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
              {COMPANY_NAME} internal tool
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                {APP_NAME}
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                {APP_SUBTITLE}. {APP_DESCRIPTION}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Built for the parts room</p>
                  <p className="text-xs text-slate-400">Quick lookups, label printing, and stock adjustments.</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Desktop and Android ready</p>
                  <p className="text-xs text-slate-400">Works well in Chrome, tablets, and phones.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {roleOptions.map((option) => {
              const active = option.role === role;
              const currentPermissions = getPermissions(option.role);

              return (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => setRole(option.role)}
                  className={cn(
                    "rounded-3xl border p-4 text-left transition-colors",
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{option.label}</p>
                    {active && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{option.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {currentPermissions.canManageParts ? "Editable" : "Read-mostly"}
                    </Badge>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {getRoleLabel(option.role)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="border-white/10 bg-white/5 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white">Enter the workspace</CardTitle>
                <CardDescription className="text-slate-400">
                  Use your name and a role to open the local Phase 1 session.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-200">Display name</Label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Jane Technician"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Email</Label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="jane@novatech.local"
                inputMode="email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.role} value={option.role}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{getRoleLabel(role)}</p>
                  <p className="text-xs text-slate-400">{getRoleDescription(role)}</p>
                </div>
                <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                  {permissions.canManageParts ? "Elevated" : "Limited"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Look up parts</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Print labels</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Adjust stock</div>
              </div>
            </div>

            <Button
              className="h-12 w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={async () => {
                await signIn({ displayName: displayName.trim(), email: email.trim(), role });
                router.replace(nextPath || "/");
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Open {APP_NAME}
            </Button>

            <p className="text-xs leading-5 text-slate-400">
              This Phase 1 sign-in is local for now. Supabase auth can replace it later without changing the app layout.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
