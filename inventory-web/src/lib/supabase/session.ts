import type { SupabaseClient } from "@supabase/supabase-js";

import { profileDisplayName } from "@/lib/profile-display";
import type { AuthBlockReason } from "@/lib/auth";
import { createClient } from "./server";
import type { ProfileRow } from "./types";

export type ServerAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: ProfileRow;
};

export type ServerAuthResolution =
  | {
      state: "authenticated";
      context: ServerAuthContext;
    }
  | {
      state: "missing-session" | "missing-profile" | "inactive";
      context: null;
      reason: AuthBlockReason | null;
    };

async function fetchProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ProfileRow;
}

export async function getServerAuthResolution(): Promise<ServerAuthResolution> {
  const supabase = await createClient();
  const { data: userResult, error } = await supabase.auth.getUser();

  if (error || !userResult.user) {
    return {
      state: "missing-session",
      context: null,
      reason: null,
    };
  }

  const profile = await fetchProfile(supabase, userResult.user.id);

  if (!profile) {
    return {
      state: "missing-profile",
      context: null,
      reason: "missing-profile",
    };
  }

  if (!profile.active) {
    return {
      state: "inactive",
      context: null,
      reason: "inactive",
    };
  }

  return {
    state: "authenticated",
    context: {
      supabase,
      userId: userResult.user.id,
      profile,
    },
  };
}

export async function getServerAuthContext(): Promise<ServerAuthContext | null> {
  const resolution = await getServerAuthResolution();

  return resolution.state === "authenticated" ? resolution.context : null;
}

export { profileDisplayName };
