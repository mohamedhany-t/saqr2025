
'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';


// --- Function to get the service account credentials ---
function getServiceAccount() {
  // Prio 1: Environment variable (for production on Vercel, etc.)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      // The value is expected to be a base64 encoded string of the JSON file
      const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
      return JSON.parse(decodedKey);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment variable.", e);
      // Fall through to try reading from file
    }
  }

  // Prio 2: Filesystem (for local development)
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
      return JSON.parse(fileContents);
    }
  } catch (e) {
    console.error("Error reading serviceAccountKey.json from filesystem.", e);
  }

  // If neither method works, we cannot proceed.
  throw new Error("Firebase Admin SDK credentials not found. Ensure FIREBASE_SERVICE_ACCOUNT_KEY env var is set or serviceAccountKey.json exists.");
}


// --- Reliable Admin App Initializer ---
let adminApp: App | null = null;
function getAdminApp(): App {
    if (adminApp) {
        return adminApp;
    }
    
    const serviceAccount = getServiceAccount();
    
    // If multiple apps are not needed, you can use a unique name
    const appName = `firebase-admin-app-${Date.now()}`;

    if (getApps().length === 0) {
       adminApp = initializeApp({
          credential: cert(serviceAccount)
       });
    } else {
        // This case is less likely if we manage the singleton `adminApp`
        // but as a fallback, we get the default app.
        adminApp = getApps()[0];
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
