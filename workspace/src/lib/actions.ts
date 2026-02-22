
'use server';

import { getAuth, Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import webpush, { type PushSubscription } from 'web-push';
import { z } from 'zod';

// --- Centralized Admin App Initialization ---
let adminApp: App;

try {
    // This is the recommended way for Google Cloud environments like App Hosting.
    // It automatically uses the service account associated with the environment.
    adminApp = getApps().find(app => app.name === 'admin') || initializeApp({}, 'admin');
    console.log("Firebase Admin SDK initialized successfully with default credentials.");
} catch (error) {
    console.error("Firebase Admin SDK initialization failed. This is a critical error.", error);
    // In a real-world scenario, you might want to throw an error here
    // or have a fallback for local development if needed, but for App Hosting,
    // this should work out of the box if permissions are set correctly.
}


// Helper functions to get initialized services.
function getAdminAuth(): Auth {
    if (!adminApp) throw new Error("Admin App not initialized");
    return getAuth(adminApp);
}

function getAdminFirestore(): Firestore {
    if (!adminApp) throw new Error("Admin App not initialized");
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
    
    const validation = pushNotificationSchema.safeParse(notificationData);
    if (!validation.success) {
        console.error("Push notification validation failed:", validation.error.issues);
        return { success: false, error: JSON.stringify(validation.error.issues) };
    }

    const { recipientId, title, body, url } = validation.data;
    
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
        
        return { success: true, message: "Notifications dispatched." };

    } catch (error: any) {
        console.error("Failed to send push notification:", error);
        return { success: false, error: error.message };
    }
}

export async function settleCompanyAccount(companyId: string, paymentAmount: number, shipmentIdsToArchive: string[], settlementNote: string, adminId: string) {
    const db = getAdminFirestore();
    const batch = db.batch();

    // 1. Create a settlement payment record.
    const paymentRef = db.collection('company_payments').doc();
    batch.set(paymentRef, {
        companyId,
        amount: paymentAmount,
        paymentDate: new Date(),
        recordedById: adminId,
        notes: settlementNote,
        isArchived: true, // Archive settlement payment immediately
    });

    // 2. Archive the selected shipments for the company.
    shipmentIdsToArchive.forEach(shipmentId => {
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        batch.update(shipmentRef, { isArchivedForCompany: true });
    });

    try {
        await batch.commit();
        return { success: true, message: `تمت تسوية حساب الشركة وأرشفة ${shipmentIdsToArchive.length} شحنة بنجاح.` };
    } catch (error: any) {
        console.error("Error settling company account:", error);
        return { success: false, error: "حدث خطأ أثناء تنفيذ التسوية على الخادم." };
    }
}
