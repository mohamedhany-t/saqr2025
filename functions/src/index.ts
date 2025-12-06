
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

// Zod schema for simple update from courier
const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    collectedAmount: z.number().optional(),
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
        
        const { uid: courierId, name: courierName, email: courierEmail } = context.auth;
        
        // IMPORTANT FIX: Read from req.body.data because this is how callable functions send data to onRequest triggers.
        const validation = updateShipmentStatusSchema.safeParse(req.body.data);

        if (!validation.success) {
            console.error("Validation failed:", validation.error.errors);
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }

        const { shipmentId, status, reason, collectedAmount } = validation.data;
        const shipmentRef = db.collection('shipments').doc(shipmentId);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                     throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }
                const shipmentData = shipmentDoc.data()!;
                if (shipmentData.assignedCourierId !== courierId) {
                     throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                
                const finalShipmentUpdate: any = {
                    status: status,
                    reason: reason || "",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                if (collectedAmount !== undefined) {
                    finalShipmentUpdate.collectedAmount = collectedAmount;
                }
                
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: status,
                    reason: reason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: courierName || courierEmail,
                    userId: courierId,
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
