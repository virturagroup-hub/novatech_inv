"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SESSION_STORAGE_KEY } from "@/lib/brand";
import {
  type AuthSession,
  createSession,
  getPermissions,
  type PermissionSet,
  type UserRole,
} from "@/lib/auth";

type SignInInput = {
  displayName: string;
  email: string;
  role: UserRole;
};

type AuthContextValue = {
  session: AuthSession | null;
  hydrated: boolean;
  permissions: PermissionSet;
  isAuthenticated: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function safeParseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      parsed &&
      typeof parsed.displayName === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.role === "string" &&
      typeof parsed.lastSignedInAt === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(safeParseSession(window.localStorage.getItem(SESSION_STORAGE_KEY)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [hydrated, session]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = session ? getPermissions(session.role) : getPermissions("viewer");

    return {
      session,
      hydrated,
      permissions,
      isAuthenticated: Boolean(session),
      signIn: async ({ displayName, email, role }) => {
        setSession(
          createSession({
            displayName,
            email,
            role,
          }),
        );
      },
      signOut: () => setSession(null),
    };
  }, [hydrated, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
