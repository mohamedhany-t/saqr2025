
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";
import type { User, Company, Shipment, ShipmentStatusConfig } from "./types";

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
});


export const handleShipmentUpdate = functions.https.onRequest((req, res) => {
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
            res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
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
                if (!shipmentDoc.exists) {
                     throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }

                const shipmentData = shipmentDoc.data()!;
                
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) {
                    throw new functions.https.HttpsError("permission-denied", "User profile not found.");
                }
                const userProfile = userDoc.data() as User;
                
                if (userProfile.role !== 'admin' && shipmentData.assignedCourierId !== userId && shipmentData.companyId !== userId) {
                     throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                
                const finalUpdate: { [key: string]: any } = {
                    ...updatePayload, // Start with the data passed from the client
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                
                // If status is being changed, we need to recalculate financial fields
                if (updatePayload.status && updatePayload.status !== shipmentData.status) {
                    finalUpdate.retryAttempt = false; // Reset retry flag on any status update

                    const statusesSnap = await db.collection('shipment_statuses').get();
                    const statusConfigs = statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShipmentStatusConfig[];
                    const newStatusConfig = statusConfigs.find(s => s.id === updatePayload.status);

                    if (newStatusConfig) {
                        let paidAmount = 0;
                        const totalAmount = finalUpdate.totalAmount ?? shipmentData.totalAmount ?? 0;
                        const collectedAmount = finalUpdate.collectedAmount ?? 0;

                        if (newStatusConfig.requiresFullCollection) {
                            paidAmount = totalAmount;
                        } else if (newStatusConfig.requiresPartialCollection) {
                            paidAmount = collectedAmount;
                        }
                        
                        finalUpdate.paidAmount = paidAmount;
                        finalUpdate.collectedAmount = paidAmount; // Align collected with paid for consistency

                        // --- Start of Custom Return Logic ---
                        // This logic MUST come after initial paidAmount calculation but before commission calculation.
                        const isCustomReturn = finalUpdate.isCustomReturn ?? shipmentData.isCustomReturn;
                        if (isCustomReturn && newStatusConfig.isDeliveredStatus) {
                            finalUpdate.paidAmount = -Math.abs(totalAmount);
                            finalUpdate.collectedAmount = -Math.abs(totalAmount);
                        }
                        // --- End of Custom Return Logic ---

                        // Handle courier commission
                        if (newStatusConfig.affectsCourierBalance) {
                            const courierProfileDoc = shipmentData.assignedCourierId ? await db.collection('couriers').doc(shipmentData.assignedCourierId).get() : null;
                            const commissionRate = courierProfileDoc?.exists ? (courierProfileDoc.data() as any).commissionRate || 0 : 0;
                            finalUpdate.courierCommission = commissionRate;
                        } else {
                            finalUpdate.courierCommission = 0;
                        }
                        
                        // Handle company commission
                        if (newStatusConfig.affectsCompanyBalance) {
                            const companyProfileDoc = await db.collection('companies').doc(shipmentData.companyId).get();
                            const governorateCommissions = (companyProfileDoc.data() as any)?.governorateCommissions || {};
                            const commission = governorateCommissions[shipmentData.governorateId] || 0;
                            finalUpdate.companyCommission = commission;
                        } else {
                             finalUpdate.companyCommission = 0;
                        }

                    }
                }

                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: finalUpdate.status || shipmentData.status,
                    reason: finalUpdate.reason || finalUpdate.amountChangeReason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: userName || userEmail,
                    userId: userId,
                };

                transaction.update(shipmentRef, finalUpdate);
                transaction.set(historyRef, historyEntry);

                return { success: true, message: "Shipment updated successfully." };
            });
            res.status(200).send({ data: result });
        } catch (error: any) {
            console.error("Error updating shipment status:", error);
            const status = error.httpErrorCode?.canonicalName || 'INTERNAL';
            res.status(error.httpErrorCode?.code || 500).send({ error: { status, message: error.message } });
        }
    });
});
