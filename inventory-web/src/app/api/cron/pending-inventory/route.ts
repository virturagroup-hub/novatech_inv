import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const timestamp = new Date().toISOString();
  try {
    const { data, error } = await createAdminClient().rpc(
      "notify_pending_inventory",
    );
    if (error) throw error;
    return NextResponse.json(
      { ok: true, pending: data, timestamp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[pending-inventory] Daily notice failed", { timestamp });
    return NextResponse.json({ ok: false, timestamp }, { status: 503 });
  }
}
