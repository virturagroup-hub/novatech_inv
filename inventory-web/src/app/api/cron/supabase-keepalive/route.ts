import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const timestamp = new Date().toISOString();
  try {
    const { error } = await createAdminClient()
      .from("parts")
      .select("id")
      .limit(1);
    if (error) throw error;
    return NextResponse.json(
      { ok: true, timestamp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[supabase-keepalive] Database read failed", { timestamp });
    return NextResponse.json({ ok: false, timestamp }, { status: 503 });
  }
}
