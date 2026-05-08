import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { InventoryProvider } from "@/components/inventory-provider";
import { PwaRegister } from "@/components/pwa-register";
import { APP_DESCRIPTION, APP_NAME, APP_TITLE_TEMPLATE } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#064e3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <AuthProvider>
          <InventoryProvider>
            <AppShell>{children}</AppShell>
          </InventoryProvider>
        </AuthProvider>
        <PwaRegister />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
