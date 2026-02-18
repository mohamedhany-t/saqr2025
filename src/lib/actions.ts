
'use server';

import { getAuth, Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import webpush, { type PushSubscription } from 'web-push';
import { z } from 'zod';

// --- Robust, On-Demand Admin App Initialization ---

let adminApp: App;
function getAdminApp(): App {
    if (adminApp) {
        return adminApp;
    }

    const appName = `admin-actions-server`;
    const existingApp = getApps().find(app => app.name === appName);
    if (existingApp) {
        adminApp = existingApp;
        return adminApp;
    }

    try {
        console.log("Attempting to initialize Firebase Admin SDK with default credentials.");
        adminApp = initializeApp({}, appName);
        console.log("Firebase Admin SDK initialized successfully with default credentials.");
        return adminApp;
    } catch (e: any) {
        console.warn(`Default credential initialization failed: ${e.message}. This is expected in local development. Falling back to service account key.`);
        
        try {
            const serviceAccountKeyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            if (!serviceAccountKeyString) {
                throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set for fallback initialization.");
            }
            
            const serviceAccount = JSON.parse(serviceAccountKeyString);
            
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }

            adminApp = initializeApp({
                credential: cert(serviceAccount)
            }, appName);
            console.log("Firebase Admin SDK initialized successfully using service account key (fallback).");
            return adminApp;

        } catch (error: any)
{
            console.error("CRITICAL: Firebase Admin SDK initialization failed completely.", error.message);
            throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
        }
    }
};

// Helper functions to get initialized services on-demand.
function getAdminAuth(): Auth {
    const app = getAdminApp();
    return getAuth(app);
}

function getAdminFirestore(): Firestore {
    const app = getAdminApp();
    return getFirestore(app);
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
    console.log("Attempting to send notification with data:", JSON.stringify(notificationData, null, 2));
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
        console.log(`Found ${recipientIds.length} recipients for ID/role: ${recipientId}`);
        }

        if (recipientIds.length === 0) {
            console.log(`No recipients found for ID/role: '${recipientId}'.`);
            return { success: true, message: "No recipients to notify." };
        }

        const allPromises = recipientIds.map(async (id) => {
            const subscriptionsSnap = await db.collection('users').doc(id).collection('pushSubscriptions').get();
            if (subscriptionsSnap.empty) {
                console.log(`No push subscriptions found for user ${id}.`);
                return [];
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


export async function settleCompanyAccount(companyId: string, paymentAmount: number, shipmentIdsToArchive: string[], settlementNote: string, adminId: string) {
    const db = getAdminFirestore();
    const BATCH_SIZE = 400; // Firestore batch limit is 500 writes
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let writeCount = 0;

    const addWrite = (batch: FirebaseFirestore.WriteBatch) => {
        writeCount++;
        if (writeCount >= BATCH_SIZE) {
            batches.push(batch);
            currentBatch = db.batch();
            writeCount = 0;
        }
        return currentBatch;
    };


    try {
        // 1. Create a settlement payment record.
        const paymentRef = db.collection('company_payments').doc();
        currentBatch.set(paymentRef, {
            companyId,
            amount: paymentAmount,
            paymentDate: FieldValue.serverTimestamp(),
            recordedById: adminId,
            notes: settlementNote,
        });
        currentBatch = addWrite(currentBatch);
        
        // 2. Move associated old payments to archive
        const paymentsSnapshot = await db.collection('company_payments').where('companyId', '==', companyId).get();
        paymentsSnapshot.forEach(doc => {
            const archivedPaymentRef = db.collection('archived_company_payments').doc(doc.id);
            currentBatch.set(archivedPaymentRef, { ...doc.data(), archivedAt: FieldValue.serverTimestamp() });
            currentBatch = addWrite(currentBatch);
            currentBatch.delete(doc.ref);
            currentBatch = addWrite(currentBatch);
        });

        // 3. Move selected shipments to archive
        for (const shipmentId of shipmentIdsToArchive) {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            const shipmentDoc = await shipmentRef.get();
            if (shipmentDoc.exists) {
                const archivedShipmentRef = db.collection('archived_company_shipments').doc(shipmentId);
                // ADDED: Record company archival time
                currentBatch.set(archivedShipmentRef, { 
                    ...shipmentDoc.data(), 
                    companyArchivedAt: FieldValue.serverTimestamp(),
                    archivedAt: FieldValue.serverTimestamp() 
                });
                currentBatch = addWrite(currentBatch);
                currentBatch.delete(shipmentRef);
                currentBatch = addWrite(currentBatch);
            }
        }

        // Add the last batch if it has any writes
        if (writeCount > 0) {
            batches.push(currentBatch);
        }

        // Commit all batches
        for (const batch of batches) {
            await batch.commit();
        }

        return { success: true, message: `تمت تسوية حساب الشركة وأرشفة ${shipmentIdsToArchive.length} شحنة بنجاح.` };

    } catch (error: any) {
        console.error("Error settling company account:", error);
        return { success: false, error: "حدث خطأ أثناء تنفيذ التسوية على الخادم." };
    }
}
