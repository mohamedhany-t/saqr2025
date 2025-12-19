
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";
import type { User, Shipment, ShipmentStatusConfig, ShipmentHistory, ShipmentHistoryEntry } from "./types";

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
    // All other fields are optional because the logic will decide what to do
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
    isArchivedForCourier: z.boolean().optional(),
    isArchivedForCompany: z.boolean().optional(),
    senderName: z.string().optional(),
    isCustomReturn: z.boolean().optional(),
    retryAttempt: z.boolean().optional(),
    isLabelPrinted: z.boolean().optional(),
    isUrgent: z.boolean().optional(),
    isExchange: z.boolean().optional(),
    shipmentCode: z.string().optional(),
    createdAt: z.any().optional(), // Allow passing createdAt for new shipments
    isPriceChangeDecision: z.boolean().optional(),
});


// Increase timeout for potentially long-running functions
const runtimeOpts: functions.RuntimeOptions = {
    timeoutSeconds: 540, // 9 minutes
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

                        const isCustomReturn = finalUpdateData.isCustomReturn ?? oldData.isCustomReturn;
                        if (isCustomReturn && newStatusConfig.isDeliveredStatus) {
                            finalUpdateData.paidAmount = -Math.abs(totalAmount);
                            finalUpdateData.collectedAmount = -Math.abs(totalAmount);
                        }

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
                        
                        if (newStatusConfig.affectsCompanyBalance) {
                            const companyId = finalUpdateData.companyId || oldData.companyId;
                            if (companyId) {
                                const companyProfileDoc = await db.collection('companies').doc(companyId).get();
                                const governorateCommissions = companyProfileDoc?.exists ? (companyProfileDoc.data() as any).governorateCommissions || {} : {};
                                const governorateId = finalUpdateData.governorateId || oldData.governorateId;
                                const commission = governorateCommissions[governorateId] || 0;
                                finalUpdateData.companyCommission = commission;
                            }
                        } else {
                             finalUpdateData.companyCommission = 0;
                        }
                    }
                }
                
                // --- DETAILED AUDIT LOG ---
                const newData = { ...oldData, ...finalUpdateData };
                const changes: ShipmentHistoryEntry[] = [];

                // Combine keys from old and new data to catch all changes
                const allKeys = new Set([...Object.keys(oldData), ...Object.keys(finalUpdateData)]);
                
                for (const key of allKeys) {
                    const oldValue = (oldData as any)[key];
                    const newValue = (newData as any)[key];

                    // Simple comparison, ignoring objects like Timestamps for now
                    if (JSON.stringify(oldValue) !== JSON.stringify(newValue) && typeof oldValue !== 'object' && typeof newValue !== 'object') {
                         changes.push({ field: key, oldValue: oldValue ?? null, newValue: newValue ?? null });
                    }
                }


                if (changes.length > 0) {
                    const historyRef = shipmentRef.collection('history').doc();
                    const historyEntry: Omit<ShipmentHistory, "id"> = {
                        changes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedBy: userName || userEmail,
                        userId: userId,
                    };
                    transaction.set(historyRef, historyEntry);
                }
                
                if (isCreating) {
                    const dataToSet = { ...finalUpdateData };
                    if(!dataToSet.createdAt) {
                        dataToSet.createdAt = admin.firestore.FieldValue.serverTimestamp();
                    }
                     dataToSet.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                    transaction.set(shipmentRef, dataToSet);
                } else {
                    const dataToUpdate = { ...finalUpdateData, updatedAt: admin.firestore.FieldValue.serverTimestamp()};
                    transaction.update(shipmentRef, dataToUpdate);
                }

                return { success: true, message: isCreating ? "Shipment created successfully." : "Shipment updated successfully." };
            });
            res.status(200).send({ data: result });
        } catch (error: any) {
            console.error("Error updating shipment status:", error);
            const status = error.httpErrorCode?.canonicalName || 'INTERNAL';
            res.status(error.httpErrorCode?.code || 500).send({ error: { status, message: error.message } });
        }
    });
});
