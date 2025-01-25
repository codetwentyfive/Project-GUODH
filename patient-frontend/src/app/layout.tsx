import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { CallProvider } from "@/contexts/CallContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareCall Patient Portal",
  description: "Connect with your healthcare providers through secure video calls",
  keywords: "healthcare, telemedicine, video calls, patient care",
  authors: [{ name: "CareCall" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className={`${inter.className} h-full`}>
        <CallProvider>
          <div className="min-h-full">
            <header className="bg-white shadow-sm">
              <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex items-center">
                    <Link href="/" className="flex items-center">
                      <span className="text-2xl font-semibold text-indigo-600">CareCall</span>
                    </Link>
                  </div>
                  <div className="flex items-center">
                    <div className="hidden md:block">
                      <div className="flex items-center space-x-4">
                        <Link href="/profile" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                          Profile
                        </Link>
                        <Link href="/settings" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                          Settings
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </nav>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
              {children}
            </main>

            <footer className="bg-white mt-auto">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <div className="border-t border-gray-200 pt-8">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      &copy; {new Date().getFullYear()} CareCall. All rights reserved.
                    </p>
                  </div>
                </div>
              </div>
            </footer>
          </div>
          <Toaster position="top-right" />
        </CallProvider>
      </body>
    </html>
  );
}
