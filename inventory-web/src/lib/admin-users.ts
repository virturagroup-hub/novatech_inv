import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import type { ProfileRow } from "@/lib/supabase/types";

export type AdminUserRecord = ProfileRow & {
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  auth_email: string | null;
};

export function mergeAdminUsers(users: ProfileRow[], authUsers: SupabaseAuthUser[]): AdminUserRecord[] {
  const authById = new Map(authUsers.map((user) => [user.id, user]));

  return users.map((user) => {
    const authUser = authById.get(user.id);

    return {
      ...user,
      auth_created_at: authUser?.created_at ?? null,
      auth_email: authUser?.email ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
    };
  });
}
