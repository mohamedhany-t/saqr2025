
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";

try {
    admin.initializeApp();
} catch (e) {
    if (!/already exists/.test((e as Error).message)) {
        console.error('Firebase admin initialization error', e);
    }
}

const db = admin.firestore();
const corsHandler = cors({ origin: true });

// This flexible schema now accepts all possible fields from both
// courier and admin roles, making them optional to avoid validation errors.
const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    collectedAmount: z.number().optional(),
    
    // --- Fields for Courier's Price Change Request ---
    requestedAmount: z.number().optional(),
    amountChangeReason: z.string().optional(),

    // --- Optional fields that Admin OR COURIER can now send ---
    paidAmount: z.number().optional(),
    courierCommission: z.number().optional(),
    
    // --- Optional fields that only Admin can send ---
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    address: z.string().optional(),
    totalAmount: z.number().optional(),
    governorateId: z.string().optional(),
    assignedCourierId: z.string().optional(),
    companyId: z.string().optional(),
    orderNumber: z.string().optional(),
    companyCommission: z.number().optional(),
    isWarehouseReturn: z.boolean().optional(),
    isReturnedToCompany: z.boolean().optional(),
    isArchivedForCourier: z.boolean().optional(),
    isArchivedForCompany: z.boolean().optional(),
    senderName: z.string().optional(),
    isCustomReturn: z.boolean().optional(),
    retryAttempt: z.boolean().optional(),
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
        const shipmentId = validatedData.shipmentId;
        const shipmentRef = db.collection('shipments').doc(shipmentId);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                     throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }

                const shipmentData = shipmentDoc.data()!;
                
                // Allow admin to edit any shipment, but courier/company can only edit their own.
                const userRoleDoc = await db.collection('roles_admin').doc(userId).get();
                const isAdmin = userRoleDoc.exists;
                
                if (!isAdmin && shipmentData.assignedCourierId !== userId && shipmentData.companyId !== userId) {
                     throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                
                // Construct the final update object from validated, non-undefined data
                const finalShipmentUpdate: { [key: string]: any } = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                
                // Courier is taking an action, so reset the retry flag.
                if (validatedData.status) {
                    finalShipmentUpdate.retryAttempt = false;
                }


                // Add all valid fields from the request to the update object
                for (const key in validatedData) {
                    if (Object.prototype.hasOwnProperty.call(validatedData, key) && (validatedData as any)[key] !== undefined && key !== 'shipmentId') {
                        finalShipmentUpdate[key] = (validatedData as any)[key];
                    }
                }

                // If isCustomReturn is true and the status is a "delivered" status, make the paidAmount negative.
                const isCustomReturn = shipmentData.isCustomReturn === true || validatedData.isCustomReturn === true;
                const statusConfigDoc = await db.collection('shipment_statuses').doc(validatedData.status).get();
                const isDeliveredStatus = statusConfigDoc.exists && statusConfigDoc.data()?.isDeliveredStatus === true;

                if (isCustomReturn && isDeliveredStatus) {
                    const totalAmount = validatedData.totalAmount ?? shipmentData.totalAmount ?? 0;
                    finalShipmentUpdate.paidAmount = -Math.abs(totalAmount);
                    finalShipmentUpdate.collectedAmount = -Math.abs(totalAmount);
                }
                
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: validatedData.status,
                    reason: validatedData.reason || validatedData.amountChangeReason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: userName || userEmail,
                    userId: userId,
                };

                transaction.update(shipmentRef, finalShipmentUpdate);
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
