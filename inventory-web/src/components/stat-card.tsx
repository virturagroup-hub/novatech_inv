import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "amber" | "emerald" | "rose" | "sky";
  className?: string;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-white/5 text-white border-white/10",
  amber: "bg-amber-400/10 text-amber-100 border-amber-400/20",
  emerald: "bg-emerald-400/10 text-emerald-100 border-emerald-400/20",
  rose: "bg-rose-400/10 text-rose-100 border-rose-400/20",
  sky: "bg-sky-400/10 text-sky-100 border-sky-400/20",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border-white/10 bg-white/5 shadow-lg shadow-black/10", className)}>
      <CardContent className={cn("p-4", toneClasses[tone])}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
          </div>
          {icon && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-slate-100">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

