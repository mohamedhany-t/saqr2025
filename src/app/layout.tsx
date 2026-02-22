
import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { FirebaseAppShell } from "@/components/firebase-app-shell";
import React, { Suspense } from 'react';
import { Loader2 } from "lucide-react";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", weight: ['400', '700'] });

export const metadata: Metadata = {
  title: "AlSaqr Logistics",
  description: "Efficient Shipment Management",
  manifest: "/manifest.json",
  icons: {
    icon: "/fav.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
          <meta name="theme-color" content="#5F9EA0" />
      </head>
      <body className={`${inter.variable} ${cairo.variable} font-headline`}>
        <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <FirebaseClientProvider>
                <FirebaseAppShell>
                    {children}
                </FirebaseAppShell>
            </FirebaseClientProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
