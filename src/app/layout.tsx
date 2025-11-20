
"use client";

import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import React, { useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", weight: ['400', '700'] });

function PwaAndNotificationHandler() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

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

  const subscribeUserToPush = async () => {
    try {
      const vapidKey = "BLG2BQxTEoSiIqvV-oIAuSkAXiVmiS7sHSERBiWiYz9rXIaEkT0sTDQj0MwjHq-oTQO3CneVA-KV8QMqenKmtiA";
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // If subscription exists but with a different key, unsubscribe
      if (subscription && subscription.options.applicationServerKey) {
        const existingKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.options.applicationServerKey))));
        const newKey = btoa(String.fromCharCode.apply(null, Array.from(applicationServerKey)));
        if (existingKey !== newKey) {
          console.log('Application server key mismatch, unsubscribing...');
          await subscription.unsubscribe();
          subscription = null; // Set to null to re-subscribe
        }
      }

      // If no subscription, create one
      if (!subscription) {
          console.log('No existing subscription, creating new one...');
          subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: applicationServerKey,
          });
      }
      
      const subscriptionJson = subscription.toJSON();
      if (!subscriptionJson.endpoint) {
          console.error("Subscription endpoint is null.");
          return;
      }

      const subId = btoa(subscriptionJson.endpoint).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      const subRef = doc(firestore, `users/${user.uid}/pushSubscriptions`, subId);
      await setDoc(subRef, {
        ...subscriptionJson,
        createdAt: serverTimestamp(),
        userId: user.uid,
      }, { merge: true });

      console.log('User is subscribed.');

    } catch (error) {
      console.error('Failed to subscribe the user: ', error);
    }
  };


  useEffect(() => {
    if (isUserLoading || !user || !firestore || !('Notification'in window) || !('serviceWorker' in navigator)) {
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

    