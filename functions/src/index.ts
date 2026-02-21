
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import type { User, Shipment, ShipmentStatusConfig, ShipmentHistory, ShipmentHistoryEntry } from "./types";
import { sendNotificationToUser } from "./notifications";

try {
    admin.initializeApp();
} catch (e) {
    if (!/already exists/.test((e as Error).message)) {
        console.error('Firebase admin initialization error', e);
    }
}

const db = admin.firestore();

const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string().optional(),
    reason: z.string().optional(),
    collectedAmount: z.coerce.number().optional(),
    requestedAmount: z.coerce.number().optional(),
    amountChangeReason: z.string().optional(),
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    address: z.string().optional(),
    totalAmount: z.coerce.number().optional(),
    governorateId: z.string().optional(),
    assignedCourierId: z.string().optional(),
    companyId: z.string().optional(),
    orderNumber: z.string().optional(),
    isWarehouseReturn: z.boolean().optional(),
    isReturnedToCompany: z.boolean().optional(),
    isReturningToCompany: z.boolean().optional(),
    isArchivedForCourier: z.boolean().optional(),
    isArchivedForCompany: z.boolean().optional(),
    senderName: z.string().optional(),
    isCustomReturn: z.boolean().optional(),
    retryAttempt: z.boolean().optional(),
    isLabelPrinted: z.boolean().optional(),
    isUrgent: z.boolean().optional(),
    isExchange: z.boolean().optional(),
    shipmentCode: z.string().optional(),
    createdAt: z.any().optional(),
    isPriceChangeDecision: z.boolean().optional(),
});

const runtimeOpts: functions.RuntimeOptions = {
    timeoutSeconds: 540,
    memory: '256MB',
};

// Converted to onCall for better compatibility with Firebase SDK
export const handleShipmentUpdate = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called with an authenticated user.');
    }
    
    const userId = context.auth.uid;
    const userName = context.auth.token.name || context.auth.token.email;

    const validation = updateShipmentStatusSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError('invalid-argument', 'The data provided is invalid.');
    }

    const { shipmentId, ...updatePayload } = validation.data;
    const shipmentRef = db.collection('shipments').doc(shipmentId);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const shipmentDoc = await transaction.get(shipmentRef);
            const isCreating = !shipmentDoc.exists;
            const oldData: Partial<Shipment> = isCreating ? {} : shipmentDoc.data() as Shipment;

            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) throw new Error("User profile not found.");
            const userProfile = userDoc.data() as User;
            
            // Authorization logic
            let isAuthorized = false;
            if (userProfile.role === 'admin' || userProfile.role === 'customer-service') isAuthorized = true;
            else if (isCreating && userProfile.role === 'company') isAuthorized = true;
            else if (!isCreating) {
                if(userProfile.role === 'courier' && oldData.assignedCourierId === userId) isAuthorized = true;
                if (userProfile.role === 'company' && oldData.companyId === userId) isAuthorized = true;
            }

            if (!isAuthorized) throw new Error("Unauthorized access.");
            
            let finalUpdateData: { [key: string]: any } = { ...updatePayload };

            // Tracking dates
            if (updatePayload.assignedCourierId !== undefined && updatePayload.assignedCourierId !== (oldData.assignedCourierId || null)) {
                if (updatePayload.assignedCourierId) finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.serverTimestamp();
                else finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.delete();
            }

            if (updatePayload.status && updatePayload.status !== oldData.status) {
                finalUpdateData.retryAttempt = false;
                const statusesSnap = await db.collection('shipment_statuses').get();
                const statusConfigs = statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShipmentStatusConfig[];
                const newStatusConfig = statusConfigs.find(s => s.id === updatePayload.status);

                if (newStatusConfig) {
                    let paidAmount = 0;
                    const totalAmount = finalUpdateData.totalAmount ?? oldData.totalAmount ?? 0;
                    const collectedAmount = finalUpdateData.collectedAmount ?? 0;
                    if (newStatusConfig.requiresFullCollection) paidAmount = totalAmount;
                    else if (newStatusConfig.requiresPartialCollection) paidAmount = collectedAmount;
                    finalUpdateData.paidAmount = paidAmount;
                    finalUpdateData.collectedAmount = paidAmount;

                    if (newStatusConfig.affectsCourierBalance) {
                        const courierId = finalUpdateData.assignedCourierId || oldData.assignedCourierId;
                        if (courierId) {
                            const courierProfileDoc = await db.collection('couriers').doc(courierId).get();
                            finalUpdateData.courierCommission = courierProfileDoc?.exists ? (courierProfileDoc.data() as any).commissionRate || 0 : 0;
                        }
                    } else finalUpdateData.courierCommission = 0;
                }
            }
            
            const newData = { ...oldData, ...finalUpdateData };
            let notification = null;
            
            // Check for changes and prepare notification
            const courierId = newData.assignedCourierId;
            if (courierId && userId !== courierId && (userProfile.role === 'admin' || userProfile.role === 'customer-service')) {
                let title = "تحديث في شحنة";
                let body = `تم تحديث بيانات الشحنة: ${newData.recipientName}`;
                let shouldNotify = false;

                if (updatePayload.assignedCourierId && updatePayload.assignedCourierId !== oldData.assignedCourierId) {
                    title = "شحنة جديدة";
                    body = `تم تعيين شحنة جديدة لك: ${newData.recipientName}`;
                    shouldNotify = true;
                } else if (updatePayload.status && updatePayload.status !== oldData.status) {
                    body = `تم تغيير حالة الشحنة (${newData.recipientName}) إلى ${updatePayload.status}`;
                    shouldNotify = true;
                } else if (updatePayload.retryAttempt) {
                    title = "إعادة محاولة توصيل";
                    body = `طلب إعادة محاولة للشحنة: ${newData.recipientName}`;
                    shouldNotify = true;
                } else if (updatePayload.address || updatePayload.recipientPhone) {
                    shouldNotify = true;
                }

                if (shouldNotify) {
                    notification = { userId: courierId, title, body, url: `/?edit=${shipmentId}` };
                }
            }
            
            if (isCreating) {
                finalUpdateData.createdAt = finalUpdateData.createdAt || admin.firestore.FieldValue.serverTimestamp();
                finalUpdateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                transaction.set(shipmentRef, finalUpdateData);
            } else {
                finalUpdateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                transaction.update(shipmentRef, finalUpdateData);
            }

            return { success: true, notification };
        });

        if (result.notification) {
            await sendNotificationToUser(result.notification.userId, result.notification.title, result.notification.body, result.notification.url);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating shipment:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const executeCompanySettlement = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Unauthenticated');
    const { companyId, paymentAmount, shipmentIdsToArchive, settlementNote } = data;
    const adminId = context.auth.uid;
    const batch = db.batch();
    try {
        const paymentRef = db.collection('company_payments').doc();
        batch.set(paymentRef, { companyId, amount: paymentAmount, paymentDate: admin.firestore.FieldValue.serverTimestamp(), recordedById: adminId, notes: settlementNote || 'تسوية عبر شيت', isArchived: true });
        for (const shipmentId of shipmentIdsToArchive) batch.update(db.collection('shipments').doc(shipmentId), { isArchivedForCompany: true, companyArchivedAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
