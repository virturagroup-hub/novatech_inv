"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordPage() {
  const router = useRouter();
  const { session, refreshSession, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submitPassword = async () => {
    setErrorMessage("");

    if (password.length < 10) {
      setErrorMessage("Please choose a password with at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      const response = await fetch("/api/auth/password-change", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "We could not clear the first-login requirement.");
      }

      await refreshSession();
      toast.success("Password updated");
      router.replace("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not update your password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(180deg,#04110d_0%,#050d13_55%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center">
        <Card className="w-full border-white/10 bg-white/5 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <BrandLockup />
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white">Set your new password</CardTitle>
                <CardDescription className="text-slate-400">
                  {session?.email
                    ? `Signed in as ${session.email}. Your admin issued a temporary password, and this account must be updated before you can use the app.`
                    : "Your account must be updated before you can use the app."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-200">New password</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Choose a new password"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                placeholder="Repeat the new password"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
              Pick a password you can remember. After this step, the app will unlock and the temporary password will no longer be required.
            </div>

            {errorMessage && (
              <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={submitPassword}
                disabled={busy}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Save new password
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
