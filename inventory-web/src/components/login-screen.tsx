"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  UserCircle2,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { BrandLockup } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthBlockMessage, type AuthBlockReason } from "@/lib/auth";
import { buildChangePasswordPath, sanitizeInternalPath } from "@/lib/navigation";
import { APP_DESCRIPTION, APP_NAME, APP_SUBTITLE, COMPANY_NAME } from "@/lib/brand";

export function LoginScreen({
  nextPath = "/",
  reason = null,
}: Readonly<{
  nextPath?: string;
  reason?: AuthBlockReason | null;
}>) {
  const router = useRouter();
  const { signIn, isAuthenticated, session, hydrated, authIssue } = useAuth();
  const safeNextPath = sanitizeInternalPath(nextPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const blockingReason = reason ?? authIssue;

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !session) return;

    if (session.mustChangePassword) {
      router.replace(buildChangePasswordPath(safeNextPath));
      return;
    }

    router.replace(safeNextPath);
  }, [hydrated, isAuthenticated, router, session, safeNextPath]);

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
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
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
                  <p className="text-xs text-slate-400">
                    Quick lookups, label printing, and stock adjustments.
                  </p>
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
        </div>

        <Card className="border-white/10 bg-white/5 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white">Sign in with your email</CardTitle>
                <CardDescription className="text-slate-400">
                  Use your work email and password. If your admin issued a temporary password, enter that
                  password here and you will be prompted to change it after sign-in.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-200">Email</Label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="jane@novatech.com"
                inputMode="email"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Password</Label>
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Enter your password"
                type="password"
                autoComplete="current-password"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Admin-managed accounts only</p>
                  <p className="text-xs text-slate-400">
                    Public signups are off. New accounts are created by an admin and may require a first-login
                    password change.
                  </p>
                </div>
                <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                  Secure
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Look up parts</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Print labels</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Manage inventory</div>
              </div>
            </div>

            {blockingReason && (
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                {getAuthBlockMessage(blockingReason)}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            )}

            <Button
              className="h-12 w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrorMessage("");

                try {
                  const nextSession = await signIn({
                    email: email.trim(),
                    password,
                  });

                  router.replace(
                    nextSession.mustChangePassword
                      ? buildChangePasswordPath(safeNextPath)
                      : safeNextPath,
                  );
                } catch (error) {
                  setErrorMessage(
                    error instanceof Error
                      ? error.message
                      : "We could not sign you in. Check the email and password.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Sign in
            </Button>

            <p className="text-xs leading-5 text-slate-400">
              This app is for internal use only. If your password does not work, ask an admin to reset your
              account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
