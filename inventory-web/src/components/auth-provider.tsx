"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  type AuthSession,
  getPermissions,
  type PermissionSet,
} from "@/lib/auth";
import { profileDisplayName } from "@/lib/profile-display";
import type { ProfileRow } from "@/lib/supabase/types";

type SignInInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  session: AuthSession | null;
  hydrated: boolean;
  permissions: PermissionSet;
  isAuthenticated: boolean;
  signIn: (input: SignInInput) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppSession(
  user: { id: string; email?: string | null; created_at?: string | null },
  profile: ProfileRow,
): AuthSession {
  return {
    id: user.id,
    displayName: profileDisplayName(profile),
    email: profile.email,
    role: profile.role,
    provider: "supabase",
    lastSignedInAt: user.created_at ?? new Date().toISOString(),
    active: profile.active,
    mustChangePassword: profile.must_change_password,
  };
}

async function loadSupabaseSession(
  supabase: ReturnType<typeof createClient>,
  setSession: (session: AuthSession | null) => void,
) {
  const { data: userResponse, error } = await supabase.auth.getUser();

  if (error || !userResponse.user) {
    setSession(null);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userResponse.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    setSession(null);
    return null;
  }

  if (!profile.active) {
    await supabase.auth.signOut();
    setSession(null);
    return null;
  }

  const nextSession = toAppSession(
    userResponse.user,
    profile,
  );

  setSession(nextSession);
  return nextSession;
}

export function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    void loadSupabaseSession(supabase, (nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    }).finally(() => {
      if (mounted) {
        setHydrated(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return;
      await loadSupabaseSession(supabase, setSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    return loadSupabaseSession(supabase, setSession);
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const signIn = useCallback(
    async ({ email, password }: SignInInput) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const nextSession = await loadSupabaseSession(supabase, setSession);

      if (!nextSession) {
        throw new Error("Unable to load your account profile. Please contact an admin.");
      }

      return nextSession;
    },
    [supabase],
  );

  const permissions = session ? getPermissions(session.role) : getPermissions("viewer");

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      hydrated,
      permissions,
      isAuthenticated: Boolean(session),
      signIn,
      signOut,
      refreshSession,
    }),
    [hydrated, permissions, refreshSession, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
