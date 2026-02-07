
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

                // --- TRACKING DATES LOGIC ---
                
                // 1. Assignment Date: Set if assignedCourierId is new or changed
                if (updatePayload.assignedCourierId !== undefined) {
                    const newCourierId = updatePayload.assignedCourierId;
                    const oldCourierId = oldData.assignedCourierId || null;
                    
                    if (newCourierId !== oldCourierId) {
                        if (newCourierId) {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.serverTimestamp();
                        } else {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }

                // 2. Courier Archival Date: Set if isArchivedForCourier is toggled to true
                if (updatePayload.isArchivedForCourier !== undefined) {
                    const newArchived = updatePayload.isArchivedForCourier;
                    const oldArchived = oldData.isArchivedForCourier || false;
                    
                    if (newArchived !== oldArchived) {
                        if (newArchived === true) {
                            finalUpdateData.courierArchivedAt = admin.firestore.FieldValue.serverTimestamp();
                        } else {
                            finalUpdateData.courierArchivedAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }

                // 3. Company Archival Date: Set if isArchivedForCompany is toggled to true
                if (updatePayload.isArchivedForCompany !== undefined) {
                    const newArchived = updatePayload.isArchivedForCompany;
                    const oldArchived = oldData.isArchivedForCompany || false;
                    
                    if (newArchived !== oldArchived) {
                        if (newArchived === true) {
                            finalUpdateData.companyArchivedAt = admin.firestore.FieldValue.serverTimestamp();
                        } else {
                            finalUpdateData.companyArchivedAt = admin.firestore.FieldValue.delete();
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
                
                // Audit Log
                const newData = { ...oldData, ...finalUpdateData };
                const changes: ShipmentHistoryEntry[] = [];
                const allKeys = new Set([...Object.keys(oldData), ...Object.keys(finalUpdateData)]);
                for (const key of allKeys) {
                    const oldValue = (oldData as any)[key];
                    const newValue = (newData as any)[key];
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

const settlementSchema = z.object({
  companyId: z.string(),
  paymentAmount: z.number(),
  shipmentIdsToArchive: z.array(z.string()),
  settlementNote: z.string().optional(),
});

export const executeCompanySettlement = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const validation = settlementSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError('invalid-argument', 'The data provided is invalid.', validation.error.format());
    }

    const { companyId, paymentAmount, shipmentIdsToArchive, settlementNote } = validation.data;
    const adminId = context.auth.uid;
    const db = admin.firestore();
    const batch = db.batch();

    try {
        const paymentRef = db.collection('company_payments').doc();
        batch.set(paymentRef, {
            companyId,
            amount: paymentAmount,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            recordedById: adminId,
            notes: settlementNote || 'تسوية عبر شيت',
            isArchived: true,
        });
        
        for (const shipmentId of shipmentIdsToArchive) {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            batch.update(shipmentRef, { 
                isArchivedForCompany: true, 
                companyArchivedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        }

        await batch.commit();
        return { success: true, message: `تمت تسوية حساب الشركة وأرشفة ${shipmentIdsToArchive.length} شحنة بنجاح.` };

    } catch (error: any) {
        console.error('Error executing company settlement:', error);
        throw new functions.https.HttpsError('internal', 'Failed to execute settlement.', error.message);
    }
});
