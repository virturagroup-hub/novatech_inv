import Link from "next/link";
import { ArrowLeft, Home, Lock } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { RolePreviewPanel } from "@/components/role-preview-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildLoginPath, sanitizeInternalPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function getReasonText(reason: string | null) {
  switch (reason) {
    case "users":
      return "This area is reserved for admin user management.";
    case "settings":
      return "This area is reserved for admin-only settings.";
    case "reports":
      return "Your role cannot open reports and exports.";
    case "labels":
      return "Your role cannot print labels from this workflow.";
    case "activity":
      return "Your role cannot access the activity log.";
    case "parts":
      return "Your role cannot open this edit screen.";
    case "locations":
      return "Your role cannot edit locations.";
    case "models":
      return "Your role cannot edit models.";
    case "admin":
      return "This area is reserved for administrators.";
    default:
      return "You do not have permission to open this page.";
  }
}

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ reason?: string; next?: string }>;
}>) {
  const params = await searchParams;
  const reason = params.reason ?? null;
  const nextPath = sanitizeInternalPath(params.next);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Access denied"
        title="You do not have permission to open this area."
        description={getReasonText(reason)}
        actions={
          <>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href={buildLoginPath({ nextPath })}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sign in again
            </Link>
          </>
        }
      />

      <Card className="border-white/10 bg-white/5">
        <CardContent className="space-y-4 p-6 text-slate-300">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">Restricted area</p>
              <p className="text-sm leading-6 text-slate-300">
                Green NVentory uses role-based permissions so technicians and viewers only see the tools they need.
              </p>
              <Badge className="border-white/10 bg-white/5 text-slate-200">
                {reason ? `Reason: ${reason}` : "Permission denied"}
              </Badge>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            If you believe you should have access here, ask an admin to review your role in Supabase.
          </p>
        </CardContent>
      </Card>

      <RolePreviewPanel
        compact
        afterClearHref={nextPath || "/"}
      />
    </div>
  );
}
