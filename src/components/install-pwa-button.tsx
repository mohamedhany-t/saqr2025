
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the event type for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
        toast({
            title: "التطبيق مثبت بالفعل أو أن متصفحك لا يدعم هذه الميزة.",
            variant: "default",
        });
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast({
        title: "رائع!",
        description: "تم تثبيت التطبيق بنجاح على جهازك.",
      });
    } else {
       toast({
        title: "تم الإلغاء",
        description: "يمكنك تثبيت التطبيق لاحقًا من خلال هذا الزر.",
      });
    }

    // We can only use the prompt once, so clear it.
    setDeferredPrompt(null);
  };

  if (isAppInstalled || !deferredPrompt) {
    return null; // Don't show the button if app is installed or not supported
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleInstallClick}
      aria-label="Install App"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
