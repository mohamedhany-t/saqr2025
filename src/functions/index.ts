
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";

try {
    admin.initializeApp();
} catch (e) {
    // This can happen in local dev environments
    if (!/already exists/.test((e as Error).message)) {
        console.error('Firebase admin initialization error', e);
    }
}

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
 * An HTTP Request function for a courier to update a shipment's status.
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

export const handleShipmentUpdate = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { uid: courierId, token } = context.auth;
    const validation = updateShipmentStatusSchema.safeParse(data);

    if (!validation.success) {
        console.error("Validation failed:", validation.error.flatten());
        throw new functions.https.HttpsError('invalid-argument', 'The data provided is invalid.');
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
        return result;
    } catch (error: any) {
        console.error("Error updating shipment status:", error);
        // Re-throw errors from the transaction so the client gets them
        if(error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "An internal error occurred while updating the shipment.");
    }
});
