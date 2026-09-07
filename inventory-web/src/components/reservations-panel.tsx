"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { createClient } from "@/lib/supabase/client";
import { isElevatedRole } from "@/lib/auth";
import type { Reservation } from "@/lib/inventory-workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReservationsPanel({ partId }: { partId: string }) {
  const { session, effectiveRole, permissions } = useAuth();
  const { isSupabaseMode, refreshInventory } = useInventory();
  const [client] = useState(createClient);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const reload = useCallback(async () => {
    if (!isSupabaseMode) return;
    const result = await client
      .from("inventory_reservations")
      .select("*")
      .eq("part_id", partId)
      .order("created_at", { ascending: false });
    if (result.error) {
      setError(
        "Reservations could not be refreshed. Availability is unconfirmed.",
      );
      return;
    }
    setRows(result.data as Reservation[]);
    setError("");
  }, [client, isSupabaseMode, partId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void reload();
    });
    window.addEventListener("focus", reload);
    return () => {
      active = false;
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  async function act(id?: string, action?: string) {
    if (busy) return;
    if (!navigator.onLine) {
      toast.error("Reservations require an online database confirmation.");
      return;
    }
    if (
      !id &&
      (!Number.isSafeInteger(Number(quantity)) || Number(quantity) <= 0)
    ) {
      toast.error("Enter a positive whole quantity.");
      return;
    }
    setBusy(true);
    try {
      const result = id
        ? await client.rpc("resolve_reservation", {
            p_id: id,
            p_action: action,
          })
        : await client.rpc("reserve_part", {
            p_part_id: partId,
            p_quantity: Number(quantity),
            p_notes: notes,
            p_request_id: requestId,
          });
      if (result.error) throw new Error(result.error.message);
      setRequestId(crypto.randomUUID());
      toast.success(
        id ? "Reservation updated" : "Reservation confirmed online",
      );
      await Promise.all([reload(), refreshInventory()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reservation failed");
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle>Reservations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-400">
          Holds do not change physical On Hand. Fulfill only when taking the
          part. Availability is confirmed by the database when you reserve.
        </p>
        {error && (
          <p role="alert" className="text-amber-300">
            {error}
          </p>
        )}
        {!isSupabaseMode ? (
          <p>Connect to the online inventory to reserve stock.</p>
        ) : (
          permissions.canAdjustStock && (
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Reservation quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                className="w-24"
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setRequestId(crypto.randomUUID());
                }}
              />
              <Input
                aria-label="Reservation notes"
                placeholder="Optional notes"
                className="min-w-40 flex-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button disabled={busy || Boolean(error)} onClick={() => act()}>
                Reserve
              </Button>
            </div>
          )
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
          >
            <div>
              <p>
                {r.quantity} · {r.actor_label} ·{" "}
                <span className="capitalize">{r.status}</span>
              </p>
              <p className="text-xs text-slate-400">
                {new Date(r.created_at).toLocaleString()} {r.notes}
              </p>
            </div>
            {r.status === "active" &&
              permissions.canAdjustStock &&
              (r.user_id === session?.id || isElevatedRole(effectiveRole)) && (
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => act(r.id, "fulfilled")}
                  >
                    Fulfill / Take
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => act(r.id, "cancelled")}
                  >
                    Cancel hold
                  </Button>
                </div>
              )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
