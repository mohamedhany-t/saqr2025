'use client';

import { FirebaseClientProvider } from "@/firebase/client-provider";
import { PwaAndNotificationHandler } from "@/components/pwa-and-notification-handler";
import React from "react";

export function FirebaseAppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaAndNotificationHandler />
      {children}
    </>
  );
}
