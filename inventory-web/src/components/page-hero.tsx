import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-white/10 bg-white/5 px-4 py-4 shadow-2xl shadow-black/10 backdrop-blur-sm sm:px-6 sm:py-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <Badge className="border-amber-400/30 bg-amber-400/15 text-amber-200">
            {eyebrow}
          </Badge>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

