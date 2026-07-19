import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TribeOS",
  description: "Internal ERP platform for Tribe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <QueryProvider>
            <AppShell>{children}</AppShell>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
