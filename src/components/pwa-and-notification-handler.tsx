'use client';
import React, { useEffect } from 'react';
import { useUser, useFirestore, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export function PwaAndNotificationHandler() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const app = useFirebaseApp();
    
    useEffect(() => {
        if (isUserLoading || !user || !firestore || typeof window === 'undefined' || !app || !('serviceWorker' in navigator)) {
            return;
        }

        const setupMessaging = async () => {
            try {
                // Register service worker explicitly
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });
                
                console.log('Service Worker registered with scope:', registration.scope);

                const messaging = getMessaging(app);
                
                const permission = await window.Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log("Notification permission not granted.");
                    return;
                }

                // Pass the registration to getToken
                const currentToken = await getToken(messaging, {
                    vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('FCM Token received:', currentToken);
                    const userRef = doc(firestore, 'users', user.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(currentToken)
                    });
                }

                onMessage(messaging, (payload) => {
                    console.log('Foreground message received:', payload);
                    toast({
                        title: payload.notification?.title || "تنبيه جديد",
                        description: payload.notification?.body || "",
                    });
                });

            } catch (error) {
                console.error('An error occurred during messaging setup:', error);
            }
        };

        setupMessaging();

    }, [user, isUserLoading, firestore, toast, app]);

    return null;
}
