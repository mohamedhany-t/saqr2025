
"use client";

import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import React, { useEffect } from 'react';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", weight: ['400', '700'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
          <title>AlSaqr Logistics</title>
          <meta name="description" content="Efficient Shipment Management" />
          <link rel="icon" href="/fav.png" />
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
