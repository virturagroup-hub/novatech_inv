import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed border-white/10 bg-white/5", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
          ?
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="max-w-md text-sm text-slate-400">{description}</p>
        </div>
        {action && <div>{action}</div>}
      </CardContent>
    </Card>
  );
}
