import type { Part } from "@/lib/inventory-types";

export function StockAvailability({ part }: { part: Part }) {
  const reserved = part.reservedQuantity;
  return (
    <span className="block text-xs leading-5">
      On Hand {part.quantityOnHand} · Reserved {reserved ?? "—"}
      <br />
      Available{" "}
      {reserved === undefined
        ? "Confirm online"
        : part.quantityOnHand - reserved}
      <span className="block text-[10px] font-normal text-slate-400">
        Last loaded · confirmed when reserving
      </span>
    </span>
  );
}
