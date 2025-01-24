import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { CallProvider } from "@/contexts/CallContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareCall Caretaker Dashboard",
  description: "Dashboard for managing patient calls",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.className
      )}>
        <CallProvider>
          {children}
        </CallProvider>
      </body>
    </html>
  );
}
