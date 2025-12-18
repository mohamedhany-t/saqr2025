
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";
import type { User, Company, Shipment, ShipmentStatusConfig, ShipmentHistoryEntry } from "./types";

try {
    admin.initializeApp();
} catch (e) {
    if (!/already exists/.test((e as Error).message)) {
        console.error('Firebase admin initialization error', e);
    }
}

const db = admin.firestore();
const corsHandler = cors({ origin: true });

// Schema for the new settlement function
const companySettlementSchema = z.object({
    companyId: z.string(),
    paymentAmount: z.number(),
    shipmentIdsToArchive: z.array(z.string()),
    settlementNote: z.string(),
    adminId: z.string(),
});

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

// NEW FUNCTION with a NEW NAME to avoid deployment conflicts
export const executeCompanySettlement = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }
    
    // 2. Data Validation
    const validation = companySettlementSchema.safeParse(data);
    if (!validation.success) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'The data provided is invalid.'
      );
    }
    
    const { companyId, paymentAmount, shipmentIdsToArchive, settlementNote, adminId } = validation.data;
    
    const BATCH_SIZE = 400; // Firestore batch limit is 500, we use 400 to be safe.
    const allBatches: Promise<any>[] = [];

    // --- Create and commit the first batch for the payment ---
    if (paymentAmount !== 0) {
        let initialBatch = db.batch();
        const paymentRef = db.collection('company_payments').doc();
        initialBatch.set(paymentRef, {
            companyId,
            amount: paymentAmount,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            recordedById: adminId,
            notes: settlementNote,
            isArchived: true,
        });
        allBatches.push(initialBatch.commit());
    }

    // --- Create and commit subsequent batches for archiving shipments ---
    for (let i = 0; i < shipmentIdsToArchive.length; i += BATCH_SIZE) {
        const chunk = shipmentIdsToArchive.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach(shipmentId => {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            batch.update(shipmentRef, { isArchivedForCompany: true });
        });
        allBatches.push(batch.commit());
    }

    try {
        await Promise.all(allBatches);
        return { success: true, message: `تمت تسوية حساب الشركة وأرشفة ${shipmentIdsToArchive.length} شحنة بنجاح.` };
    } catch (error: any) {
        console.error("Error settling company account:", error);
        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while executing the settlement on the server.',
            error.message
        );
    }
});


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
                res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
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
                const oldData = isCreating ? {} : shipmentDoc.data() as Shipment;

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
                
                const finalUpdate: { [key: string]: any } = {
                    ...updatePayload,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                if (finalUpdate.isPriceChangeDecision) {
                    finalUpdate.requestedAmount = admin.firestore.FieldValue.delete();
                    finalUpdate.amountChangeReason = admin.firestore.FieldValue.delete();
                    delete finalUpdate.isPriceChangeDecision;
                }
                
                if (updatePayload.status && updatePayload.status !== oldData.status) {
                    finalUpdate.retryAttempt = false;

                    const statusesSnap = await db.collection('shipment_statuses').get();
                    const statusConfigs = statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShipmentStatusConfig[];
                    const newStatusConfig = statusConfigs.find(s => s.id === updatePayload.status);

                    if (newStatusConfig) {
                        let paidAmount = 0;
                        const totalAmount = finalUpdate.totalAmount ?? oldData.totalAmount ?? 0;
                        const collectedAmount = finalUpdate.collectedAmount ?? 0;

                        if (newStatusConfig.requiresFullCollection) paidAmount = totalAmount;
                        else if (newStatusConfig.requiresPartialCollection) paidAmount = collectedAmount;
                        
                        finalUpdate.paidAmount = paidAmount;
                        finalUpdate.collectedAmount = paidAmount;

                        const isCustomReturn = finalUpdate.isCustomReturn ?? oldData.isCustomReturn;
                        if (isCustomReturn && newStatusConfig.isDeliveredStatus) {
                            finalUpdate.paidAmount = -Math.abs(totalAmount);
                            finalUpdate.collectedAmount = -Math.abs(totalAmount);
                        }

                        if (newStatusConfig.affectsCourierBalance) {
                            const courierId = finalUpdate.assignedCourierId || oldData.assignedCourierId;
                            const courierProfileDoc = courierId ? await db.collection('couriers').doc(courierId).get() : null;
                            const commissionRate = courierProfileDoc?.exists ? (courierProfileDoc.data() as any).commissionRate || 0 : 0;
                            finalUpdate.courierCommission = commissionRate;
                        } else {
                            finalUpdate.courierCommission = 0;
                        }
                        
                        if (newStatusConfig.affectsCompanyBalance) {
                            const companyId = finalUpdate.companyId || oldData.companyId;
                            const companyProfileDoc = companyId ? await db.collection('companies').doc(companyId).get() : null;
                            const governorateCommissions = companyProfileDoc?.exists ? (companyProfileDoc.data() as any).governorateCommissions || {} : {};
                            const governorateId = finalUpdate.governorateId || oldData.governorateId;
                            const commission = governorateCommissions[governorateId] || 0;
                            finalUpdate.companyCommission = commission;
                        } else {
                             finalUpdate.companyCommission = 0;
                        }
                    }
                }
                
                // --- DETAILED AUDIT LOG ---
                const changes: ShipmentHistoryEntry['changes'] = [];
                for (const key in updatePayload) {
                    if (Object.prototype.hasOwnProperty.call(updatePayload, key)) {
                        const oldValue = (oldData as any)[key];
                        const newValue = (updatePayload as any)[key];
                        // Ignore if values are the same or if it's a server timestamp placeholder
                        if (oldValue !== newValue && typeof newValue !== 'object' && typeof oldValue !== 'object') {
                             changes.push({ field: key, oldValue: oldValue ?? null, newValue: newValue ?? null });
                        }
                    }
                }

                if (changes.length > 0) {
                    const historyRef = shipmentRef.collection('history').doc();
                    const historyEntry: ShipmentHistoryEntry = {
                        changes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedBy: userName || userEmail,
                        userId: userId,
                    };
                    transaction.set(historyRef, historyEntry);
                }
                
                if (isCreating) {
                    if(!finalUpdate.createdAt) {
                        finalUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
                    }
                    transaction.set(shipmentRef, finalUpdate);
                } else {
                    transaction.update(shipmentRef, finalUpdate);
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
