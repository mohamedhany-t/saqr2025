
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";

admin.initializeApp();
const db = admin.firestore();

// Initialize cors middleware
const corsHandler = cors({ origin: true });

/**
 * A callable function to get aggregated dashboard statistics for an admin.
 */
export const getDashboardStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const adminDoc = await db.collection("roles_admin").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "The function must be called by an admin user.");
  }
  
  try {
    const shipmentsSnapshot = await db.collection("shipments").get();
    let totalRevenue = 0;
    let inTransit = 0;
    let delivered = 0;
    let returned = 0;
    const totalShipments = shipmentsSnapshot.size;

    shipmentsSnapshot.forEach((doc) => {
      const shipment = doc.data();
      if (shipment.paidAmount) {
        totalRevenue += shipment.paidAmount;
      }
      switch (shipment.status) {
        case "In-Transit": inTransit++; break;
        case "Delivered": delivered++; break;
        case "Returned":
        case "Cancelled":
        case "Refused (Unpaid)":
        case "Evasion (Phone)":
        case "Partially Delivered":
        case "Evasion (Delivery Attempt)":
        case "Refused (Paid)": returned++; break;
        default: break;
      }
    });

    return { totalRevenue, inTransit, delivered, returned, totalShipments };
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    throw new functions.https.HttpsError("internal", "Failed to calculate dashboard statistics.");
  }
});


/**
 * A callable function for a courier to update a shipment's status.
 * This centralizes logic and security checks.
 */
const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    collectedAmount: z.number(),
    paidAmount: z.number(),
    courierCommission: z.number(),
    companyCommission: z.number(),
});

export const updateShipmentStatus = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Manually handle callable function logic for CORS compatibility
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const data = req.body.data;
        const context: any = {};
        
        if (req.headers.authorization?.startsWith('Bearer ')) {
            const idToken = req.headers.authorization.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                context.auth = decodedToken;
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
        
        const { uid: courierId, token } = context.auth;
        const validation = updateShipmentStatusSchema.safeParse(data);

        if (!validation.success) {
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }

        const { shipmentId, status, reason, ...financials } = validation.data;
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
                const finalShipmentUpdate = {
                    ...financials,
                    status: status,
                    reason: reason || "",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: status,
                    reason: reason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: token.name || token.email,
                    userId: courierId,
                };
                transaction.update(shipmentRef, finalShipmentUpdate);
                transaction.set(historyRef, historyEntry);
                return { success: true, message: "Shipment updated successfully." };
            });
            res.status(200).send({ result });
        } catch (error: any) {
            console.error("Error updating shipment status:", error);
            res.status(500).send({ error: { status: 'INTERNAL', message: error.message } });
        }
    });
});
