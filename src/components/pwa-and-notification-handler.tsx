'use client';
import React, { useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

// Function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


export function PwaAndNotificationHandler() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        // Register the service worker, explicitly setting the scope to the root.
        // This is crucial for ensuring it controls all pages, especially on platforms like Vercel.
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
            console.error('Service Worker registration failed:', err);
        });

    }, []);

    useEffect(() => {
        if (isUserLoading || !user || !firestore || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }

        const subscribeUser = async () => {
            try {
                // Ensure service worker is ready
                const registration = await navigator.serviceWorker.ready;
                let subscription = await registration.pushManager.getSubscription();

                if (subscription) {
                    // Optional: Resubscribe if the endpoint changes or to refresh
                    // For now, we assume if it exists, it's valid and stored
                    return;
                }

                // If not subscribed, request permission and subscribe
                const permission = await window.Notification.requestPermission();
                if (permission !== 'granted') {
                    toast({
                        title: 'تم رفض الإشعارات',
                        description: 'لن تتمكن من تلقي إشعارات بالرسائل أو الشحنات الجديدة.',
                        variant: 'default',
                    });
                    return;
                }
                
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidKey) {
                    console.error("VAPID public key not found. Make sure NEXT_PUBLIC_VAPID_PUBLIC_KEY is set in your .env file.");
                    return;
                }

                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey),
                });
                
                // Store the new subscription in Firestore
                const subscriptionsRef = collection(firestore, `users/${user.uid}/pushSubscriptions`);
                
                // Check if this subscription endpoint already exists to avoid duplicates
                const q = query(subscriptionsRef, where("endpoint", "==", newSubscription.endpoint));
                const existingSubscriptions = await getDocs(q);
                
                if (existingSubscriptions.empty) {
                     await addDoc(subscriptionsRef, {
                        ...newSubscription.toJSON(),
                        userId: user.uid,
                        createdAt: serverTimestamp(),
                     });
                     toast({ title: 'تم تفعيل الإشعارات بنجاح!' });
                }

            } catch (error) {
                console.error('Failed to subscribe to push notifications:', error);
                toast({
                    title: 'فشل تفعيل الإشعارات',
                    description: 'حدث خطأ أثناء محاولة الاشتراك في الإشعارات. قد يكون السبب مشكلة في خدمة الإشعارات.',
                    variant: 'destructive',
                });
            }
        };

        subscribeUser();

    }, [user, isUserLoading, firestore, toast]);

    // This component does not render anything to the DOM
    return null;
}
