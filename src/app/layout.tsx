
"use client";

import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import React, { useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", weight: ['400', '700'] });

// export const metadata: Metadata = {
//   title: "AlSaqr Logistics",
//   description: "Efficient Shipment Management",
//   manifest: "/manifest.json",
//   icons: {
//     icon: '/fav.png',
//     apple: '/fav.png',
//   },
// };

function PwaAndNotificationHandler() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, []);

  useEffect(() => {
    if (isUserLoading || !user || !firestore || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    if (Notification.permission === 'granted') {
      subscribeUserToPush();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          subscribeUserToPush();
        }
      });
    }
  }, [user, isUserLoading, firestore]);

  const subscribeUserToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BHF_m_P2-2kYnF22J2Kj2-Dm_gW7-B2qK9kF8Yvj1zc7kX_K5Zz3_zJ3jZ_X6c9Q4jC2hA2bZ_J3gY_k4V6nCgA'),
      });
      
      const subscriptionJson = subscription.toJSON();

      // Store the subscription in Firestore
      const subRef = doc(firestore, `users/${user.uid}/pushSubscriptions`, subscriptionJson.endpoint!.substring(0, 100));
      await setDoc(subRef, {
        ...subscriptionJson,
        createdAt: new Date(),
        userId: user.uid,
      });

      console.log('User is subscribed.');

    } catch (error) {
      console.error('Failed to subscribe the user: ', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };
  
  return null; // This component does not render anything
}


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
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" href="/fav.png" />
          <link rel="apple-touch-icon" href="/fav.png"/>
          <meta name="theme-color" content="#8AB4B0" />
      </head>
      <body className={`${inter.variable} ${cairo.variable} font-headline`}>
        <FirebaseClientProvider>
          <PwaAndNotificationHandler />
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
