
'use server';

import { getAuth, Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import webpush, { type PushSubscription } from 'web-push';
import { z } from 'zod';

// --- Centralized Admin App Initialization ---
let adminApp: App;

// Function to get service account credentials from environment variables
const getServiceAccount = () => {
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
            console.log("FIREBASE_SERVICE_ACCOUNT_KEY not found. Attempting to use default application credentials.");
            return null;
        }
        return JSON.parse(serviceAccountKey);
    } catch (error) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
        return null;
    }
};


try {
    const serviceAccount = getServiceAccount();
    const appName = 'admin';

    // Check if the app is already initialized to prevent errors
    const existingApp = getApps().find(app => app.name === appName);

    if (!existingApp) {
        if (serviceAccount) {
            // Initialize with explicit credentials (local dev, or environments with explicit keys)
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            }, appName);
            console.log("Firebase Admin SDK initialized successfully with service account credentials.");
        } else {
             // Fallback to default credentials for environments like App Hosting
            adminApp = initializeApp({}, appName);
            console.log("Firebase Admin SDK initialized successfully with default credentials.");
        }
    } else {
        adminApp = existingApp;
    }

} catch (error) {
    console.error("Firebase Admin SDK initialization failed. This is a critical error.", error);
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
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:support@alsaqr-logistics.com',
        vapidPublicKey,
        vapidPrivateKey
    );
} else {
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
    badgeCount: z.number().optional(),
});

const companySettlementSchema = z.object({
    companyId: z.string(),
    paymentAmount: z.number(),
    shipmentIdsToArchive: z.array(z.string()),
    settlementNote: z.string(),
    adminId: z.string(),
})

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
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("Cannot send push notification because VAPID keys are not configured.");
        return { success: false, error: "VAPID keys not set on server." };
    }
    
    const validation = pushNotificationSchema.safeParse(notificationData);
    if (!validation.success) {
        console.error("Push notification validation failed:", validation.error.issues);
        return { success: false, error: JSON.stringify(validation.error.issues) };
    }

    const { recipientId, title, body, url, badgeCount } = validation.data;
    
    try {
        const db = getAdminFirestore();
        const payload = JSON.stringify({ title, body, url, badge: badgeCount });
        const options = { TTL: 60 * 60 }; // 1 hour

        const isRole = ['admin', 'company', 'courier', 'customer-service'].includes(recipientId);

        let recipientIds: string[] = [];
        
        if (isRole) {
            const roleCollectionName = `roles_${recipientId}`;
            const rolesSnapshot = await db.collection(roleCollectionName).get();
            if (!rolesSnapshot.empty) {
                recipientIds = rolesSnapshot.docs.map(doc => doc.id);
            }
        } else {
            recipientIds.push(recipientId);
        }

        if (recipientIds.length === 0) {
            console.log(`No recipients found for ID/role: '${recipientId}'.`);
            return { success: true, message: `No recipients to notify.` };
        }

        const allPromises = recipientIds.map(async (id) => {
            const subscriptionsSnap = await db.collection(`users/${id}/pushSubscriptions`).get();
            if (subscriptionsSnap.empty) {
                console.log(`No push subscriptions found for user ${id}.`);
                return;
            }
            
            const userPromises = subscriptionsSnap.docs.map(doc => {
                const subscription = doc.data() as PushSubscription;
                return webpush.sendNotification(subscription, payload, options).catch(error => {
                    console.error(`Error sending notification to endpoint for user ${id}:`, error.statusCode, error.body);
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        console.log(`Subscription for user ${id} is invalid. Deleting.`);
                        return doc.ref.delete();
                    }
                });
            });
            return Promise.all(userPromises);
        });
        
        await Promise.all(allPromises);
        
        return { success: true, message: "Notifications dispatched." };

    } catch (error: any) {
        console.error("Failed to send push notification:", error);
        return { success: false, error: error.message };
    }
}

export async function settleCompanyAccount(data: z.infer<typeof companySettlementSchema>) {
    const validation = companySettlementSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: JSON.stringify(validation.error.issues) };
    }
    const { companyId, paymentAmount, shipmentIdsToArchive, settlementNote, adminId } = validation.data;

    const db = getAdminFirestore();
    const batch = db.batch();

    if (paymentAmount !== 0) {
        const paymentRef = db.collection('company_payments').doc();
        batch.set(paymentRef, {
            companyId,
            amount: paymentAmount,
            paymentDate: FieldValue.serverTimestamp(),
            recordedById: adminId,
            notes: settlementNote,
            isArchived: true,
        });
    }

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
