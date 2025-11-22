
'use server';

import { getAuth, Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { z } from 'zod';
import path from 'path';

// --- Centralized Admin App Initialization ---

// This function initializes the Firebase Admin SDK.
// It ensures that initialization happens only once.
function initializeAdminApp(): App {
    const apps = getApps();
    // Check if the app named 'admin' is already initialized.
    const adminApp = apps.find(app => app.name === 'admin');
    if (adminApp) {
        return adminApp;
    }

    try {
        // Construct the full path to the service account key file.
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        const serviceAccount = require(serviceAccountPath);
        
        // Initialize the app with a specific name 'admin' to prevent conflicts.
        return initializeApp({
            credential: cert(serviceAccount)
        }, 'admin');
    } catch (e: any) {
        console.error("Fatal: Failed to initialize Firebase Admin SDK from serviceAccountKey.json.", e);
        // This is a critical error, so we throw to stop execution.
        throw new Error("Firebase Admin SDK initialization failed. Ensure serviceAccountKey.json is present and valid.");
    }
}

// Initialize the app once when the module is loaded.
const adminApp = initializeAdminApp();

// Helper functions to get initialized services.
function getAdminAuth(): Auth {
    return getAuth(adminApp);
}

function getAdminFirestore(): Firestore {
    return getFirestore(adminApp);
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

// --- Server Actions ---

export async function createAuthUser(userData: z.infer<typeof createUserSchema>) {
    try {
        const adminAuth = getAdminAuth();
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
        const adminAuth = getAdminAuth();
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
        const adminAuth = getAdminAuth();
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
        const db = getAdminFirestore();
        
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
