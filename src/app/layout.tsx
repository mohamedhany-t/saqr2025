
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
         <style>
          {`
            @media print {
              body, html {
                margin: 0;
                padding: 0;
                height: 100%;
              }
              body > *:not(#printable-area) {
                display: none;
              }
              #printable-area {
                display: block;
                height: 100%;
                width: 100%;
                position: absolute;
                left: 0;
                top: 0;
              }
               @page {
                size: A4;
                margin: 0;
              }
              .page-break {
                 page-break-after: always;
              }
            }
          `}
        </style>
      </head>
      <body className="font-body antialiased">
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
