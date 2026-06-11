"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getAuthBlockMessage,
  resolvePermissions,
  type AuthBlockReason,
  type AuthSession,
  type PermissionSet,
  isUserRole,
  type UserRole,
} from "@/lib/auth";
import { profileDisplayName } from "@/lib/profile-display";
import type { ProfileRow } from "@/lib/supabase/types";
import { hasMustChangePasswordFlag } from "@/lib/supabase/auth-metadata";

type SignInInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  session: AuthSession | null;
  hydrated: boolean;
  permissions: PermissionSet;
  isAuthenticated: boolean;
  realRole: UserRole | null;
  effectiveRole: UserRole;
  previewRole: UserRole | null;
  isRolePreviewActive: boolean;
  authIssue: AuthBlockReason | null;
  signIn: (input: SignInInput) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
  setRolePreview: (role: UserRole | null) => void;
  clearRolePreview: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const rolePreviewStorageKey = "green-nventory-role-preview";

function isStoredPreviewRole(value: string | null): value is UserRole {
  return isUserRole(value) && value !== "admin";
}

function readRolePreviewFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(rolePreviewStorageKey);
  return isStoredPreviewRole(stored) ? stored : null;
}

function writeRolePreviewToStorage(role: UserRole | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (role) {
    window.localStorage.setItem(rolePreviewStorageKey, role);
    return;
  }

  window.localStorage.removeItem(rolePreviewStorageKey);
}

function toAppSession(
  user: {
    id: string;
    email?: string | null;
    created_at?: string | null;
    app_metadata?: Record<string, unknown> | null;
  },
  profile: ProfileRow,
): AuthSession {
  return {
    id: user.id,
    displayName: profileDisplayName(profile, user.email ?? ""),
    email: user.email ?? "",
    role: profile.role,
    lastSignedInAt: user.created_at ?? new Date().toISOString(),
    active: profile.active,
    mustChangePassword: hasMustChangePasswordFlag(user.app_metadata),
  };
}

type SessionLoadResult =
  | {
      session: AuthSession;
      issue: null;
    }
  | {
      session: null;
      issue: AuthBlockReason | null;
    };

async function loadSupabaseSession(
  supabase: ReturnType<typeof createClient>,
  setSession: (session: AuthSession | null) => void,
  setAuthIssue: (issue: AuthBlockReason | null) => void,
  currentUser?: {
    id: string;
    email?: string | null;
    created_at?: string | null;
    app_metadata?: Record<string, unknown> | null;
  },
): Promise<SessionLoadResult> {
  let userResponse: {
    user:
      | {
          id: string;
          email?: string | null;
          created_at?: string | null;
          app_metadata?: Record<string, unknown> | null;
        }
      | null;
  } = {
    user: currentUser ?? null,
  };
  let error: Error | null = null;

  if (!currentUser) {
    const response = await supabase.auth.getUser();
    userResponse = response.data;
    error = response.error;
  }

  if (error || !userResponse.user) {
    setSession(null);
    return {
      session: null,
      issue: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at, updated_at")
    .eq("id", userResponse.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    setAuthIssue("missing-profile");
    setSession(null);

    await supabase.auth.signOut().catch(() => undefined);

    return {
      session: null,
      issue: "missing-profile",
    };
  }

  if (!profile.active) {
    setAuthIssue("inactive");
    setSession(null);

    await supabase.auth.signOut().catch(() => undefined);

    return {
      session: null,
      issue: "inactive",
    };
  }

  const nextSession = toAppSession(userResponse.user, profile);

  setAuthIssue(null);
  setSession(nextSession);

  return {
    session: nextSession,
    issue: null,
  };
}

export function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storedPreviewRole, setStoredPreviewRole] = useState<UserRole | null>(
    () => readRolePreviewFromStorage(),
  );
  const [authIssue, setAuthIssue] = useState<AuthBlockReason | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeRolePreviewToStorage(storedPreviewRole);
  }, [hydrated, storedPreviewRole]);

  useEffect(() => {
    let mounted = true;
    let authStateTimeout: number | null = null;
    const safeSetSession = (nextSession: AuthSession | null) => {
      if (mounted) {
        setSession(nextSession);
      }
    };
    const safeSetAuthIssue = (issue: AuthBlockReason | null) => {
      if (mounted) {
        setAuthIssue(issue);
      }
    };

    void loadSupabaseSession(supabase, safeSetSession, safeSetAuthIssue).finally(() => {
      if (mounted) {
        setHydrated(true);
      }
    });

    const scheduleSessionReload = () => {
      if (authStateTimeout !== null) {
        window.clearTimeout(authStateTimeout);
      }

      authStateTimeout = window.setTimeout(() => {
        authStateTimeout = null;

        if (!mounted) {
          return;
        }

        void loadSupabaseSession(supabase, safeSetSession, safeSetAuthIssue);
      }, 0);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!mounted) return;
      scheduleSessionReload();
    });

    return () => {
      mounted = false;
      if (authStateTimeout !== null) {
        window.clearTimeout(authStateTimeout);
      }
      subscription.unsubscribe();
    };
  }, [supabase]);

  const realRole = session?.role ?? null;
  const effectiveRole =
    session && session.role === "admin" && storedPreviewRole
      ? storedPreviewRole
      : session?.role ?? "viewer";
  const isRolePreviewActive =
    Boolean(
      session && session.role === "admin" && storedPreviewRole && storedPreviewRole !== session.role,
    );

  const permissions = useMemo(
    () =>
      resolvePermissions({
        realRole: session?.role ?? "viewer",
        effectiveRole,
        isRolePreviewActive,
      }),
    [effectiveRole, isRolePreviewActive, session?.role],
  );

  const refreshSession = useCallback(async () => {
    const result = await loadSupabaseSession(supabase, setSession, setAuthIssue);
    return result.session;
  }, [supabase]);

  const clearRolePreview = useCallback(() => {
    setStoredPreviewRole(null);
  }, []);

  const setRolePreview = useCallback(
    (role: UserRole | null) => {
      if (!session || session.role !== "admin") {
        setStoredPreviewRole(null);
        return;
      }

      if (!role || role === "admin") {
        setStoredPreviewRole(null);
        return;
      }

      setStoredPreviewRole(role);
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthIssue(null);
    setStoredPreviewRole(null);
  }, [supabase]);

  const signIn = useCallback(
    async ({ email, password }: SignInInput) => {
      setAuthIssue(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const result = await loadSupabaseSession(
        supabase,
        setSession,
        setAuthIssue,
        data.user
          ? {
              id: data.user.id,
              email: data.user.email,
              created_at: data.user.created_at,
              app_metadata: data.user.app_metadata,
            }
          : undefined,
      );

      if (!result.session) {
        throw new Error(getAuthBlockMessage(result.issue ?? "missing-profile"));
      }

      return result.session;
    },
    [supabase],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      hydrated,
      permissions,
      isAuthenticated: Boolean(session),
      realRole,
      effectiveRole,
      previewRole: storedPreviewRole,
      isRolePreviewActive,
      authIssue,
      signIn,
      signOut,
      refreshSession,
      setRolePreview,
      clearRolePreview,
    }),
    [
      authIssue,
      clearRolePreview,
      effectiveRole,
      hydrated,
      isRolePreviewActive,
      permissions,
      storedPreviewRole,
      realRole,
      refreshSession,
      session,
      setRolePreview,
      signIn,
      signOut,
    ],
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
