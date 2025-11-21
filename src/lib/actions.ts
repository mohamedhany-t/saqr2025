
'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { z } from 'zod';

// This is a workaround to use service account credentials in a Vercel-like environment
function getServiceAccount() {
  try {
    // This will work in local development
    return require('../../serviceAccountKey.json');
  } catch (e) {
    // In a Vercel/production environment, parse the environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", parseError);
        return null;
      }
    }
    console.error("Service account key not found. Please set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable or place serviceAccountKey.json in the root.");
    return null;
  }
}

// --- Zod Schemas for Input Validation ---
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

const updateUserPasswordSchema = z.object({
    uid: z.string().min(1),
    password: z.string().min(6),
});

const deleteUserSchema = z.object({
    uid: z.string().min(1),
});

const pushNotificationSchema = z.object({
    recipientId: z.string(),
    title: z.string(),
    body: z.string(),
    url: z.string().url(),
});

// --- Reliable Admin App Initializer ---
function getAdminApp(): App {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      throw new Error("Firebase Admin SDK credentials not found or are invalid.");
    }
    
    if (getApps().length > 0) {
        return getApps()[0];
    }
    
    return initializeApp({
      credential: cert(serviceAccount)
    });
}


export async function createAuthUser(userData: z.infer<typeof createUserSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        const userRecord = await adminAuth.createUser({
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
        });
        return { success: true, uid: userRecord.uid };
    } catch (error: any) {
        console.error("Error creating auth user:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}


export async function updateAuthUserPassword(userData: z.infer<typeof updateUserPasswordSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        await adminAuth.updateUser(userData.uid, {
            password: userData.password,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user password:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}

export async function deleteAuthUser(userData: z.infer<typeof deleteUserSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        await adminAuth.deleteUser(userData.uid);
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}


export async function sendPushNotification(notificationData: z.infer<typeof pushNotificationSchema>) {
    const { recipientId, title, body, url } = pushNotificationSchema.parse(notificationData);
    
    // IMPORTANT: You must set these environment variables in your deployment environment.
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("VAPID keys are not configured. Skipping push notification.");
        return { success: false, error: "VAPID keys not set on server." };
    }
    
    webpush.setVapidDetails(
        'mailto:your-email@example.com', // Replace with your contact email
        vapidPublicKey,
        vapidPrivateKey
    );
    
    try {
        const app = getAdminApp();
        const db = getFirestore(app);
        
        const subscriptionsSnap = await db.collection(`users/${recipientId}/pushSubscriptions`).get();
        if (subscriptionsSnap.empty) {
            console.log(`No push subscriptions found for user ${recipientId}.`);
            return { success: true, message: "No push subscriptions found for user." };
        }
        
        const payload = JSON.stringify({ title, body, url });

        const promises = subscriptionsSnap.docs.map(doc => {
            const subscription = doc.data();
            return webpush.sendNotification(subscription, payload).catch(error => {
                console.error(`Error sending notification to endpoint for user ${recipientId}:`, error.statusCode, error.body);
                // If subscription is expired or invalid, delete it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`Subscription for user ${recipientId} is invalid. Deleting.`);
                    return doc.ref.delete();
                }
            });
        });
        
        await Promise.all(promises);
        
        return { success: true };

    } catch (error: any) {
        console.error("Failed to send push notification:", error);
        return { success: false, error: error.message };
    }
}
