import React from "react";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import AuthGuard from "@/components/AuthGuard";
import {
  Package,
  Inbox,
  Layers,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";
// import '@/app/globals.css'; // Removed as .css files are not supported for manual creation

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({ children }) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";

  // Pages that don't require authentication
  const publicRoutes = [
    "/account/signin",
    "/account/signup", // Allow public signup
    "/account/logout",
    "/account/check-password-change",
    "/account/change-password",
    "/admin/make-first-admin", // Allow first-time admin setup
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {isPublicRoute ? (
        // Public routes - no auth guard or navigation
        <div className="min-h-screen flex flex-col bg-gray-50">
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      ) : (
        // Protected routes - require auth and show navigation
        <AuthGuard>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Navigation />
            <main className="flex-1 flex flex-col">{children}</main>
          </div>
        </AuthGuard>
      )}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
