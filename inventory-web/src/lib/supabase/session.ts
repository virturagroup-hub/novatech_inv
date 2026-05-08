import type { SupabaseClient } from "@supabase/supabase-js";

import { profileDisplayName } from "@/lib/profile-display";
import { createClient } from "./server";
import type { ProfileRow } from "./types";

export type ServerAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: ProfileRow;
};

async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
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

export async function getServerAuthContext(): Promise<ServerAuthContext | null> {
  const supabase = await createClient();
  const { data: userResult, error } = await supabase.auth.getUser();

  if (error || !userResult.user) {
    return null;
  }

  const profile = await fetchProfile(supabase, userResult.user.id);

  if (!profile) {
    return null;
  }

  return {
    supabase,
    userId: userResult.user.id,
    profile,
  };
}

export { profileDisplayName };
