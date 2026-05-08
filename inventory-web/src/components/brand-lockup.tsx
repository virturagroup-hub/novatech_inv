"use client";

import Image from "next/image";
import { APP_NAME, APP_SUBTITLE, COMPANY_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLockup({
  compact = false,
  className,
}: Readonly<{
  compact?: boolean;
  className?: string;
}>) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950 shadow-lg shadow-black/25">
        <Image
          src="/brand/novatech-logo.png"
          alt={`${COMPANY_NAME} logo`}
          fill
          sizes="44px"
          className="object-cover"
          priority
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-wide text-white">{APP_NAME}</p>
        {!compact && (
          <p className="truncate text-xs text-slate-400">{APP_SUBTITLE}</p>
        )}
      </div>
    </div>
  );
}

