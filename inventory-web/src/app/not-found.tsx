import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-4 py-10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Not found</p>
      <h1 className="text-3xl font-semibold text-white">That route does not exist.</h1>
      <p className="text-sm text-slate-400">
        Go back to the dashboard or use lookup to find the record you were after.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "default", size: "default" }),
            "bg-amber-400 text-slate-950 hover:bg-amber-300",
          )}
        >
          Dashboard
        </Link>
        <Link
          href="/lookup"
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
          )}
        >
          Lookup
        </Link>
      </div>
    </div>
  );
}
