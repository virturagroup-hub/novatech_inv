import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

let adminClient: SupabaseClient | null = null;

export function createAdminClient() {
  if (!adminClient) {
    adminClient = createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return adminClient;
}
