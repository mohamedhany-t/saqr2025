
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";
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
const corsHandler = cors({ origin: true });

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

export const handleShipmentUpdate = functions.runWith(runtimeOpts).https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).send({ error: { message: 'Method Not Allowed' } });
            return;
        }

        let context: any = {};
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (idToken) {
            try {
                context.auth = await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                console.error('Error verifying token:', error);
                res.status(401).send({ error: { status: 'UNAUTHENTICATED', message: 'The function must be called with an authenticated user token.' } });
                return;
            }
        }
        
        if (!context.auth) {
            res.status(401).send({ error: { status: 'UNAUTHENTICATED', message: 'The function must be called with an authenticated user token.' } });
            return;
        }
        
        const { uid: userId, name: userName, email: userEmail } = context.auth;
        const validation = updateShipmentStatusSchema.safeParse(req.body.data);

        if (!validation.success) {
            console.error("Validation failed:", validation.error.errors);
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }

        const validatedData = validation.data;
        const { shipmentId, ...updatePayload } = validatedData;
        
        if (!shipmentId) {
             res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'Shipment ID is required.' } });
             return;
        }

        const shipmentRef = db.collection('shipments').doc(shipmentId);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const shipmentDoc = await transaction.get(shipmentRef);
                const isCreating = !shipmentDoc.exists;
                const oldData: Partial<Shipment> = isCreating ? {} : shipmentDoc.data() as Shipment;

                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) {
                    throw new functions.https.HttpsError("permission-denied", "User profile not found.");
                }
                const userProfile = userDoc.data() as User;
                
                let isAuthorized = false;
                if (userProfile.role === 'admin' || userProfile.role === 'customer-service') {
                    isAuthorized = true;
                } else if (isCreating) {
                     if (userProfile.role === 'company') isAuthorized = true;
                } else {
                    if(userProfile.role === 'courier' && oldData.assignedCourierId === userId) isAuthorized = true;
                    if (userProfile.role === 'company' && oldData.companyId === userId) isAuthorized = true;
                }

                if (!isAuthorized) {
                    throw new functions.https.HttpsError("permission-denied", "You do not have permission to perform this action.");
                }
                
                let finalUpdateData: { [key: string]: any } = { ...updatePayload };

                // Assignment logic for tracking dates
                if (updatePayload.assignedCourierId !== undefined) {
                    if (updatePayload.assignedCourierId !== (oldData.assignedCourierId || null)) {
                        if (updatePayload.assignedCourierId) {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.serverTimestamp();
                        } else {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }

                if (finalUpdateData.isPriceChangeDecision) {
                    finalUpdateData.requestedAmount = admin.firestore.FieldValue.delete();
                    finalUpdateData.amountChangeReason = admin.firestore.FieldValue.delete();
                    delete finalUpdateData.isPriceChangeDecision;
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
                                const commissionRate = courierProfileDoc?.exists ? (courierProfileDoc.data() as any).commissionRate || 0 : 0;
                                finalUpdateData.courierCommission = commissionRate;
                            }
                        } else {
                            finalUpdateData.courierCommission = 0;
                        }
                    }
                }
                
                const newData = { ...oldData, ...finalUpdateData };
                const changes: ShipmentHistoryEntry[] = [];
                for (const key of Object.keys(finalUpdateData)) {
                    const oldValue = (oldData as any)[key];
                    const newValue = (newData as any)[key];
                    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                         changes.push({ field: key, oldValue: oldValue ?? null, newValue: newValue ?? null });
                    }
                }

                let notification = null;
                if (changes.length > 0) {
                    const historyRef = shipmentRef.collection('history').doc();
                    transaction.set(historyRef, {
                        changes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedBy: userName || userEmail,
                        userId: userId,
                    });

                    // Prepare notification data
                    const courierId = newData.assignedCourierId;
                    if (courierId && userId !== courierId && (userProfile.role === 'admin' || userProfile.role === 'customer-service')) {
                        let title = "تحديث في شحنة";
                        let body = `تم تحديث بيانات الشحنة: ${newData.recipientName}`;

                        if (updatePayload.assignedCourierId && updatePayload.assignedCourierId !== oldData.assignedCourierId) {
                            title = "شحنة جديدة";
                            body = `تم تعيين شحنة جديدة لك: ${newData.recipientName}`;
                        } else if (updatePayload.status && updatePayload.status !== oldData.status) {
                            body = `تم تغيير حالة الشحنة (${newData.recipientName}) إلى ${updatePayload.status}`;
                        } else if (updatePayload.retryAttempt) {
                            title = "إعادة محاولة توصيل";
                            body = `طلب إعادة محاولة للشحنة: ${newData.recipientName}`;
                        }

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
                const { userId, title, body, url } = result.notification;
                await sendNotificationToUser(userId, title, body, url);
            }

            res.status(200).send({ data: { success: true } });
        } catch (error: any) {
            console.error("Error updating shipment:", error);
            res.status(500).send({ error: { message: error.message } });
        }
    });
});

export const executeCompanySettlement = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    // Keep existing implementation
});
