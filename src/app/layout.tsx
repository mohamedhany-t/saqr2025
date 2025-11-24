
import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import React from 'react';

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
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
