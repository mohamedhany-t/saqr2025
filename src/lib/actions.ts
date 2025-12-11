
'use server';

import { getAuth, Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import webpush, { type PushSubscription } from 'web-push';
import { z } from 'zod';

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

    // Recommended method for Vercel and other environments: Use Environment Variable
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountString) {
        try {
            const serviceAccount = JSON.parse(serviceAccountString);
            return initializeApp({
                credential: cert(serviceAccount)
            }, 'admin');
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Please ensure it is a valid JSON string.', e);
            throw new Error('Could not initialize Firebase Admin SDK due to invalid service account key.');
        }
    }

    // Fallback for Google Cloud environments (like Cloud Run used by Firebase App Hosting)
    // where Application Default Credentials are automatically available.
    try {
        console.log("Attempting to initialize Firebase Admin with default credentials...");
        return initializeApp({}, 'admin');
    } catch(e) {
        console.error("Default Firebase Admin initialization failed. Ensure you have set up Application Default Credentials or the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.", e);
        // If all initialization methods fail, we throw an error to prevent the app from running with a misconfigured admin SDK.
        throw new Error("Could not initialize Firebase Admin SDK. Please check server logs for details.");
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

// --- VAPID Keys Initialization ---
// Configure web-push once when the module is loaded.
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    console.log("VAPID keys found, configuring web-push.");
    webpush.setVapidDetails(
        'mailto:support@alsaqr-logistics.com',
        vapidPublicKey,
        vapidPrivateKey
    );
} else {
    // This log will appear in the server logs (Vercel Functions logs) if keys are missing
    console.error("VAPID keys are NOT set on the server. Push notifications will fail.");
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
    // VAPID keys are now checked and set at the module level.
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("Cannot send push notification because VAPID keys are not configured.");
        return { success: false, error: "VAPID keys not set on server." };
    }

    const { recipientId, title, body, url } = pushNotificationSchema.parse(notificationData);
    
    try {
        const db = getAdminFirestore();
        let recipientIds: string[] = [];

        // If recipientId is a role (like 'admin'), fetch all user IDs with that role
        if (['admin', 'company', 'courier', 'customer-service'].includes(recipientId)) {
            const roleCollectionName = `roles_${recipientId}`;
            const rolesSnapshot = await db.collection(roleCollectionName).get();
            if (!rolesSnapshot.empty) {
                recipientIds = rolesSnapshot.docs.map(doc => doc.id);
            } else {
                 console.log(`No users found with role '${recipientId}'.`);
                 return { success: true, message: `No users found with role '${recipientId}'.` };
            }
        } else {
            // It's a specific user ID
            recipientIds.push(recipientId);
        }
        
        const payload = JSON.stringify({ title, body, url });

        const allPromises: Promise<any>[] = [];

        for (const id of recipientIds) {
            const subscriptionsSnap = await db.collection(`users/${id}/pushSubscriptions`).get();
            if (subscriptionsSnap.empty) {
                console.log(`No push subscriptions found for user ${id}.`);
                continue;
            }
            
            const userPromises = subscriptionsSnap.docs.map(doc => {
                const subscription = doc.data() as PushSubscription;
                return webpush.sendNotification(subscription, payload).catch(error => {
                    console.error(`Error sending notification to endpoint for user ${id}:`, error.statusCode, error.body);
                    // If subscription is expired or invalid, delete it
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        console.log(`Subscription for user ${id} is invalid. Deleting.`);
                        return doc.ref.delete();
                    }
                });
            });
            allPromises.push(...userPromises);
        }
        
        await Promise.all(allPromises);
        
        return { success: true };

    } catch (error: any) {
        console.error("Failed to send push notification:", error);
        return { success: false, error: error.message };
    }
}
