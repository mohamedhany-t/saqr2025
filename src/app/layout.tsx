
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlSaqr Logistics",
  description: "Efficient Shipment Management",
  manifest: "/manifest.json",
  icons: {
    icon: '/fav.png',
    apple: '/fav.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        <div id="printable-area">
          <FirebaseClientProvider>
            {children}
          </FirebaseClientProvider>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
