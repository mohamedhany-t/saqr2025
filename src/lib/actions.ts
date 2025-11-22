
'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { z } from 'zod';

// --- Admin App Initializer ---
let adminApp: App | null = null;

function getAdminApp(): App {
    if (adminApp) {
        return adminApp;
    }

    const serviceAccountKeyFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKeyFromEnv) {
        try {
            const serviceAccount = JSON.parse(Buffer.from(serviceAccountKeyFromEnv, 'base64').toString('utf-8'));
            if (getApps().length === 0) {
                adminApp = initializeApp({
                    credential: cert(serviceAccount)
                });
            } else {
                adminApp = getApps()[0];
            }
        } catch (e: any) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment variable:", e.message);
            throw new Error("Firebase Admin SDK initialization failed due to invalid environment variable.");
        }
    } else {
        try {
            // Fallback to reading the file if the env var is not set (for local development)
            const serviceAccount = require('../../../serviceAccountKey.json');
            if (getApps().length === 0) {
                adminApp = initializeApp({
                    credential: cert(serviceAccount)
                });
            } else {
                adminApp = getApps()[0];
            }
        } catch (e: any) {
            console.error("Failed to initialize Firebase Admin SDK from serviceAccountKey.json:", e.message);
            throw new Error("Firebase Admin SDK initialization failed. Ensure serviceAccountKey.json exists or FIREBASE_SERVICE_ACCOUNT_KEY is set.");
        }
    }
    
    if (!adminApp) {
        throw new Error("Could not initialize Firebase Admin App.");
    }
    
    return adminApp;
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
    
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("VAPID keys are not set on the server. Skipping push notification.");
        return { success: false, error: "VAPID keys not set on server." };
    }
    
    webpush.setVapidDetails(
        'mailto:support@alsaqr-logistics.com',
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
