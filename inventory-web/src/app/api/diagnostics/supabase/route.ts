import { NextResponse } from "next/server";

import { getSupabaseEnvPresence } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSupabaseEnvPresence());
}
