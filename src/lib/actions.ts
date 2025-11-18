
'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
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

const sendNotificationSchema = z.object({
    recipientId: z.string(),
    title: z.string(),
    body: z.string(),
    url: z.string().optional(),
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

export async function sendPushNotification(data: z.infer<typeof sendNotificationSchema>) {
    const validation = sendNotificationSchema.safeParse(data);
    if (!validation.success) {
        console.error("Invalid notification data:", validation.error);
        return { success: false, error: 'Invalid data' };
    }
    
    const { recipientId, title, body, url } = validation.data;
    
    try {
        const app = getAdminApp();
        const db = getFirestore(app);
        const messaging = getMessaging(app);

        const subscriptionsSnap = await db.collection(`users/${recipientId}/pushSubscriptions`).get();

        if (subscriptionsSnap.empty) {
            console.log(`No push subscriptions found for user ${recipientId}`);
            return { success: true, message: 'No subscriptions to send to.' };
        }

        const subscriptions = subscriptionsSnap.docs.map(doc => doc.data());
        const notificationPayload = {
            notification: {
                title,
                body,
                icon: '/fav.png',
                click_action: url || process.env.NEXT_PUBLIC_BASE_URL || '/',
            }
        };

        const responses = [];
        for (const subscription of subscriptions) {
            try {
                // web-push library is needed to properly format and send the request
                // but we'll try with what firebase-admin provides
                const response = await messaging.send({
                    webpush: {
                        notification: {
                            title,
                            body,
                            icon: '/fav.png',
                        },
                        fcmOptions: {
                           link: url || process.env.NEXT_PUBLIC_BASE_URL || '/',
                        }
                    },
                    token: subscription.endpoint, // This is not the device token, but for web push it's what we have
                } as any); // Cast to any to bypass strict typing issues for webpush
                responses.push({ success: true, subscription: subscription.endpoint, response });
            } catch (e: any) {
                console.error(`Error sending to ${subscription.endpoint}:`, e.code);
                responses.push({ success: false, subscription: subscription.endpoint, error: e.code });
                // If a token is no longer valid, remove it from Firestore
                if (e.code === 'messaging/registration-token-not-registered') {
                    const subDoc = subscriptionsSnap.docs.find(doc => doc.data().endpoint === subscription.endpoint);
                    if(subDoc) {
                        await subDoc.ref.delete();
                        console.log(`Deleted invalid subscription: ${subscription.endpoint}`);
                    }
                }
            }
        }

        return { success: true, results: responses };

    } catch (error: any) {
        console.error(`Failed to send push notifications for user ${recipientId}:`, error);
        return { success: false, error: error.message };
    }
}
